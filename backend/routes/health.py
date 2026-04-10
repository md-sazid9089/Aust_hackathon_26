"""
Health Check Route
===================
Provides a simple GET /health endpoint to verify that the backend is
running and the graph is loaded.

Used by:
  - Docker health checks
  - Frontend connection verification
  - Load balancer probes
"""

from fastapi import APIRouter


from services.graph_service import graph_service
from db import check_db_connection

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Returns service status and basic graph statistics.
    If the graph is not loaded, returns a degraded status.
    """
    graph_loaded = graph_service.is_loaded()
    db_connected = check_db_connection()
    return {
        "status": "healthy" if graph_loaded and db_connected else "degraded",
        "service": "GoliTransit API",
        "version": "0.1.0",
        "graph": {
            "loaded": graph_loaded,
            "nodes": graph_service.node_count() if graph_loaded else 0,
            "edges": graph_service.edge_count() if graph_loaded else 0,
        },
        "database": {"connected": db_connected},
    }
