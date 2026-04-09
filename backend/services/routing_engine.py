"""
Routing Engine — Single-Modal & Multi-Modal Path Computation
==============================================================
The heart of GoliTransit. Computes optimal routes across the road graph
for one or more transport modes.

Single-Modal Flow:
  1. Resolve origin/destination to nearest graph nodes
  2. Extract mode-specific subgraph (only allowed road types)
  3. Run shortest-path algorithm (Dijkstra by default)
  4. Build RouteLeg with geometry, distance, duration

Multi-Modal Flow:
  1. For each mode in the sequence, compute a single-modal leg
  2. At mode-switch boundaries, find transfer points within
     transfer_radius_meters of the previous leg's endpoint
  3. Apply mode-switch penalties (time + cost) from config.json
  4. Return all legs + mode switches + aggregated totals

Integration:
  - Uses graph_service for graph access and nearest-node lookups
  - Uses ml_integration to fetch ML-predicted edge weights before routing
  - Uses anomaly_service to check if dynamic rerouting is needed
  - Called by routes/route.py
"""

from typing import Optional

# TODO: import networkx as nx for actual pathfinding
# import networkx as nx

from config import settings
from models.route_models import (
    RouteRequest,
    RouteResponse,
    RouteLeg,
    ModeSwitch,
    LatLng,
)
from services.graph_service import graph_service
from services.ml_integration import ml_integration
from services.anomaly_service import anomaly_service


