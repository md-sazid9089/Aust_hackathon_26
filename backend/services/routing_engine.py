"""
Routing Engine — Single-Modal & Multi-Modal Path Computation
==============================================================
Computes shortest paths over the in-memory OSM road graph.
"""

from __future__ import annotations

import math
import time
from collections import OrderedDict
from typing import Callable

import networkx as nx

from config import settings
from models.route_models import (
    RouteRequest,
    RouteResponse,
    RouteLeg,
    RouteTrafficEdge,
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
from services.traffic_jam_service import traffic_jam_service


class RoutingEngine:
    """Singleton routing engine service."""

    def __init__(self):
        self._algorithm = settings.routing_algorithm
        self._weight_attr = settings.weight_attribute
        self._max_alts = settings.max_alternatives
        self._max_transfers = settings.multimodal_max_transfers
        self._transfer_radius = settings.transfer_radius_meters
        self._shortest_tree_cache: OrderedDict[tuple, tuple[dict, dict, float]] = (
            OrderedDict()
        )
        self._shortest_tree_cache_max = 256
        self._route_response_cache: OrderedDict[tuple, tuple[RouteResponse, float]] = (
            OrderedDict()
        )
        self._route_response_cache_max = 512
        self._route_response_ttl_s = 90.0

    def _normalize_mode(self, mode: str) -> str:
        if mode == "bus":
            return "transit"
        return mode

    def _display_mode(self, mode: str) -> str:
        return self._normalize_mode(mode)

    def _current_graph_version(self) -> int:
        getter = getattr(graph_service, "get_graph_version", None)
        if callable(getter):
            try:
                return int(getter())
            except Exception:
                return 0
        return 0

    def _clone_response(self, response: RouteResponse) -> RouteResponse:
        if hasattr(response, "model_copy"):
            return response.model_copy(deep=True)
        return response.copy(deep=True)

    def _route_cache_key(
        self,
        request: RouteRequest,
        origin_anchor,
        destination_anchor,
    ) -> tuple:
        return (
            tuple(request.modes),
            str(request.optimize),
            bool(request.avoid_anomalies),
            int(request.max_alternatives or self._max_alts),
            bool(getattr(request, "include_multimodal", False)),
            origin_anchor,
            destination_anchor,
            self._current_graph_version(),
        )

    def _route_cache_get(self, key: tuple) -> RouteResponse | None:
        entry = self._route_response_cache.get(key)
        if entry is None:
            return None
        response, ts = entry
        if (time.monotonic() - ts) > self._route_response_ttl_s:
            self._route_response_cache.pop(key, None)
            return None
        self._route_response_cache.move_to_end(key)
        return self._clone_response(response)

    def _route_cache_set(self, key: tuple, response: RouteResponse):
        self._route_response_cache[key] = (
            self._clone_response(response),
            time.monotonic(),
        )
        self._route_response_cache.move_to_end(key)
        while len(self._route_response_cache) > self._route_response_cache_max:
            self._route_response_cache.popitem(last=False)

    def _tree_cache_key(
        self,
        graph: nx.MultiDiGraph,
        origin_node,
        mode: str,
        optimize: str,
    ) -> tuple:
        return (
            self._current_graph_version(),
            id(graph),
            bool(graph.is_directed()),
            mode,
            optimize,
            origin_node,
        )

    def _get_shortest_path_tree(
        self,
        graph: nx.MultiDiGraph,
        origin_node,
        mode: str,
        optimize: str,
    ) -> tuple[dict, dict] | tuple[None, None]:
        key = self._tree_cache_key(graph, origin_node, mode, optimize)
        cached = self._shortest_tree_cache.get(key)
        if cached is not None:
            lengths, paths, _ts = cached
            self._shortest_tree_cache.move_to_end(key)
            return lengths, paths

        weight_fn = self._build_weight_fn(mode, optimize)
        try:
            lengths, paths = nx.single_source_dijkstra(
                graph,
                source=origin_node,
                weight=weight_fn,
            )
        except Exception:
            return None, None

        self._shortest_tree_cache[key] = (lengths, paths, time.monotonic())
        self._shortest_tree_cache.move_to_end(key)
        while len(self._shortest_tree_cache) > self._shortest_tree_cache_max:
            self._shortest_tree_cache.popitem(last=False)

        return lengths, paths

    def _pick_best_path_from_tree(
        self,
        lengths: dict,
        paths: dict,
        destination_candidates: list,
    ) -> tuple[object | None, list | None, float]:
        best_dest = None
        best_path = None
        best_cost = float("inf")
        for dest_node in destination_candidates:
            if dest_node not in lengths:
                continue
            candidate_path = paths.get(dest_node)
            if not candidate_path or len(candidate_path) < 2:
                continue
            candidate_cost = float(lengths[dest_node])
            if candidate_cost < best_cost:
                best_cost = candidate_cost
                best_dest = dest_node
                best_path = candidate_path
        return best_dest, best_path, best_cost

    async def compute(self, request: RouteRequest) -> RouteResponse:
        await self._refresh_ml_weights()
        anomaly_service.sync_active_effects()

        request.modes = [self._normalize_mode(m) for m in request.modes]

        full_graph = graph_service.get_graph()
        origin_candidates_hint: list = []
        destination_candidates_hint: list = []
        origin_anchor = None
        destination_anchor = None

        if full_graph is not None and full_graph.number_of_nodes() > 0:
            origin_candidates_hint = graph_service.get_k_nearest_nodes_in_graph(
                full_graph,
                request.origin.lat,
                request.origin.lng,
                k=8,
            )
            destination_candidates_hint = graph_service.get_k_nearest_nodes_in_graph(
                full_graph,
                request.destination.lat,
                request.destination.lng,
                k=8,
            )
            if origin_candidates_hint:
                origin_anchor = origin_candidates_hint[0]
            if destination_candidates_hint:
                destination_anchor = destination_candidates_hint[0]

        cache_key = self._route_cache_key(request, origin_anchor, destination_anchor)
        cached_response = self._route_cache_get(cache_key)
        if cached_response is not None:
            return cached_response

        if len(request.modes) == 1:
            legs, switches, anomalies_avoided = await self._single_modal(
                origin=request.origin,
                destination=request.destination,
                mode=request.modes[0],
                optimize=request.optimize,
                avoid_anomalies=request.avoid_anomalies,
                origin_candidates_hint=origin_candidates_hint,
                destination_candidates_hint=destination_candidates_hint,
            )
        else:
            legs, switches, anomalies_avoided = await self._multi_modal(
                origin=request.origin,
                destination=request.destination,
                modes=request.modes,
                optimize=request.optimize,
                avoid_anomalies=request.avoid_anomalies,
                origin_candidates_hint=origin_candidates_hint,
                destination_candidates_hint=destination_candidates_hint,
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

        all_traffic_edges: list[dict] = []
        for leg in legs:
            all_traffic_edges.extend(
                [
                    {
                        "edge_id": e.edge_id,
                        "road_type": e.road_type,
                        "length_m": e.length_m,
                    }
                    for e in leg.traffic_edges
                ]
            )
        traffic_prediction = traffic_jam_service.predict_route_jam(
            all_traffic_edges,
            hour_of_day=request.traffic_hour_of_day,
        )

        response = RouteResponse(
            legs=[
                RouteLeg(
                    mode=self._display_mode(leg.mode),
                    geometry=leg.geometry,
                    distance_m=leg.distance_m,
                    duration_s=leg.duration_s,
                    cost=leg.cost,
                    instructions=leg.instructions,
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
            traffic_jam_prediction=traffic_prediction,
        )

        self._route_cache_set(cache_key, response)
        return response

    async def _single_modal(
        self,
        origin: LatLng,
        destination: LatLng,
        mode: str,
        optimize: str,
        avoid_anomalies: bool,
        origin_candidates_hint: list | None = None,
        destination_candidates_hint: list | None = None,
    ) -> tuple[list[RouteLeg], list[ModeSwitch], int]:
        del avoid_anomalies  # Placeholder until anomaly filtering is added.

        if mode not in settings.vehicle_types:
            raise ValueError(
                f"Unknown transport mode: '{mode}'. Available: {list(settings.vehicle_types.keys())}"
            )

        if not graph_service.is_loaded():
            # Graph not loaded yet - return synthetic route
            leg = self._build_synthetic_leg(mode, origin, destination)
            return [leg], [], 0

        graph = graph_service.get_subgraph_for_mode(mode)
        if graph is None or graph.number_of_nodes() == 0:
            # No graph data for this mode - return synthetic route
            leg = self._build_synthetic_leg(mode, origin, destination)
            return [leg], [], 0

        if origin_candidates_hint:
            origin_candidates = [n for n in origin_candidates_hint if n in graph]
        else:
            origin_candidates = []

        if destination_candidates_hint:
            dest_candidates = [n for n in destination_candidates_hint if n in graph]
        else:
            dest_candidates = []

        if not origin_candidates:
            origin_candidates = graph_service.get_k_nearest_nodes_in_graph(
                graph, origin.lat, origin.lng, k=8
            )
        if not dest_candidates:
            dest_candidates = graph_service.get_k_nearest_nodes_in_graph(
                graph, destination.lat, destination.lng, k=8
            )

        if not origin_candidates or not dest_candidates:
            leg = self._build_synthetic_leg(mode, origin, destination)
            return [leg], [], 0

        def _find_best_path(candidate_graph, max_origins: int = 2):
            best_pair = None
            best_path = None
            best_cost = float("inf")
            origins_to_try = origin_candidates[: max(1, int(max_origins))]
            for origin_node in origins_to_try:
                lengths, paths = self._get_shortest_path_tree(
                    candidate_graph,
                    origin_node,
                    mode,
                    optimize,
                )
                if lengths is None or paths is None:
                    continue

                dest_node, path, cost = self._pick_best_path_from_tree(
                    lengths,
                    paths,
                    dest_candidates,
                )
                if path and cost < best_cost:
                    best_cost = cost
                    best_pair = (origin_node, dest_node)
                    best_path = path
            return best_pair, best_path

        routing_graph = graph
        best_pair, best_path = _find_best_path(routing_graph, max_origins=2)

        # For walking/bike/rickshaw/bus-like traversal, one-way directionality can
        # make reachable roads appear disconnected. Retry on undirected topology
        # before falling back to synthetic geometry.
        if best_path is None:
            routing_graph = graph.to_undirected(as_view=True)
            best_pair, best_path = _find_best_path(routing_graph, max_origins=3)

        if best_path is None:
            # If the points are essentially colocated, return a zero-length leg.
            if (
                self._haversine_distance_m(
                    origin.lat, origin.lng, destination.lat, destination.lng
                )
                < 12.0
            ):
                leg = RouteLeg(
                    mode=mode,
                    geometry=[origin],
                    distance_m=0.0,
                    duration_s=0.0,
                    cost=0.0,
                    instructions=[
                        "Origin and destination are at the same location.",
                    ],
                )
                return [leg], [], 0
            leg = self._build_synthetic_leg(mode, origin, destination)
            return [leg], [], 0

        origin_node, dest_node = best_pair
        path = best_path
        if path is None:
            # No path found in graph - return synthetic direct route
            leg = self._build_synthetic_leg(mode, origin, destination)
            return [leg], [], 0

        if len(path) < 2:
            # Degenerate graph path - return synthetic direct route
            leg = self._build_synthetic_leg(mode, origin, destination)
            return [leg], [], 0

        geometry: list[LatLng] = []
        traffic_edges: list[RouteTrafficEdge] = []
        total_distance_m = 0.0
        total_duration_s = 0.0
        weight_fn = self._build_weight_fn(mode, optimize)

        for i in range(len(path) - 1):
            u = path[i]
            v = path[i + 1]
            edge_data = self._best_edge_data(routing_graph, u, v, weight_fn)
            total_distance_m += float(edge_data.get("length") or 0.0)
            total_duration_s += float(
                edge_data.get(f"{mode}_travel_time")
                or edge_data.get("travel_time")
                or 0.0
            )
            chosen_key = edge_data.get("_key")
            if chosen_key is None:
                chosen_key = 0
            traffic_edges.append(
                RouteTrafficEdge(
                    edge_id=f"{u}->{v}:{chosen_key}",
                    road_type=self._road_type(edge_data),
                    length_m=float(edge_data.get("length") or 0.0),
                )
            )

            edge_points = self._edge_geometry_points(routing_graph, u, v, edge_data)
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
            # Degenerate geometry from graph edges - return synthetic direct route
            leg = self._build_synthetic_leg(mode, origin, destination)
            return [leg], [], 0

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
            traffic_edges=traffic_edges,
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
        origin_candidates_hint: list | None = None,
        destination_candidates_hint: list | None = None,
    ) -> tuple[list[RouteLeg], list[ModeSwitch], int]:
        graph = graph_service.get_graph()
        if graph is not None and graph.number_of_nodes() > 0:
            origin_node = None
            dest_node = None

            if origin_candidates_hint:
                for node_id in origin_candidates_hint:
                    if node_id in graph:
                        origin_node = node_id
                        break
            if destination_candidates_hint:
                for node_id in destination_candidates_hint:
                    if node_id in graph:
                        dest_node = node_id
                        break

            if origin_node is None:
                origin_node = graph_service.get_nearest_node(origin.lat, origin.lng)
            if dest_node is None:
                dest_node = graph_service.get_nearest_node(
                    destination.lat, destination.lng
                )

            allowed_modes = list(dict.fromkeys(modes))
            switch_penalty = float(
                settings.mode_switch_penalties.get("default_penalty_seconds", 5.0)
            )

            if origin_node is not None and dest_node is not None and allowed_modes:
                try:
                    result = multi_modal_dijkstra_with_coords(
                        graph=graph,
                        start=origin_node,
                        end=dest_node,
                        allowed_modes=allowed_modes,
                        switch_penalty=switch_penalty,
                    )
                    if result and result.get("path"):
                        built = self._build_multimodal_from_state_path(
                            graph=graph,
                            origin=origin,
                            destination=destination,
                            path_steps=result["path"],
                        )
                        built_legs, _built_switches, _built_avoided = built
                        requested_modes = [self._normalize_mode(m) for m in modes]
                        built_modes = [leg.mode for leg in built_legs]
                        if built_modes == requested_modes:
                            return built
                except Exception:
                    pass

        return await self._multi_modal_sequential(
            origin=origin,
            destination=destination,
            modes=modes,
            optimize=optimize,
            avoid_anomalies=avoid_anomalies,
            origin_candidates_hint=origin_candidates_hint,
            destination_candidates_hint=destination_candidates_hint,
        )

    async def _multi_modal_sequential(
        self,
        origin: LatLng,
        destination: LatLng,
        modes: list[str],
        optimize: str,
        avoid_anomalies: bool,
        origin_candidates_hint: list | None = None,
        destination_candidates_hint: list | None = None,
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
                origin_candidates_hint=(origin_candidates_hint if i == 0 else None),
                destination_candidates_hint=(
                    destination_candidates_hint if i == len(modes) - 1 else None
                ),
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

    def _build_multimodal_from_state_path(
        self,
        graph: nx.MultiDiGraph,
        origin: LatLng,
        destination: LatLng,
        path_steps: list[dict],
    ) -> tuple[list[RouteLeg], list[ModeSwitch], int]:
        legs: list[RouteLeg] = []
        switches: list[ModeSwitch] = []

        if not path_steps:
            return legs, switches, 0

        current_mode = None
        current_geometry: list[LatLng] = []
        current_distance_m = 0.0
        current_duration_s = 0.0
        current_traffic_edges: list[RouteTrafficEdge] = []

        def _finalize_leg(mode_name: str):
            nonlocal current_geometry, current_distance_m, current_duration_s, current_traffic_edges
            if not current_geometry:
                return
            cost_per_km = float(
                settings.vehicle_types.get(mode_name, {}).get("fuel_cost_per_km", 0.0)
                or 0.0
            )
            leg_cost = (current_distance_m / 1000.0) * cost_per_km
            start_pt = current_geometry[0]
            end_pt = current_geometry[-1]
            legs.append(
                RouteLeg(
                    mode=mode_name,
                    geometry=list(current_geometry),
                    distance_m=current_distance_m,
                    duration_s=current_duration_s,
                    cost=leg_cost,
                    traffic_edges=list(current_traffic_edges),
                    instructions=[
                        f"Start at ({start_pt.lat:.5f}, {start_pt.lng:.5f})",
                        f"Follow the shortest {mode_name} route on roads",
                        f"Arrive at ({end_pt.lat:.5f}, {end_pt.lng:.5f})",
                    ],
                )
            )
            current_geometry = []
            current_distance_m = 0.0
            current_duration_s = 0.0
            current_traffic_edges = []

        for step in path_steps:
            u = step.get("from")
            v = step.get("to")
            step_mode = self._normalize_mode(step.get("mode") or "walk")

            if current_mode is None:
                current_mode = step_mode
            elif step_mode != current_mode:
                _finalize_leg(current_mode)
                switch_loc = LatLng(
                    lat=float(graph.nodes.get(u, {}).get("y") or 0.0),
                    lng=float(graph.nodes.get(u, {}).get("x") or 0.0),
                )
                penalty_key = f"{current_mode}_to_{step_mode}"
                penalty = settings.mode_switch_penalties.get(penalty_key, {})
                switches.append(
                    ModeSwitch(
                        from_mode=current_mode,
                        to_mode=step_mode,
                        location=switch_loc,
                        penalty_time_s=float(penalty.get("time_seconds", 0.0) or 0.0),
                        penalty_cost=float(penalty.get("cost_units", 0.0) or 0.0),
                    )
                )
                current_mode = step_mode

            edge_data = self._best_edge_for_mode(graph, u, v, step_mode)
            if not edge_data:
                edge_data = self._best_edge_any(graph, u, v)
            if not edge_data:
                continue

            current_distance_m += float(edge_data.get("length") or 0.0)
            current_duration_s += float(
                edge_data.get(f"{step_mode}_travel_time")
                or edge_data.get("travel_time")
                or 0.0
            )

            current_traffic_edges.append(
                RouteTrafficEdge(
                    edge_id=f"{u}->{v}:0",
                    road_type=self._road_type(edge_data),
                    length_m=float(edge_data.get("length") or 0.0),
                )
            )

            edge_points = self._edge_geometry_points(graph, u, v, edge_data)
            if current_geometry and edge_points:
                if (
                    current_geometry[-1].lat == edge_points[0].lat
                    and current_geometry[-1].lng == edge_points[0].lng
                ):
                    current_geometry.extend(edge_points[1:])
                else:
                    current_geometry.extend(edge_points)
            else:
                current_geometry.extend(edge_points)

        if current_mode is not None:
            _finalize_leg(current_mode)

        if legs:
            first_leg = legs[0]
            if first_leg.geometry:
                first_leg.instructions[0] = (
                    f"Start at ({origin.lat:.5f}, {origin.lng:.5f})"
                )

            last_leg = legs[-1]
            if last_leg.geometry:
                last_leg.instructions[-1] = (
                    f"Arrive at ({destination.lat:.5f}, {destination.lng:.5f})"
                )

        return legs, switches, 0

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
        best_edge = (
            data[best_key] if best_key is not None else next(iter(data.values()))
        )
        if best_key is not None:
            best_edge = dict(best_edge)
            best_edge["_key"] = best_key
        return best_edge

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
