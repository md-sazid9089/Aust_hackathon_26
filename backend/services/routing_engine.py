"""
Routing Engine — Single-Modal & Multi-Modal Path Computation
==============================================================
Computes shortest paths over the in-memory OSM road graph.
"""

from __future__ import annotations

import math
from typing import Callable

import networkx as nx

from config import settings
from models.route_models import RouteRequest, RouteResponse, RouteLeg, ModeSwitch, LatLng
from services.graph_service import graph_service
from services.ml_integration import ml_integration


class RoutingEngine:
    """Singleton routing engine service."""

    def __init__(self):
        self._algorithm = settings.routing_algorithm
        self._weight_attr = settings.weight_attribute
        self._max_alts = settings.max_alternatives
        self._max_transfers = settings.multimodal_max_transfers
        self._transfer_radius = settings.transfer_radius_meters

    async def compute(self, request: RouteRequest) -> RouteResponse:
        await self._refresh_ml_weights()

        if len(request.modes) == 1:
            legs, switches, anomalies_avoided = await self._single_modal(
                origin=request.origin,
                destination=request.destination,
                mode=request.modes[0],
                optimize=request.optimize,
                avoid_anomalies=request.avoid_anomalies,
            )
        else:
            legs, switches, anomalies_avoided = await self._multi_modal(
                origin=request.origin,
                destination=request.destination,
                modes=request.modes,
                optimize=request.optimize,
                avoid_anomalies=request.avoid_anomalies,
            )

        total_dist = sum(leg.distance_m for leg in legs)
        total_dur = sum(leg.duration_s for leg in legs) + sum(sw.penalty_time_s for sw in switches)
        total_cost = sum(leg.cost for leg in legs) + sum(sw.penalty_cost for sw in switches)

        num_alts = request.max_alternatives or self._max_alts
        alternatives = await self._compute_alternatives(request, num_alts)

        return RouteResponse(
            legs=legs,
            mode_switches=switches,
            total_distance_m=total_dist,
            total_duration_s=total_dur,
            total_cost=total_cost,
            anomalies_avoided=anomalies_avoided,
            alternatives=alternatives,
        )

    async def _single_modal(
        self,
        origin: LatLng,
        destination: LatLng,
        mode: str,
        optimize: str,
        avoid_anomalies: bool,
    ) -> tuple[list[RouteLeg], list[ModeSwitch], int]:
        del avoid_anomalies  # Placeholder until anomaly filtering is added.

        if mode not in settings.vehicle_types:
            raise ValueError(f"Unknown transport mode: '{mode}'. Available: {list(settings.vehicle_types.keys())}")

        if not graph_service.is_loaded():
            return [self._build_synthetic_leg(mode, origin, destination)], [], 0

        graph = graph_service.get_subgraph_for_mode(mode)
        if graph is None or graph.number_of_nodes() == 0:
            return [self._build_synthetic_leg(mode, origin, destination)], [], 0

        origin_node = graph_service.get_nearest_node(origin.lat, origin.lng)
        dest_node = graph_service.get_nearest_node(destination.lat, destination.lng)
        if origin_node is None or dest_node is None:
            return [self._build_synthetic_leg(mode, origin, destination)], [], 0

        if origin_node not in graph or dest_node not in graph:
            return [self._build_synthetic_leg(mode, origin, destination)], [], 0

        weight_fn = self._build_weight_fn(mode, optimize)

        try:
            path = nx.shortest_path(graph, source=origin_node, target=dest_node, weight=weight_fn, method="dijkstra")
        except nx.NetworkXNoPath:
            return [self._build_synthetic_leg(mode, origin, destination)], [], 0

        if len(path) < 2:
            return [self._build_synthetic_leg(mode, origin, destination)], [], 0

        geometry: list[LatLng] = []
        total_distance_m = 0.0
        total_duration_s = 0.0

        for i in range(len(path) - 1):
            u = path[i]
            v = path[i + 1]
            edge_data = self._best_edge_data(graph, u, v, weight_fn)
            total_distance_m += float(edge_data.get("length") or 0.0)
            total_duration_s += float(edge_data.get(f"{mode}_travel_time") or edge_data.get("travel_time") or 0.0)

            edge_points = self._edge_geometry_points(graph, u, v, edge_data)
            if geometry and edge_points:
                if geometry[-1].lat == edge_points[0].lat and geometry[-1].lng == edge_points[0].lng:
                    geometry.extend(edge_points[1:])
                else:
                    geometry.extend(edge_points)
            else:
                geometry.extend(edge_points)

        if len(geometry) < 2:
            geometry = [origin, destination]

        cost_per_km = float(settings.vehicle_types[mode].get("fuel_cost_per_km", 0.0) or 0.0)
        total_cost = (total_distance_m / 1000.0) * cost_per_km

        leg = RouteLeg(
            mode=mode,
            geometry=geometry,
            distance_m=total_distance_m,
            duration_s=total_duration_s,
            cost=total_cost,
            instructions=[
                f"Start at ({origin.lat:.5f}, {origin.lng:.5f})",
                f"Follow the shortest {mode} route on roads",
                f"Arrive at ({destination.lat:.5f}, {destination.lng:.5f})",
            ],
        )
        return [leg], [], 0

    async def _multi_modal(
        self,
        origin: LatLng,
        destination: LatLng,
        modes: list[str],
        optimize: str,
        avoid_anomalies: bool,
    ) -> tuple[list[RouteLeg], list[ModeSwitch], int]:
        legs: list[RouteLeg] = []
        switches: list[ModeSwitch] = []
        total_anomalies_avoided = 0

        current_pos = origin
        for i, mode in enumerate(modes):
            leg_dest = destination if i == len(modes) - 1 else self._find_transfer_point(current_pos, destination, i, len(modes))

            leg_legs, _, avoided = await self._single_modal(
                origin=current_pos,
                destination=leg_dest,
                mode=mode,
                optimize=optimize,
                avoid_anomalies=avoid_anomalies,
            )
            legs.extend(leg_legs)
            total_anomalies_avoided += avoided

            if i < len(modes) - 1:
                next_mode = modes[i + 1]
                penalty_key = f"{mode}_to_{next_mode}"
                penalty = settings.mode_switch_penalties.get(penalty_key, {})
                switches.append(
                    ModeSwitch(
                        from_mode=mode,
                        to_mode=next_mode,
                        location=leg_dest,
                        penalty_time_s=float(penalty.get("time_seconds", 0.0) or 0.0),
                        penalty_cost=float(penalty.get("cost_units", 0.0) or 0.0),
                    )
                )

            current_pos = leg_dest

        return legs, switches, total_anomalies_avoided

    def _build_weight_fn(self, mode: str, optimize: str) -> Callable:
        def weight(u, v, data):
            best = float("inf")
            for edge in data.values():
                length = float(edge.get("length") or 0.0)
                travel_time = float(edge.get(f"{mode}_travel_time") or edge.get("travel_time") or 0.0)
                cost_per_km = float(settings.vehicle_types[mode].get("fuel_cost_per_km", 0.0) or 0.0)
                cost = (length / 1000.0) * cost_per_km

                if optimize == "distance":
                    value = max(length, 0.01)
                elif optimize == "cost":
                    value = max(cost, 0.0001)
                else:
                    value = max(travel_time, 0.01)

                if value < best:
                    best = value
            return best

        return weight

    def _best_edge_data(self, graph: nx.MultiDiGraph, u, v, weight_fn: Callable) -> dict:
        data = graph.get_edge_data(u, v) or {}
        if not data:
            return {}

        best_key = None
        best_weight = float("inf")
        for key in data:
            fake_wrapper = {key: data[key]}
            w = weight_fn(u, v, fake_wrapper)
            if w < best_weight:
                best_weight = w
                best_key = key

        return data[best_key] if best_key is not None else next(iter(data.values()))

    def _edge_geometry_points(self, graph: nx.MultiDiGraph, u, v, edge_data: dict) -> list[LatLng]:
        geom = edge_data.get("geometry")
        points: list[LatLng] = []

        if geom is not None and hasattr(geom, "coords"):
            for x, y in list(geom.coords):
                points.append(LatLng(lat=float(y), lng=float(x)))
            if points:
                return points

        u_data = graph.nodes.get(u, {})
        v_data = graph.nodes.get(v, {})
        return [
            LatLng(lat=float(u_data.get("y") or 0.0), lng=float(u_data.get("x") or 0.0)),
            LatLng(lat=float(v_data.get("y") or 0.0), lng=float(v_data.get("x") or 0.0)),
        ]

    def _find_transfer_point(self, current: LatLng, destination: LatLng, leg_index: int, total_legs: int) -> LatLng:
        fraction = (leg_index + 1) / total_legs
        return LatLng(
            lat=current.lat + (destination.lat - current.lat) * fraction,
            lng=current.lng + (destination.lng - current.lng) * fraction,
        )

    def _build_synthetic_leg(self, mode: str, origin: LatLng, destination: LatLng) -> RouteLeg:
        """Fallback when graph data is unavailable: direct-line estimate preserving response contract."""
        distance_m = self._haversine_distance_m(origin.lat, origin.lng, destination.lat, destination.lng)
        speed_kmh = float(settings.vehicle_types[mode].get("default_speed_kmh", 30.0) or 30.0)
        speed_mps = max(speed_kmh / 3.6, 0.1)
        duration_s = distance_m / speed_mps
        cost_per_km = float(settings.vehicle_types[mode].get("fuel_cost_per_km", 0.0) or 0.0)
        cost = (distance_m / 1000.0) * cost_per_km

        return RouteLeg(
            mode=mode,
            geometry=[origin, destination],
            distance_m=distance_m,
            duration_s=duration_s,
            cost=cost,
            instructions=[
                f"Start at ({origin.lat:.5f}, {origin.lng:.5f})",
                f"Proceed directly toward destination using {mode}",
                f"Arrive at ({destination.lat:.5f}, {destination.lng:.5f})",
            ],
        )

    def _haversine_distance_m(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        r = 6_371_000.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    async def _compute_alternatives(self, request: RouteRequest, num_alternatives: int) -> list[list[RouteLeg]]:
        del request, num_alternatives
        return []

    async def _refresh_ml_weights(self):
        try:
            await ml_integration.refresh_predictions()
        except Exception as e:
            print(f"[RoutingEngine] ML weight refresh failed (using defaults): {e}")


routing_engine = RoutingEngine()
