"""
GoliTransit Backend — Application Entry Point
================================================
This is the main FastAPI application file. It:
  1. Initializes the FastAPI app with CORS middleware
  2. Creates database tables on startup
  3. Mounts all route modules (/health, /auth, /route, /anomaly, /graph)
  4. Triggers graph loading on startup via lifespan events

All business logic lives in the `services/` layer — routes are thin
wrappers that validate input, delegate to services, and return responses.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import engine, Base
from models import user_models, traffic_models  # noqa: F401
from routes import health, auth, route, anomaly, graph, traffic
from routes.v2 import router as v2_router
from services.graph_service import graph_service
from services.traffic_jam_service import traffic_jam_service

# When TESTING=1 (or "true") is set, skip heavy startup work (OSM graph load,
# ML model training) so the test suite runs fast and without network access.
_TESTING = os.environ.get("TESTING", "").lower() in ("1", "true", "yes")


# ─── Lifespan: load the road graph once at startup ───────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    On startup:
      - Create database tables if they don't exist
      - Load the OSM road graph into memory (skipped when TESTING=1)
    On shutdown: clean up resources.
    """
    print("[startup] Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("[startup] Database tables created/verified")

    if _TESTING:
        # Test-mode bypass: skip OSM graph loading and ML initialization to
        # avoid real network calls and keep tests fast and deterministic.
        print("[startup] TESTING mode — skipping graph load and ML initialization")
    else:
        print("[startup] Loading road graph...")
        graph_service.load_graph()
        print(
            f"[startup] Graph loaded — {graph_service.node_count()} nodes, {graph_service.edge_count()} edges"
        )

        print("[startup] Building dummy traffic dataset and training jam model...")
        traffic_jam_service.initialize_from_graph(graph_service.get_graph())
        print("[startup] Traffic jam model ready")
        await traffic_jam_service.start_workers()
        print("[startup] Traffic workers started")

    yield
    print("[shutdown] Cleaning up resources...")
    await traffic_jam_service.stop_workers()


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
app.include_router(auth.router, tags=["Authentication"])
app.include_router(route.router, prefix="/route", tags=["Routing"])
app.include_router(traffic.router, prefix="/traffic", tags=["Traffic"])
app.include_router(anomaly.router, prefix="/anomaly", tags=["Anomaly"])
app.include_router(graph.router, prefix="/graph", tags=["Graph"])
app.include_router(v2_router, prefix="/v2", tags=["V2 — Multi-Modal Dijkstra"])
