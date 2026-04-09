"""
Graph Service — OSM Import & NetworkX Graph Management
========================================================
Responsible for:
  1. Downloading/loading road network data from OpenStreetMap via OSMnx
  2. Building a multi-layered NetworkX graph with attributes
  3. Providing graph query methods (nearest node, subgraph, snapshot)
  4. Exposing methods for anomaly_service to modify edge weights

Integration:
  - Called by main.py lifespan to load graph on startup
  - Called by routing_engine.py to access the graph for pathfinding
  - Called by anomaly_service.py to update edge weights dynamically
  - Called by routes/graph.py to generate graph snapshots

The graph is stored as a NetworkX MultiDiGraph with edge attributes:
  - length (meters), travel_time (seconds), road_type (OSM highway tag)
  - base_travel_time (immutable copy), anomaly_multiplier (default 1.0)
  - ml_predicted (bool, whether ML predicted the travel_time)
"""

from typing import Optional

# TODO: Replace stubs with actual OSMnx and NetworkX implementation
# import osmnx as ox
# import networkx as nx

from config import settings
from models.graph_models import GraphSnapshot, GraphNode, GraphEdge


class GraphService:
    """
    Singleton service managing the in-memory road graph.
    """

    def __init__(self):
        self._graph = None  # Will be a NetworkX MultiDiGraph
        self._loaded = False

    # ─── Lifecycle ───────────────────────────────────────────────

    def load_graph(self, location: Optional[str] = None):
        """
        Download the road network from OSM and build the NetworkX graph.

        TODO: Implement with OSMnx:
          G = ox.graph_from_place(location, network_type=settings.network_type)
          G = ox.add_edge_speeds(G)
          G = ox.add_edge_travel_times(G)
          Store base_travel_time as immutable copy of travel_time.
        """
        location = location or settings.osm_location
        print(f"[GraphService] Loading graph for: {location}")

        # STUB: Create an empty placeholder graph
        # In production, use:
        #   self._graph = ox.graph_from_place(location, network_type=settings.network_type, simplify=settings.simplify_graph)
        #   self._graph = ox.add_edge_speeds(self._graph)
        #   self._graph = ox.add_edge_travel_times(self._graph)
        self._graph = {}  # Placeholder
        self._loaded = True
        print("[GraphService] Graph loaded (stub mode)")

    def is_loaded(self) -> bool:
        return self._loaded

    # ─── Query Methods ───────────────────────────────────────────

    def node_count(self) -> int:
        """Return the number of nodes in the graph."""
        if not self._loaded:
            return 0
        # TODO: return self._graph.number_of_nodes()
        return 0  # Stub

    def edge_count(self) -> int:
        """Return the number of edges in the graph."""
        if not self._loaded:
            return 0
        # TODO: return self._graph.number_of_edges()
        return 0  # Stub

    def get_nearest_node(self, lat: float, lng: float) -> Optional[str]:
        """
        Find the nearest graph node to the given coordinates.

        TODO: Implement with OSMnx:
          return ox.nearest_nodes(self._graph, lng, lat)
        """
        # STUB
        return None

    def get_subgraph_for_mode(self, mode: str):
        """
        Return a subgraph containing only edges allowed for the given
        transport mode (based on road types in config.json vehicle_types).

        TODO: Filter edges by road_type based on settings.vehicle_types[mode]["allowed_road_types"]
        """
        # STUB
        return self._graph

    # ─── Weight Modification (for anomalies) ─────────────────────

    def update_edge_weight(self, source: str, target: str, multiplier: float):
        """
        Multiply the travel_time of an edge by the given anomaly multiplier.
        Stores the multiplier in the edge's anomaly_multiplier attribute.

        Called by anomaly_service when a new anomaly is ingested.
        """
        # TODO: Implement
        #   edge_data = self._graph[source][target][0]
        #   edge_data["travel_time"] = edge_data["base_travel_time"] * multiplier
        #   edge_data["anomaly_multiplier"] = multiplier
        pass

    def reset_edge_weight(self, source: str, target: str):
        """
        Reset an edge's travel_time to its base value (anomaly expired).
        """
        # TODO: Implement
        #   edge_data = self._graph[source][target][0]
        #   edge_data["travel_time"] = edge_data["base_travel_time"]
        #   edge_data["anomaly_multiplier"] = 1.0
        pass

    def set_ml_predicted_weight(self, source: str, target: str, predicted_time: float):
        """
        Set an edge's travel_time to an ML-predicted value.
        Called by ml_integration service.
        """
        # TODO: Implement
        #   edge_data = self._graph[source][target][0]
        #   edge_data["travel_time"] = predicted_time
        #   edge_data["ml_predicted"] = True
        pass

    # ─── Snapshot ─────────────────────────────────────────────────

    def get_snapshot(self, include_edges: bool = False, bbox: Optional[tuple] = None) -> GraphSnapshot:
        """
        Build a GraphSnapshot for the /graph/snapshot endpoint.

        TODO: Iterate over graph nodes/edges, apply bbox filter,
              collect anomaly-affected edges.
        """
        # STUB: Return empty snapshot
        return GraphSnapshot(
            node_count=self.node_count(),
            edge_count=self.edge_count(),
            nodes=[],
            edges=[],
            anomaly_affected_edges=[],
        )


# ─── Singleton Instance ──────────────────────────────────────────
graph_service = GraphService()
