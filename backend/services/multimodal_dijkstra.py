"""
Multi-Modal Dijkstra Engine — (node, mode) State-Space Routing
================================================================
Implements the spec's core algorithm: a Dijkstra variant where the
state space is (current_node, current_mode) instead of just (node).

This allows:
  - Traversing different transport modes on the same graph
  - Applying mode-switch penalties during traversal (not just between legs)
  - Respecting per-mode edge constraints (car_allowed, rickshaw_allowed, etc.)
  - O(V log V) optimized via heapq

Design Rules:
  ✔ Never route through restricted edges
  ✔ Always apply mode switch penalty
  ✔ Use OSM as base truth layer
  ✔ Modify only weights dynamically (not structure)
  ✔ Ensure O(V log V) optimized Dijkstra
  ✔ Return actual road geometry (not straight lines)
  ✔ Guard against negative / zero weights

FIXES APPLIED (audit):
  - Replaced O(n) path-copy-per-push with predecessor map (O(1) per push)
  - Added negative weight guard (clamps to 0.01)
  - Added road geometry extraction from OSM edge 'geometry' attribute
  - geometry now follows real road curves, not straight node-to-node lines
"""

import heapq
import math
from typing import Optional


# Default mode switch penalty (seconds) if not specified
DEFAULT_SWITCH_PENALTY = 5

# Minimum edge cost to prevent zero/negative weight issues
MIN_EDGE_COST = 0.01


def multi_modal_dijkstra(
    graph,
    start,
    end,
    allowed_modes: list[str],
    switch_penalty: float = DEFAULT_SWITCH_PENALTY,
) -> Optional[dict]:
    """
    Compute the optimal multi-modal route using (node, mode) state space.

    Uses a predecessor map instead of copying paths per heap entry,
    giving true O((V+E) log V) performance on large OSM graphs.

    Args:
        graph: NetworkX MultiDiGraph with edges containing 'weights' and 'constraints' dicts
        start: Source node ID
        end:   Destination node ID
        allowed_modes: List of transport modes to consider (e.g. ["car", "rickshaw", "walk"])
        switch_penalty: Cost penalty for switching between modes (seconds)

    Returns:
        dict with:
          - cost: total traversal cost
          - path: list of step dicts {from, to, mode}
          - node_path: ordered list of node IDs
        Returns None if no path exists.
    """
    if start == end:
        return {"cost": 0, "path": [], "node_path": [start]}

    if not graph.has_node(start) or not graph.has_node(end):
        return None

    # Priority queue: (cost, counter, node, mode)
    # counter breaks ties for heapq stability
    pq = []
    counter = 0

    # Predecessor map: (node, mode) -> (prev_node, prev_mode, edge_mode_used)
    predecessors = {}

    # Best cost seen: (node, mode) -> cost
    best_cost = {}

    # Seed: start with no mode (None) — first edge pick is free
    heapq.heappush(pq, (0.0, counter, start, None))
    counter += 1
    best_cost[(start, None)] = 0.0

    while pq:
        cost, _, node, mode = heapq.heappop(pq)

        # Reached destination — reconstruct path from predecessors
        if node == end:
            return _reconstruct_path(predecessors, start, end, mode, cost)

        state = (node, mode)

        # Skip if we've already settled this state with a cheaper cost
        if cost > best_cost.get(state, float("inf")):
            continue

        # Explore all neighbors via outgoing edges
        for neighbor in graph.successors(node):
            edge_data_dict = graph.get_edge_data(node, neighbor)
            if not edge_data_dict:
                continue

            # Pick the best parallel edge (lowest key)
            edge_data = next(iter(edge_data_dict.values()))

            weights = edge_data.get("weights", {})
            constraints = edge_data.get("constraints", {})

            for next_mode in allowed_modes:
                # ✔ Never route through restricted edges
                if not constraints.get(f"{next_mode}_allowed", True):
                    continue

                # Get traversal cost for this mode
                edge_cost = weights.get(next_mode)
                if edge_cost is None:
                    edge_cost = float(
                        edge_data.get(f"{next_mode}_travel_time")
                        or edge_data.get("travel_time")
                        or edge_data.get("length", 1)
                    )

                # ✔ Guard against negative/zero weights
                edge_cost = max(float(edge_cost), MIN_EDGE_COST)

                # ✔ Mode switch penalty
                extra_penalty = 0.0
                if mode is not None and mode != next_mode:
                    extra_penalty = switch_penalty

                new_cost = cost + edge_cost + extra_penalty

                neighbor_state = (neighbor, next_mode)
                if new_cost < best_cost.get(neighbor_state, float("inf")):
                    best_cost[neighbor_state] = new_cost
                    predecessors[neighbor_state] = (node, mode, next_mode)
                    heapq.heappush(pq, (new_cost, counter, neighbor, next_mode))
                    counter += 1

    # No path found
    return None


