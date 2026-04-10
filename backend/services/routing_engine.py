"""
Routing Engine — Single-Modal & Multi-Modal Path Computation
==============================================================
Computes shortest paths over the in-memory OSM road graph.
"""

from __future__ import annotations

from typing import Callable

import networkx as nx

from config import settings
from models.route_models import (
    RouteRequest, RouteResponse, RouteLeg, ModeSwitch, LatLng,
    VehicleOption, SegmentSuggestion, PathWithVehicleSuggestions
)
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

        # Compute multimodal vehicle suggestions for single-modal routes
        multimodal_suggestions = None
        if len(request.modes) == 1:
            try:
                multimodal_suggestions = await self._compute_multimodal_suggestions(
                    origin=request.origin,
                    destination=request.destination,
                )
            except Exception as e:
                print(f"[RoutingEngine] Multimodal suggestions failed: {e}")

        return RouteResponse(
            legs=legs,
            mode_switches=switches,
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
            raise ValueError(f"Unknown transport mode: '{mode}'. Available: {list(settings.vehicle_types.keys())}")

        if not graph_service.is_loaded():
            raise ValueError("Graph is not loaded yet. Please retry in a moment.")

        graph = graph_service.get_subgraph_for_mode(mode)
        if graph is None or graph.number_of_nodes() == 0:
            raise ValueError(f"No graph data available for mode '{mode}'.")

        # Snap both clicks to nearby routable nodes; choose the best connected pair.
        origin_candidates = graph_service.get_k_nearest_nodes_in_graph(graph, origin.lat, origin.lng, k=8)
        dest_candidates = graph_service.get_k_nearest_nodes_in_graph(graph, destination.lat, destination.lng, k=8)

        if not origin_candidates or not dest_candidates:
            raise ValueError("Could not snap origin/destination to graph.")

        weight_fn = self._build_weight_fn(mode, optimize)

        best_pair = None
        best_cost = float("inf")
        for o_node in origin_candidates:
            for d_node in dest_candidates:
                if o_node == d_node:
                    best_pair = (o_node, d_node)
                    best_cost = 0.0
                    break
                try:
                    cost = nx.shortest_path_length(
                        graph,
                        source=o_node,
                        target=d_node,
                        weight=weight_fn,
                        method="dijkstra",
                    )
                except nx.NetworkXNoPath:
                    continue

                if cost < best_cost:
                    best_cost = cost
                    best_pair = (o_node, d_node)
            if best_pair is not None and best_cost == 0.0:
                break

        if best_pair is None:
            raise ValueError(f"No path found between origin and destination for mode '{mode}'.")

        origin_node, dest_node = best_pair

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

        try:
            path = nx.shortest_path(graph, source=origin_node, target=dest_node, weight=weight_fn, method="dijkstra")
        except nx.NetworkXNoPath:
            raise ValueError(f"No path found between origin and destination for mode '{mode}'.")

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

    async def _compute_alternatives(self, request: RouteRequest, num_alternatives: int) -> list[list[RouteLeg]]:
        del request, num_alternatives
        return []

    async def _compute_multimodal_suggestions(
        self,
        origin: LatLng,
        destination: LatLng,
    ) -> list[PathWithVehicleSuggestions]:
        """
        Compute two routes with vehicle suggestions:
        1. Shortest distance route
        2. Fastest time route (optimal vehicle per segment)
        """
        all_modes = list(settings.vehicle_types.keys())
        full_graph = graph_service.get_full_graph()
        
        if full_graph is None or full_graph.number_of_nodes() == 0:
            raise ValueError("Graph not loaded")

        results: list[PathWithVehicleSuggestions] = []

        # Get candidate nodes for origin and destination
        origin_candidates = graph_service.get_k_nearest_nodes_in_graph(full_graph, origin.lat, origin.lng, k=8)
        dest_candidates = graph_service.get_k_nearest_nodes_in_graph(full_graph, destination.lat, destination.lng, k=8)

        if not origin_candidates or not dest_candidates:
            raise ValueError("Could not snap origin/destination to graph")

        # Try to find path using all available vehicles
        best_path_by_dist = None
        best_path_by_time = None
        best_o_node = None
        best_d_node = None

        for o_node in origin_candidates:
            for d_node in dest_candidates:
                if o_node == d_node:
                    best_path_by_dist = [o_node, d_node]
                    best_path_by_time = [o_node, d_node]
                    best_o_node = o_node
                    best_d_node = d_node
                    break

                # Try to find path in full graph (agnostic to mode restrictions initially)
                try:
                    path = nx.shortest_path(
                        full_graph,
                        source=o_node,
                        target=d_node,
                        weight=lambda u, v, d: 1,  # Unweighted
                        method="dijkstra",
                    )
                    if best_path_by_dist is None:
                        best_o_node = o_node
                        best_d_node = d_node
                        best_path_by_dist = path
                        best_path_by_time = path
                except nx.NetworkXNoPath:
                    continue

            if best_path_by_dist is not None and best_path_by_time is not None:
                break

        if best_path_by_dist is None or best_path_by_time is None:
            raise ValueError("No path found between origin and destination")

        # Compute shortest distance path with vehicle suggestions
        shortest_dist_path = await self._analyze_path_with_vehicles(
            path=best_path_by_dist,
            graph=full_graph,
            all_modes=all_modes,
            route_type="shortest_distance",
            optimize="distance",
        )
        results.append(shortest_dist_path)

        # Compute fastest time path with vehicle suggestions
        fastest_time_path = await self._analyze_path_with_vehicles(
            path=best_path_by_time,
            graph=full_graph,
            all_modes=all_modes,
            route_type="fastest_time",
            optimize="time",
        )
        results.append(fastest_time_path)

        return results

    async def _analyze_path_with_vehicles(
        self,
        path: list,
        graph: nx.MultiDiGraph,
        all_modes: list[str],
        route_type: str,
        optimize: str,
    ) -> PathWithVehicleSuggestions:
        """
        Analyze a path and compute vehicle suggestions for each segment.
        Returns a PathWithVehicleSuggestions object with vehicle options per edge.
        """
        segments: list[SegmentSuggestion] = []
        geometry: list[LatLng] = []
        total_distance_m = 0.0
        total_duration_s = 0.0

        # Process each edge in the path
        for seg_idx in range(len(path) - 1):
            u = path[seg_idx]
            v = path[seg_idx + 1]
            edge_data_multi = graph.get_edge_data(u, v) or {}

            if not edge_data_multi:
                continue

            # Use the best available edge key (if multiple parallel edges)
            best_edge_data = next(iter(edge_data_multi.values()))
            distance_m = float(best_edge_data.get("length") or 0.0)
            road_type = best_edge_data.get("highway")

            # Collect vehicle options for this segment
            vehicle_options: list[VehicleOption] = []
            best_vehicle = None
            best_time = float("inf")

            for mode in all_modes:
                # Check if this vehicle is allowed on this road type
                allowed_types = settings.vehicle_types.get(mode, {}).get("allowed_road_types", [])
                if road_type not in allowed_types:
                    continue

                # Calculate travel time for this vehicle
                travel_time_attr = f"{mode}_travel_time"
                vehicle_travel_time = float(best_edge_data.get(travel_time_attr) or best_edge_data.get("travel_time") or 0.0)

                if vehicle_travel_time == 0.0:
                    # Fall back to calculating from speed
                    default_speed_kmh = settings.vehicle_types.get(mode, {}).get("default_speed_kmh", 10)
                    speed_ms = default_speed_kmh / 3.6
                    vehicle_travel_time = distance_m / speed_ms if speed_ms > 0 else distance_m / 2.778  # ~10 kmh default

                vehicle_options.append(
                    VehicleOption(
                        vehicle=mode,
                        travel_time_s=vehicle_travel_time,
                        distance_m=distance_m,
                        is_recommended=False,
                    )
                )

                if vehicle_travel_time < best_time:
                    best_time = vehicle_travel_time
                    best_vehicle = mode

            # Set recommended vehicle
            for opt in vehicle_options:
                if opt.vehicle == best_vehicle:
                    opt.is_recommended = True

            if not vehicle_options and road_type:
                # If no vehicle is allowed, log it but try to add a fallback
                print(f"[Warning] No vehicles allowed on road type '{road_type}'")
                for mode in all_modes:
                    default_speed_kmh = settings.vehicle_types.get(mode, {}).get("default_speed_kmh", 10)
                    speed_ms = default_speed_kmh / 3.6
                    vehicle_travel_time = distance_m / speed_ms if speed_ms > 0 else distance_m / 2.778
                    vehicle_options.append(
                        VehicleOption(
                            vehicle=mode,
                            travel_time_s=vehicle_travel_time,
                            distance_m=distance_m,
                            is_recommended=(mode == "walk"),  # Default to walk if no info
                        )
                    )
                    best_vehicle = "walk"

            # Sort vehicle options by travel time
            vehicle_options.sort(key=lambda x: x.travel_time_s)

            recommended_vehicle = best_vehicle or (vehicle_options[0].vehicle if vehicle_options else "car")

            # Add segment suggestion
            segment = SegmentSuggestion(
                segment_index=seg_idx,
                from_node=str(u),
                to_node=str(v),
                distance_m=distance_m,
                road_type=road_type,
                vehicle_options=vehicle_options,
                recommended_vehicle=recommended_vehicle,
            )
            segments.append(segment)

            # Accumulate geometry
            edge_points = self._edge_geometry_points(graph, u, v, best_edge_data)
            if geometry and edge_points:
                if geometry[-1].lat == edge_points[0].lat and geometry[-1].lng == edge_points[0].lng:
                    geometry.extend(edge_points[1:])
                else:
                    geometry.extend(edge_points)
            else:
                geometry.extend(edge_points)

            total_distance_m += distance_m
            if best_vehicle:
                for opt in vehicle_options:
                    if opt.vehicle == best_vehicle:
                        total_duration_s += opt.travel_time_s
                        break

        if len(geometry) < 2:
            geometry = [LatLng(lat=path[0] if isinstance(path[0], float) else 0, lng=path[1] if isinstance(path[1], float) else 0)]

        return PathWithVehicleSuggestions(
            route_type=route_type,
            total_distance_m=total_distance_m,
            total_duration_s=total_duration_s,
            geometry=geometry,
            segments=segments,
        )

    async def _refresh_ml_weights(self):
        try:
            await ml_integration.refresh_predictions()
        except Exception as e:
            print(f"[RoutingEngine] ML weight refresh failed (using defaults): {e}")


routing_engine = RoutingEngine()
