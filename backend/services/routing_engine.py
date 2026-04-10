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
from models.route_models import (
    RouteRequest,
    RouteResponse,
    RouteLeg,
    ModeSwitch,
    LatLng,
    MultimodalSuggestion,
    SegmentSuggestion,
    VehicleOption,
)
from services.graph_service import graph_service
from services.ml_integration import ml_integration
from services.multimodal_dijkstra import multi_modal_dijkstra_with_coords
from services.anomaly_service import anomaly_service


class RoutingEngine:
    """Singleton routing engine service."""

    def __init__(self):
        self._algorithm = settings.routing_algorithm
        self._weight_attr = settings.weight_attribute
        self._max_alts = settings.max_alternatives
        self._max_transfers = settings.multimodal_max_transfers
        self._transfer_radius = settings.transfer_radius_meters

    def _normalize_mode(self, mode: str) -> str:
        if mode == "bus":
            return "transit"
        return mode

    def _display_mode(self, mode: str) -> str:
        if mode == "transit":
            return "bus"
        return mode

    async def compute(self, request: RouteRequest) -> RouteResponse:
        await self._refresh_ml_weights()
        anomaly_service.sync_active_effects()

        request.modes = [self._normalize_mode(m) for m in request.modes]

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
        total_dur = sum(leg.duration_s for leg in legs) + sum(
            sw.penalty_time_s for sw in switches
        )
        total_cost = sum(leg.cost for leg in legs) + sum(
            sw.penalty_cost for sw in switches
        )

        num_alts = request.max_alternatives or self._max_alts
        alternatives = await self._compute_alternatives(request, num_alts)

        multimodal_suggestions = (
            self._compute_multimodal_suggestions(request.origin, request.destination)
            if bool(getattr(request, "include_multimodal", False))
            else []
        )

        return RouteResponse(
            legs=[
                RouteLeg(
                    mode=self._display_mode(leg.mode),
                    geometry=leg.geometry,
                    distance_m=leg.distance_m,
                    duration_s=leg.duration_s,
                    cost=leg.cost,
                    instructions=[
                        instr.replace(" transit ", " bus ").replace("transit", "bus")
                        for instr in leg.instructions
                    ],
                )
                for leg in legs
            ],
            mode_switches=[
                ModeSwitch(
                    from_mode=self._display_mode(sw.from_mode),
                    to_mode=self._display_mode(sw.to_mode),
                    location=sw.location,
                    penalty_time_s=sw.penalty_time_s,
                    penalty_cost=sw.penalty_cost,
                )
                for sw in switches
            ],
            total_distance_m=total_dist,
            total_duration_s=total_dur,
            total_cost=total_cost,
            anomalies_avoided=anomalies_avoided,
            alternatives=alternatives,
            multimodal_suggestions=multimodal_suggestions,
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
            raise ValueError(
                f"Unknown transport mode: '{mode}'. Available: {list(settings.vehicle_types.keys())}"
            )

        if not graph_service.is_loaded():
            raise ValueError("Graph is not loaded yet. Please retry in a moment.")

        graph = graph_service.get_subgraph_for_mode(mode)
        if graph is None or graph.number_of_nodes() == 0:
            raise ValueError(f"No graph data available for mode '{mode}'.")

        # Strict nearest-node snapping per requirement:
        # origin and destination must each snap to their closest node.
        origin_node = graph_service.get_nearest_node_in_graph(
            graph, origin.lat, origin.lng
        )
        dest_node = graph_service.get_nearest_node_in_graph(
            graph, destination.lat, destination.lng
        )

        if origin_node is None or dest_node is None:
            raise ValueError("Could not snap origin/destination to graph.")

        weight_fn = self._build_weight_fn(mode, optimize)

        if origin_node == dest_node:
            node_data = graph.nodes.get(origin_node, {})
            snapped = LatLng(
                lat=float(node_data.get("y") or origin.lat),
                lng=float(node_data.get("x") or origin.lng),
            )
            leg = RouteLeg(
                mode=mode,
                geometry=[snapped],
                distance_m=0.0,
                duration_s=0.0,
                cost=0.0,
                instructions=[
                    f"Start near node {origin_node}",
                    "You are already at the destination node.",
                ],
            )
            return [leg], [], 0

        path = self._safe_shortest_path(graph, origin_node, dest_node, weight_fn)
        if path is None:
            raise ValueError(
                f"No path found between origin and destination for mode '{mode}'."
            )

        if len(path) < 2:
            raise ValueError("Computed route is invalid.")

        geometry: list[LatLng] = []
        total_distance_m = 0.0
        total_duration_s = 0.0

        for i in range(len(path) - 1):
            u = path[i]
            v = path[i + 1]
            edge_data = self._best_edge_data(graph, u, v, weight_fn)
            total_distance_m += float(edge_data.get("length") or 0.0)
            total_duration_s += float(
                edge_data.get(f"{mode}_travel_time")
                or edge_data.get("travel_time")
                or 0.0
            )

            edge_points = self._edge_geometry_points(graph, u, v, edge_data)
            if geometry and edge_points:
                if (
                    geometry[-1].lat == edge_points[0].lat
                    and geometry[-1].lng == edge_points[0].lng
                ):
                    geometry.extend(edge_points[1:])
                else:
                    geometry.extend(edge_points)
            else:
                geometry.extend(edge_points)

        if len(geometry) < 2:
            raise ValueError("Computed route geometry is invalid.")

        cost_per_km = float(
            settings.vehicle_types[mode].get("fuel_cost_per_km", 0.0) or 0.0
        )
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
            leg_dest = (
                destination
                if i == len(modes) - 1
                else self._find_transfer_point(current_pos, destination, i, len(modes))
            )

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
                travel_time = float(
                    edge.get(f"{mode}_travel_time") or edge.get("travel_time") or 0.0
                )
                cost_per_km = float(
                    settings.vehicle_types[mode].get("fuel_cost_per_km", 0.0) or 0.0
                )
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

    def _best_edge_data(
        self, graph: nx.MultiDiGraph, u, v, weight_fn: Callable
    ) -> dict:
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

    def _edge_geometry_points(
        self, graph: nx.MultiDiGraph, u, v, edge_data: dict
    ) -> list[LatLng]:
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
            LatLng(
                lat=float(u_data.get("y") or 0.0), lng=float(u_data.get("x") or 0.0)
            ),
            LatLng(
                lat=float(v_data.get("y") or 0.0), lng=float(v_data.get("x") or 0.0)
            ),
        ]

    def _find_transfer_point(
        self, current: LatLng, destination: LatLng, leg_index: int, total_legs: int
    ) -> LatLng:
        fraction = (leg_index + 1) / total_legs
        return LatLng(
            lat=current.lat + (destination.lat - current.lat) * fraction,
            lng=current.lng + (destination.lng - current.lng) * fraction,
        )

    def _build_synthetic_leg(
        self, mode: str, origin: LatLng, destination: LatLng
    ) -> RouteLeg:
        """Fallback when graph data is unavailable: direct-line estimate preserving response contract."""
        distance_m = self._haversine_distance_m(
            origin.lat, origin.lng, destination.lat, destination.lng
        )
        speed_kmh = float(
            settings.vehicle_types[mode].get("default_speed_kmh", 30.0) or 30.0
        )
        speed_mps = max(speed_kmh / 3.6, 0.1)
        duration_s = distance_m / speed_mps
        cost_per_km = float(
            settings.vehicle_types[mode].get("fuel_cost_per_km", 0.0) or 0.0
        )
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

    def _safe_shortest_path(
        self,
        graph: nx.MultiDiGraph,
        source,
        target,
        weight_fn: Callable,
    ):
        try:
            return nx.shortest_path(
                graph,
                source=source,
                target=target,
                weight=weight_fn,
                method="dijkstra",
            )
        except nx.NetworkXNoPath:
            return None

    def _haversine_distance_m(
        self, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        r = 6_371_000.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = (
            math.sin(dphi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        )
        return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    async def _compute_alternatives(
        self, request: RouteRequest, num_alternatives: int
    ) -> list[list[RouteLeg]]:
        del request, num_alternatives
        return []

    def _compute_multimodal_suggestions(
        self, origin: LatLng, destination: LatLng
    ) -> list[MultimodalSuggestion]:
        graph = graph_service.get_graph()
        if graph is None or graph.number_of_nodes() == 0:
            return []

        origin_node = graph_service.get_nearest_node(origin.lat, origin.lng)
        dest_node = graph_service.get_nearest_node(destination.lat, destination.lng)
        if origin_node is None or dest_node is None:
            return []

        modes = list(settings.vehicle_types.keys())
        if not modes:
            return []

        suggestions: list[MultimodalSuggestion] = []

        # 1) Distance-optimal path, then best vehicle for each segment.
        try:
            dist_path = nx.shortest_path(
                graph,
                source=origin_node,
                target=dest_node,
                weight=lambda _u, _v, data: min(
                    max(float(edge.get("length") or 0.0), 0.01)
                    for edge in data.values()
                ),
                method="dijkstra",
            )
            dist_suggestion = self._build_suggestion_from_node_path(
                graph=graph,
                node_path=dist_path,
                strategy="shortest_distance",
            )
            suggestions.append(dist_suggestion)
        except Exception:
            pass

        # 2) Time-optimal path using (node, mode) state-space Dijkstra.
        try:
            switch_penalty = float(
                settings.mode_switch_penalties.get("default_penalty_seconds", 5.0)
            )
            time_result = multi_modal_dijkstra_with_coords(
                graph=graph,
                start=origin_node,
                end=dest_node,
                allowed_modes=modes,
                switch_penalty=switch_penalty,
            )
            if time_result and time_result.get("path"):
                segments: list[SegmentSuggestion] = []
                total_distance_m = 0.0
                total_duration_s = 0.0
                for idx, step in enumerate(time_result["path"]):
                    u = step["from"]
                    v = step["to"]
                    mode = step.get("mode") or "walk"
                    edge_data = self._best_edge_for_mode(graph, u, v, mode)
                    if not edge_data:
                        continue

                    distance_m = float(edge_data.get("length") or 0.0)
                    road_type = self._road_type(edge_data)
                    edge_geometry = self._edge_geometry_points(graph, u, v, edge_data)
                    options = self._vehicle_options_for_edge(edge_data)
                    seg_time = float(
                        edge_data.get(f"{mode}_travel_time")
                        or edge_data.get("travel_time")
                        or 0.0
                    )

                    segments.append(
                        SegmentSuggestion(
                            segment_index=idx,
                            distance_m=distance_m,
                            road_type=road_type,
                            recommended_vehicle=self._display_mode(mode),
                            geometry=edge_geometry,
                            vehicle_options=options,
                        )
                    )
                    total_distance_m += distance_m
                    total_duration_s += seg_time

                if segments:
                    suggestions.append(
                        MultimodalSuggestion(
                            strategy="fastest_time",
                            total_distance_m=total_distance_m,
                            total_duration_s=total_duration_s,
                            segments=segments,
                        )
                    )
        except Exception:
            pass

        return suggestions

    def _build_suggestion_from_node_path(
        self, graph: nx.MultiDiGraph, node_path: list, strategy: str
    ) -> MultimodalSuggestion:
        segments: list[SegmentSuggestion] = []
        total_distance_m = 0.0
        total_duration_s = 0.0

        for idx in range(len(node_path) - 1):
            u = node_path[idx]
            v = node_path[idx + 1]
            edge_data = self._best_edge_any(graph, u, v)
            if not edge_data:
                continue

            distance_m = float(edge_data.get("length") or 0.0)
            road_type = self._road_type(edge_data)
            edge_geometry = self._edge_geometry_points(graph, u, v, edge_data)
            options = self._vehicle_options_for_edge(edge_data)
            allowed_options = [o for o in options if o.allowed]
            if allowed_options:
                best = min(allowed_options, key=lambda o: o.travel_time_s)
                rec_mode = best.vehicle
                rec_time = best.travel_time_s
            else:
                rec_mode = "walk"
                rec_time = float(
                    edge_data.get("walk_travel_time")
                    or edge_data.get("travel_time")
                    or 0.0
                )

            segments.append(
                SegmentSuggestion(
                    segment_index=idx,
                    distance_m=distance_m,
                    road_type=road_type,
                    recommended_vehicle=self._display_mode(rec_mode),
                    geometry=edge_geometry,
                    vehicle_options=options,
                )
            )
            total_distance_m += distance_m
            total_duration_s += rec_time

        return MultimodalSuggestion(
            strategy=strategy,
            total_distance_m=total_distance_m,
            total_duration_s=total_duration_s,
            segments=segments,
        )

    def _best_edge_any(self, graph: nx.MultiDiGraph, u, v) -> dict:
        data = graph.get_edge_data(u, v) or {}
        if not data:
            return {}
        return min(
            data.values(),
            key=lambda e: max(float(e.get("length") or 0.0), 0.01),
        )

    def _best_edge_for_mode(self, graph: nx.MultiDiGraph, u, v, mode: str) -> dict:
        data = graph.get_edge_data(u, v) or {}
        if not data:
            return {}
        allowed = [e for e in data.values() if bool(e.get(f"{mode}_allowed", False))]
        pool = allowed or list(data.values())
        return min(
            pool,
            key=lambda e: max(
                float(e.get(f"{mode}_travel_time") or e.get("travel_time") or 0.0),
                0.01,
            ),
        )

    def _road_type(self, edge_data: dict) -> str:
        road = edge_data.get("road_type") or edge_data.get("highway") or "unknown"
        if isinstance(road, (list, tuple)):
            return str(road[0]) if road else "unknown"
        return str(road)

    def _vehicle_options_for_edge(self, edge_data: dict) -> list[VehicleOption]:
        options: list[VehicleOption] = []
        for mode in settings.vehicle_types.keys():
            allowed = bool(edge_data.get(f"{mode}_allowed", False))
            t = float(
                edge_data.get(f"{mode}_travel_time")
                or edge_data.get("travel_time")
                or 0.0
            )
            options.append(
                VehicleOption(
                    vehicle=self._display_mode(mode),
                    travel_time_s=t,
                    allowed=allowed,
                )
            )
        options.sort(key=lambda o: o.travel_time_s)
        return options

    async def _refresh_ml_weights(self):
        try:
            await ml_integration.refresh_predictions()
        except Exception as e:
            print(f"[RoutingEngine] ML weight refresh failed (using defaults): {e}")


routing_engine = RoutingEngine()
