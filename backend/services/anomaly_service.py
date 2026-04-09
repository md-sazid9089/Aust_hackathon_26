"""
Anomaly Service — Real-Time Anomaly Ingestion & Dynamic Rerouting
===================================================================
Handles the lifecycle of traffic anomalies:
  1. Ingest: Accept anomaly reports, validate, store in active list
  2. Apply: Modify affected edge weights in the graph using severity multipliers
  3. Expire: Automatically remove old anomalies and restore edge weights
  4. Query: Return list of currently active anomalies

Integration:
  - Called by routes/anomaly.py for ingestion and querying
  - Calls graph_service to modify/reset edge weights
  - Read by routing_engine to decide if rerouting is needed
  - Severity multipliers come from config.json → anomaly.weight_multipliers
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from config import settings
from models.anomaly_models import AnomalyReport, ActiveAnomaly
from services.graph_service import graph_service


class AnomalyService:
    """
    Singleton service for anomaly lifecycle management.
    Anomalies are stored in-memory (suitable for hackathon/demo scope).
    """

    def __init__(self):
        # In-memory store of active anomalies keyed by anomaly_id
        self._active: dict[str, ActiveAnomaly] = {}
        # Config references
        self._multipliers = settings.anomaly_config.get("weight_multipliers", {})
        self._default_expire = settings.anomaly_config.get("auto_expire_minutes", 60)
        self._reroute_threshold = settings.anomaly_config.get("reroute_on_severity", "medium")

    # ─── Ingest ──────────────────────────────────────────────────

    async def ingest(self, report: AnomalyReport) -> str:
        """
        Process a new anomaly report:
          1. Validate severity level
          2. Resolve affected graph edges from location
          3. Apply weight multiplier to affected edges
          4. Store anomaly with expiry time
          5. Return anomaly_id

        Raises ValueError for invalid severity or location.
        """
        # Validate severity
        valid_severities = settings.anomaly_config.get("severity_levels", [])
        if report.severity not in valid_severities:
            raise ValueError(
                f"Invalid severity '{report.severity}'. Must be one of: {valid_severities}"
            )

        # Generate unique ID
        anomaly_id = f"anomaly_{uuid.uuid4().hex[:12]}"

        # Resolve affected edges from location
        affected_edges = self._resolve_edges(report)

        # Get weight multiplier for this severity
        multiplier = self._multipliers.get(report.severity, 1.0)

        # Apply weight modification to graph edges
        for edge_id in affected_edges:
            self._apply_weight_multiplier(edge_id, multiplier)

        # Calculate expiry
        duration = report.duration_minutes or self._default_expire
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=duration)

        # Store active anomaly
        active = ActiveAnomaly(
            anomaly_id=anomaly_id,
            location=report.location,
            severity=report.severity,
            type=report.type,
            description=report.description,
            affected_edges=affected_edges,
            weight_multiplier=multiplier,
            created_at=now,
            expires_at=expires_at,
        )
        self._active[anomaly_id] = active

        print(
            f"[AnomalyService] Ingested {anomaly_id}: "
            f"severity={report.severity}, edges={len(affected_edges)}, "
            f"multiplier={multiplier}x, expires={expires_at.isoformat()}"
        )

        return anomaly_id

    # ─── Query ───────────────────────────────────────────────────

    async def get_active(self) -> list[ActiveAnomaly]:
        """
        Return all currently active anomalies.
        Automatically prunes expired anomalies before returning.
        """
        self._prune_expired()
        return list(self._active.values())

    def is_rerouting_needed(self) -> bool:
        """
        Check if any active anomaly has severity >= reroute threshold.
        Used by routing_engine to decide if rerouting logic should activate.
        """
        severity_order = {"low": 0, "medium": 1, "high": 2, "critical": 3}
        threshold = severity_order.get(self._reroute_threshold, 1)

        for anomaly in self._active.values():
            if severity_order.get(anomaly.severity, 0) >= threshold:
                return True
        return False

    def get_anomaly_edges(self) -> set[str]:
        """Return set of all edge IDs currently affected by anomalies."""
        self._prune_expired()
        edges = set()
        for anomaly in self._active.values():
            edges.update(anomaly.affected_edges)
        return edges

    # ─── Edge Resolution ─────────────────────────────────────────

    def _resolve_edges(self, report: AnomalyReport) -> list[str]:
        """
        Resolve the anomaly location to a list of affected graph edge IDs.

        TODO: Implement:
          - If report.location.edge_id is set, use it directly
          - If lat/lng is set, find nearest edge(s) using graph_service
          - For wildcard edge_id "*", affect all edges (weather scenario)
        """
        if report.location.edge_id:
            if report.location.edge_id == "*":
                # Wildcard: affects all edges (e.g., weather)
                # TODO: return list of all edge IDs from graph_service
                return ["*"]
            return [report.location.edge_id]

        # TODO: Use graph_service to find nearest edge by lat/lng
        # nearest_node = graph_service.get_nearest_node(report.location.lat, report.location.lng)
        # Find edges connected to nearest_node
        return []

    # ─── Weight Application ──────────────────────────────────────

    def _apply_weight_multiplier(self, edge_id: str, multiplier: float):
        """
        Apply the severity-based weight multiplier to an edge.

        TODO: Parse edge_id into source/target and call:
          graph_service.update_edge_weight(source, target, multiplier)
        """
        # STUB: In production, parse edge_id and update graph
        print(f"[AnomalyService] Applying {multiplier}x multiplier to edge {edge_id}")

    def _reset_edge_weight(self, edge_id: str):
        """
        Reset an edge's weight after anomaly expiry.

        TODO: Parse edge_id into source/target and call:
          graph_service.reset_edge_weight(source, target)
        """
        # STUB: In production, parse edge_id and reset graph
        print(f"[AnomalyService] Resetting edge weight for {edge_id}")

    # ─── Expiry ──────────────────────────────────────────────────

    def _prune_expired(self):
        """
        Remove anomalies past their expiry time and restore edge weights.
        Called before every query to keep the active list clean.
        """
        now = datetime.now(timezone.utc)
        expired_ids = [
            aid for aid, anomaly in self._active.items()
            if anomaly.expires_at <= now
        ]

        for aid in expired_ids:
            anomaly = self._active.pop(aid)
            # Restore edge weights
            for edge_id in anomaly.affected_edges:
                self._reset_edge_weight(edge_id)
            print(f"[AnomalyService] Expired anomaly {aid}")


# ─── Singleton Instance ──────────────────────────────────────────
anomaly_service = AnomalyService()
