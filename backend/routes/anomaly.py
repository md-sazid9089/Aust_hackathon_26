"""
Anomaly Endpoint — POST /anomaly & GET /anomaly
=================================================
Handles ingestion of real-time traffic anomalies (accidents, closures,
weather events) and retrieval of active anomalies.

Integration:
  - Validates input via models/anomaly_models.py
  - Delegates to services/anomaly_service.py for storage and graph weight updates
  - Anomaly service modifies edge weights in services/graph_service.py
    so that subsequent routing calls automatically avoid/de-prioritize
    affected edges
"""

from fastapi import APIRouter, HTTPException

from models.anomaly_models import AnomalyReport, AnomalyListResponse
from services.anomaly_service import anomaly_service

router = APIRouter()


@router.post("", status_code=201)
async def report_anomaly(report: AnomalyReport):
    """
    Ingest a new traffic anomaly.

    Body:
      - location: { lat, lng } or edge_id
      - severity: "low" | "medium" | "high" | "critical"
      - type: "accident" | "closure" | "congestion" | "weather" | "construction"
      - description: optional human-readable description
      - duration_minutes: estimated duration (default: from config auto_expire)

    The anomaly service will:
      1. Store the anomaly in the active anomaly list
      2. Update the affected edges' weights in the graph using the
         severity multiplier from config.json
      3. If severity >= reroute_on_severity, flag for dynamic rerouting
    """
    try:
        anomaly_id = await anomaly_service.ingest(report)
        return {"anomaly_id": anomaly_id, "status": "accepted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=AnomalyListResponse)
async def list_anomalies():
    """
    Return all currently active anomalies.
    Expired anomalies are automatically pruned.
    """
    active = await anomaly_service.get_active()
    return AnomalyListResponse(anomalies=active, count=len(active))
