"""
Graph Service — OSM Import & NetworkX Graph Management
========================================================
Responsible for loading and serving the in-memory road graph.
"""

from __future__ import annotations

import math
from typing import Optional

import networkx as nx
import osmnx as ox

from config import settings
from models.graph_models import GraphSnapshot, GraphNode, GraphEdge


def _first_highway_value(highway: object) -> str:
    if isinstance(highway, list) and highway:
        return str(highway[0])
    if isinstance(highway, str):
        return highway
    return "unknown"


def _parse_maxspeed_kmh(maxspeed: object) -> Optional[float]:
    if maxspeed is None:
        return None
    if isinstance(maxspeed, list) and maxspeed:
        maxspeed = maxspeed[0]
    text = str(maxspeed).strip().lower()
    if not text:
        return None

    number = "".join(ch for ch in text if (ch.isdigit() or ch == "."))
    if not number:
        return None

    try:
        value = float(number)
    except ValueError:
        return None

    if "mph" in text:
        return value * 1.60934
    return value


def _fallback_speed_for_road(road_type: str) -> float:
    major = {"motorway", "trunk", "primary"}
    secondary = {"secondary", "tertiary"}
    small = {"residential", "service", "unclassified", "road", "living_street", "path", "track", "footway", "cycleway"}

    if road_type in major:
        return 50.0
    if road_type in secondary:
        return 35.0
    if road_type in small:
        return 20.0
    return 30.0