class RoutingEngine:
    """
    Singleton routing engine service.
    Supports single-modal (one mode) and multi-modal (sequence of modes) routing.
    """

    def __init__(self):
        self._algorithm = settings.routing_algorithm  # "dijkstra" | "astar"
        self._weight_attr = settings.weight_attribute  # "travel_time"
        self._max_alts = settings.max_alternatives
        self._max_transfers = settings.multimodal_max_transfers
        self._transfer_radius = settings.transfer_radius_meters

    # ─── Public API ──────────────────────────────────────────────

    async def compute(self, request: RouteRequest) -> RouteResponse:
        """
        Main entry point: compute a route based on the request.

        Steps:
          1. Optionally refresh ML-predicted edge weights
          2. Dispatch to single-modal or multi-modal handler
          3. Optionally compute alternative routes
          4. Build and return RouteResponse
        """
        # Step 1: Refresh ML predictions for affected edges (non-blocking best-effort)
        await self._refresh_ml_weights()

        # Step 2: Compute primary route
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

        # Step 3: Aggregate totals
        total_dist = sum(leg.distance_m for leg in legs)
        total_dur = sum(leg.duration_s for leg in legs)
        total_dur += sum(sw.penalty_time_s for sw in switches)
        total_cost = sum(leg.cost for leg in legs)
        total_cost += sum(sw.penalty_cost for sw in switches)

        # Step 4: Compute alternatives if requested
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

    # ─── Single-Modal ────────────────────────────────────────────

    async def _single_modal(
        self,
        origin: LatLng,
        destination: LatLng,
        mode: str,
        optimize: str,
        avoid_anomalies: bool,
    ) -> tuple[list[RouteLeg], list[ModeSwitch], int]:
        """
        Compute a single-modal route.

        TODO: Implement with NetworkX:
          1. origin_node = graph_service.get_nearest_node(origin.lat, origin.lng)
          2. dest_node   = graph_service.get_nearest_node(destination.lat, destination.lng)
          3. subgraph    = graph_service.get_subgraph_for_mode(mode)
          4. path        = nx.shortest_path(subgraph, origin_node, dest_node, weight=self._weight_attr)
          5. Build RouteLeg from path nodes/edges
        """
        # Validate mode
        if mode not in settings.vehicle_types:
            raise ValueError(f"Unknown transport mode: '{mode}'. Available: {list(settings.vehicle_types.keys())}")

        # STUB: Return empty leg (placeholder for NetworkX pathfinding)
        leg = RouteLeg(
            mode=mode,
            geometry=[origin, destination],  # Straight line placeholder
            distance_m=0.0,
            duration_s=0.0,
            cost=0.0,
            instructions=[
                f"Start at ({origin.lat}, {origin.lng})",
                f"Proceed via {mode} to ({destination.lat}, {destination.lng})",
            ],
        )
        return [leg], [], 0

    # ─── Multi-Modal ─────────────────────────────────────────────

    async def _multi_modal(
        self,
        origin: LatLng,
        destination: LatLng,
        modes: list[str],
        optimize: str,
        avoid_anomalies: bool,
    ) -> tuple[list[RouteLeg], list[ModeSwitch], int]:
        """
        Compute a multi-modal route with mode transfers.

        TODO: Implement:
          1. For each consecutive mode pair, find a transfer point
          2. Route each leg independently via _single_modal
          3. Build ModeSwitch objects at transfer points using
             settings.mode_switch_penalties for time/cost penalties
          4. Transfer points are found by searching for nodes within
             transfer_radius_meters of the previous leg's endpoint
        """
        legs: list[RouteLeg] = []
        switches: list[ModeSwitch] = []
        total_anomalies_avoided = 0

        # Current position starts at origin
        current_pos = origin

        for i, mode in enumerate(modes):
            # Determine this leg's destination
            if i == len(modes) - 1:
                leg_dest = destination
            else:
                # STUB: In production, find transfer point within radius
                # For now, use a midpoint approximation
                leg_dest = self._find_transfer_point(current_pos, destination, i, len(modes))

            # Compute single-modal leg
            leg_legs, _, avoided = await self._single_modal(
                origin=current_pos,
                destination=leg_dest,
                mode=mode,
                optimize=optimize,
                avoid_anomalies=avoid_anomalies,
            )
            legs.extend(leg_legs)
            total_anomalies_avoided += avoided

            # Add mode switch if not the last mode
            if i < len(modes) - 1:
                next_mode = modes[i + 1]
                penalty_key = f"{mode}_to_{next_mode}"
                penalty = settings.mode_switch_penalties.get(penalty_key, {})

                switches.append(ModeSwitch(
                    from_mode=mode,
                    to_mode=next_mode,
                    location=leg_dest,
                    penalty_time_s=penalty.get("time_seconds", 0),
                    penalty_cost=penalty.get("cost_units", 0),
                ))

            current_pos = leg_dest

        return legs, switches, total_anomalies_avoided

    # ─── Transfer Points ─────────────────────────────────────────

    def _find_transfer_point(
        self,
        current: LatLng,
        destination: LatLng,
        leg_index: int,
        total_legs: int,
    ) -> LatLng:
        """
        Find a suitable transfer point between two modes.

        TODO: Implement proper transfer-point search:
          1. Get all nodes within transfer_radius_meters of candidates
          2. Score candidates by proximity to both current leg end and next leg efficiency
          3. Prefer nodes near transit stops for transit modes

        STUB: Returns a linear interpolation point along the route.
        """
        fraction = (leg_index + 1) / total_legs
        mid_lat = current.lat + (destination.lat - current.lat) * fraction
        mid_lng = current.lng + (destination.lng - current.lng) * fraction
        return LatLng(lat=mid_lat, lng=mid_lng)

    # ─── Alternative Routes ──────────────────────────────────────

    async def _compute_alternatives(
        self,
        request: RouteRequest,
        num_alternatives: int,
    ) -> list[list[RouteLeg]]:
        """
        Compute alternative routes by penalizing edges in the primary route
        and re-running pathfinding.

        TODO: Implement with NetworkX:
          1. For each alternative, temporarily increase weights on primary path edges
          2. Re-run shortest path
          3. Restore original weights
          Uses Yen's k-shortest-paths or penalty-based approach.
        """
        # STUB: Return empty alternatives
        return []

    # ─── ML Weight Refresh ───────────────────────────────────────

    async def _refresh_ml_weights(self):
        """
        Ask the ML integration service to update edge weights with
        current predictions. This is a best-effort operation — if the
        ML service is down, we fall back to base weights.

        Called before each route computation to ensure fresh predictions.
        """
        try:
            await ml_integration.refresh_predictions()
        except Exception as e:
            # Non-fatal: ML predictions are optional
            print(f"[RoutingEngine] ML weight refresh failed (using defaults): {e}")


# ─── Singleton Instance ──────────────────────────────────────────
routing_engine = RoutingEngine()