def _reconstruct_path(
    predecessors: dict,
    start,
    end,
    end_mode,
    total_cost: float,
) -> dict:
    """Reconstruct the path from predecessor map — O(path_length)."""
    path = []
    node_path = []
    current_state = (end, end_mode)

    while current_state in predecessors:
        prev_node, prev_mode, edge_mode = predecessors[current_state]
        current_node = current_state[0]
        path.append({
            "from": prev_node,
            "to": current_node,
            "mode": edge_mode,
        })
        node_path.append(current_node)
        current_state = (prev_node, prev_mode)

    # Add start node
    node_path.append(start)
    path.reverse()
    node_path.reverse()

    return {
        "cost": total_cost,
        "path": path,
        "node_path": node_path,
    }


def _extract_edge_road_geometry(graph, from_node, to_node) -> list[list[float]]:
    """
    Extract the ACTUAL road geometry from an OSM edge.

    OSMnx stores Shapely LineString geometry objects on edges that represent
    the real road shape (curves, bends). If no geometry attribute exists,
    fall back to straight node-to-node line.

    This is THE fix for the straight-line bug.
    """
    edge_data_dict = graph.get_edge_data(from_node, to_node)
    if not edge_data_dict:
        # Fallback: straight line
        fd = graph.nodes.get(from_node, {})
        td = graph.nodes.get(to_node, {})
        return [
            [float(fd.get("y", 0.0)), float(fd.get("x", 0.0))],
            [float(td.get("y", 0.0)), float(td.get("x", 0.0))],
        ]

    edge_data = next(iter(edge_data_dict.values()))
    geom = edge_data.get("geometry")

    # If the edge has an OSM geometry (Shapely LineString), use its coordinates
    if geom is not None and hasattr(geom, "coords"):
        points = []
        for x, y in list(geom.coords):
            points.append([float(y), float(x)])  # lat, lng
        if len(points) >= 2:
            return points

    # Fallback: straight node-to-node
    fd = graph.nodes.get(from_node, {})
    td = graph.nodes.get(to_node, {})
    return [
        [float(fd.get("y", 0.0)), float(fd.get("x", 0.0))],
        [float(td.get("y", 0.0)), float(td.get("x", 0.0))],
    ]


def multi_modal_dijkstra_with_coords(
    graph,
    start,
    end,
    allowed_modes: list[str],
    switch_penalty: float = DEFAULT_SWITCH_PENALTY,
) -> Optional[dict]:
    """
    Same as multi_modal_dijkstra but enriches the path with:
      - lat/lng coordinates on each step
      - Full road geometry following actual OSM road shapes (not straight lines)
      - node_path: ordered list of node IDs

    Returns:
        dict with:
          - cost: total traversal cost
          - path: list of step dicts with coordinates
          - node_path: ordered list of node IDs
          - geometry: list of [lat, lng] points following real roads
    """
    result = multi_modal_dijkstra(graph, start, end, allowed_modes, switch_penalty)
    if result is None:
        return None

    geometry = []
    enriched_path = []

    for step in result["path"]:
        from_node = step["from"]
        to_node = step["to"]

        from_data = graph.nodes.get(from_node, {})
        to_data = graph.nodes.get(to_node, {})

        from_lat = float(from_data.get("y", 0.0))
        from_lng = float(from_data.get("x", 0.0))
        to_lat = float(to_data.get("y", 0.0))
        to_lng = float(to_data.get("x", 0.0))

        enriched_step = {
            **step,
            "from_lat": from_lat,
            "from_lng": from_lng,
            "to_lat": to_lat,
            "to_lng": to_lng,
        }
        enriched_path.append(enriched_step)

        # ✔ Use REAL road geometry, not straight lines
        edge_points = _extract_edge_road_geometry(graph, from_node, to_node)

        if geometry and edge_points:
            # Avoid duplicating the junction point
            last = geometry[-1]
            first_new = edge_points[0]
            if (
                abs(last[0] - first_new[0]) < 1e-8
                and abs(last[1] - first_new[1]) < 1e-8
            ):
                geometry.extend(edge_points[1:])
            else:
                geometry.extend(edge_points)
        else:
            geometry.extend(edge_points)

    return {
        "cost": result["cost"],
        "path": enriched_path,
        "node_path": result.get("node_path", []),
        "geometry": geometry,
    }