class GraphService:
    """Singleton service managing the in-memory road graph."""

    def __init__(self):
        self._graph: Optional[nx.MultiDiGraph] = None
        self._loaded = False

    def load_graph(self, location: Optional[str] = None):
        """Download/load OSM graph and normalize edge attributes for routing."""
        location = location or settings.osm_location
        print(f"[GraphService] Loading graph for: {location}")

        graph: Optional[nx.MultiDiGraph] = None

        try:
            if "dhaka" in location.lower():
                # Keep the map focused around Dhaka/AUST area to match the frontend UX.
                graph = ox.graph_from_point(
                    center_point=(23.7639, 90.4066),
                    dist=12000,
                    network_type=settings.network_type,
                    simplify=settings.simplify_graph,
                )
            else:
                graph = ox.graph_from_place(
                    location,
                    network_type=settings.network_type,
                    simplify=settings.simplify_graph,
                )
        except Exception as e:
            if "dhaka" not in location.lower():
                # Fallback to Dhaka if configured place fails.
                print(f"[GraphService] Failed to load '{location}', falling back to Dhaka: {e}")
                graph = ox.graph_from_point(
                    center_point=(23.7639, 90.4066),
                    dist=12000,
                    network_type=settings.network_type,
                    simplify=settings.simplify_graph,
                )
            else:
                raise RuntimeError(f"Failed to load OSM graph for '{location}': {e}") from e

        if graph is None:
            raise RuntimeError("Graph load failed: no graph returned")

        self._graph = graph
        self._normalize_edge_attributes()
        self._loaded = True
        print(f"[GraphService] Graph loaded — {self.node_count()} nodes, {self.edge_count()} edges")

    def _normalize_edge_attributes(self):
        if not self._graph:
            return

        for _, _, _, data in self._graph.edges(keys=True, data=True):
            length_m = float(data.get("length") or 0.0)
            road_type = _first_highway_value(data.get("highway"))
            maxspeed_kmh = _parse_maxspeed_kmh(data.get("maxspeed")) or _fallback_speed_for_road(road_type)
            base_travel_time_s = length_m / (maxspeed_kmh / 3.6) if maxspeed_kmh > 0 else 1.0

            data["length"] = length_m
            data["road_type"] = road_type
            data["speed_limit_kmh"] = maxspeed_kmh
            data["travel_time"] = base_travel_time_s
            data["base_travel_time"] = base_travel_time_s
            data["anomaly_multiplier"] = 1.0
            data["ml_predicted"] = False

            for mode, mode_cfg in settings.vehicle_types.items():
                allowed_road_types = set(mode_cfg.get("allowed_road_types", []))
                mode_speed = float(mode_cfg.get("default_speed_kmh", maxspeed_kmh) or maxspeed_kmh)
                mode_allowed = road_type in allowed_road_types
                mode_time_s = length_m / (mode_speed / 3.6) if mode_speed > 0 else base_travel_time_s

                data[f"{mode}_allowed"] = mode_allowed
                data[f"{mode}_travel_time"] = mode_time_s

    def is_loaded(self) -> bool:
        return self._loaded

    def node_count(self) -> int:
        if not self._loaded or self._graph is None:
            return 0
        return self._graph.number_of_nodes()

    def edge_count(self) -> int:
        if not self._loaded or self._graph is None:
            return 0
        return self._graph.number_of_edges()

    def get_nearest_node(self, lat: float, lng: float):
        """Manual nearest-node search to avoid optional KDTree dependencies."""
        if not self._graph:
            return None

        best_node = None
        best_dist_sq = float("inf")

        for node_id, node_data in self._graph.nodes(data=True):
            y = node_data.get("y")
            x = node_data.get("x")
            if y is None or x is None:
                continue

            d_lat = float(y) - lat
            d_lng = float(x) - lng
            dist_sq = d_lat * d_lat + d_lng * d_lng
            if dist_sq < best_dist_sq:
                best_dist_sq = dist_sq
                best_node = node_id

        return best_node

    def get_subgraph_for_mode(self, mode: str):
        if not self._graph:
            return None

        mode_flag = f"{mode}_allowed"
        edges = [
            (u, v, k)
            for u, v, k, data in self._graph.edges(keys=True, data=True)
            if bool(data.get(mode_flag, False))
        ]

        if not edges:
            return nx.MultiDiGraph()

        return self._graph.edge_subgraph(edges).copy()

    def update_edge_weight(self, source: str, target: str, multiplier: float):
        if not self._graph:
            return

        if self._graph.has_edge(source, target):
            for key in self._graph[source][target]:
                edge_data = self._graph[source][target][key]
                base = float(edge_data.get("base_travel_time") or edge_data.get("travel_time") or 0.0)
                edge_data["travel_time"] = base * multiplier
                edge_data["anomaly_multiplier"] = multiplier

    def reset_edge_weight(self, source: str, target: str):
        if not self._graph:
            return

        if self._graph.has_edge(source, target):
            for key in self._graph[source][target]:
                edge_data = self._graph[source][target][key]
                edge_data["travel_time"] = float(edge_data.get("base_travel_time") or edge_data.get("travel_time") or 0.0)
                edge_data["anomaly_multiplier"] = 1.0

    def set_ml_predicted_weight(self, source: str, target: str, predicted_time: float):
        if not self._graph:
            return

        if self._graph.has_edge(source, target):
            for key in self._graph[source][target]:
                edge_data = self._graph[source][target][key]
                edge_data["travel_time"] = float(predicted_time)
                edge_data["ml_predicted"] = True

    def get_snapshot(self, include_edges: bool = False, bbox: Optional[tuple] = None) -> GraphSnapshot:
        if not self._graph:
            return GraphSnapshot(node_count=0, edge_count=0, nodes=[], edges=[], anomaly_affected_edges=[])

        nodes: list[GraphNode] = []
        edges: list[GraphEdge] = []
        anomaly_affected_edges: list[str] = []

        south, west, north, east = (bbox or (None, None, None, None))

        def in_bbox(lat: float, lng: float) -> bool:
            if bbox is None:
                return True
            return south <= lat <= north and west <= lng <= east

        for node_id, data in self._graph.nodes(data=True):
            lat = float(data.get("y") or 0.0)
            lng = float(data.get("x") or 0.0)
            if in_bbox(lat, lng):
                nodes.append(GraphNode(id=str(node_id), lat=lat, lng=lng))

        if include_edges:
            for u, v, _, data in self._graph.edges(keys=True, data=True):
                u_data = self._graph.nodes.get(u, {})
                v_data = self._graph.nodes.get(v, {})
                u_lat, u_lng = float(u_data.get("y") or 0.0), float(u_data.get("x") or 0.0)
                v_lat, v_lng = float(v_data.get("y") or 0.0), float(v_data.get("x") or 0.0)

                if not (in_bbox(u_lat, u_lng) or in_bbox(v_lat, v_lng)):
                    continue

                edge_id = f"{u}->{v}"
                multiplier = float(data.get("anomaly_multiplier") or 1.0)
                if not math.isclose(multiplier, 1.0):
                    anomaly_affected_edges.append(edge_id)

                edges.append(
                    GraphEdge(
                        source=str(u),
                        target=str(v),
                        length_m=float(data.get("length") or 0.0),
                        travel_time_s=float(data.get("travel_time") or 0.0),
                        base_travel_time_s=float(data.get("base_travel_time") or 0.0),
                        road_type=str(data.get("road_type") or "unknown"),
                        speed_limit_kmh=float(data.get("speed_limit_kmh")) if data.get("speed_limit_kmh") is not None else None,
                        anomaly_multiplier=multiplier,
                        ml_predicted=bool(data.get("ml_predicted") or False),
                    )
                )

        bbox_list = list(bbox) if bbox is not None else None
        return GraphSnapshot(
            node_count=self.node_count(),
            edge_count=self.edge_count(),
            nodes=nodes,
            edges=edges,
            anomaly_affected_edges=anomaly_affected_edges,
            bbox=bbox_list,
        )


graph_service = GraphService()
