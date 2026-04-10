"""
GoliTransit Backend — Application Entry Point
================================================
This is the main FastAPI application file. It:
  1. Initializes the FastAPI app with CORS middleware
  2. Mounts all route modules (/health, /route, /anomaly, /graph)
  3. Triggers graph loading on startup via lifespan events

All business logic lives in the `services/` layer — routes are thin
wrappers that validate input, delegate to services, and return responses.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes import health, route, anomaly, graph
from routes.v2 import router as v2_router
from services.graph_service import graph_service


# ─── Lifespan: load the road graph once at startup ───────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    On startup: load the OSM road graph into memory so all routing
    requests can use it without re-downloading.
    On shutdown: clean up resources.
    """
    print("[startup] Loading road graph...")
    graph_service.load_graph()
    print(f"[startup] Graph loaded — {graph_service.node_count()} nodes, {graph_service.edge_count()} edges")
    yield
    print("[shutdown] Cleaning up resources...")


# ─── App Initialization ──────────────────────────────────────────
app = FastAPI(
    title="GoliTransit API",
    description="Multi-modal hyper-local routing engine with real-time anomaly handling and ML-based congestion prediction.",
    version="0.1.0",
    lifespan=lifespan,
)

# ─── CORS (allow frontend dev server) ────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Mount Routers ───────────────────────────────────────────────
# Each router is defined in its own file under routes/
app.include_router(health.router, tags=["Health"])
app.include_router(route.router, prefix="/route", tags=["Routing"])
app.include_router(anomaly.router, prefix="/anomaly", tags=["Anomaly"])
app.include_router(graph.router, prefix="/graph", tags=["Graph"])
app.include_router(v2_router, prefix="/v2", tags=["V2 — Multi-Modal Dijkstra"])
