# backend/routes/__init__.py
"""
Routes Package
===============
Each module in this package defines a FastAPI APIRouter for a specific
endpoint group. Routers are mounted in main.py.

Modules:
  - health.py  → GET /health
  - route.py   → POST /route
  - anomaly.py → POST /anomaly, GET /anomaly
  - graph.py   → GET /graph/snapshot
"""
