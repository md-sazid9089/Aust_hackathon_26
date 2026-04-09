# GoliTransit — Extended Architecture Documentation

## Overview

GoliTransit is a **multi-modal hyper-local routing engine** built as a hackathon project. It computes optimal routes across multiple transport modes (car, bike, walk, transit) with real-time anomaly handling and ML-based congestion prediction.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Leaflet)                   │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  MapView   │  │ RoutePanel  │  │ AnomalyAlert │  │ModeSelect │ │
│  └─────┬──────┘  └──────┬──────┘  └──────┬───────┘  └─────┬─────┘ │
│        └─────────────────┴───────────────┴─────────────────┘       │
│                              │ REST API (Axios)                     │
└──────────────────────────────┼──────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI → port 8000)                    │
│                                                                      │
│  Routes:  /health  │  /route  │  /anomaly  │  /graph/snapshot        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐        │
│  │                    Services Layer                         │        │
│  │  ┌────────────┐ ┌──────────────┐ ┌────────────────────┐  │        │
│  │  │  Routing   │ │   Anomaly    │ │  ML Integration    │  │        │
│  │  │  Engine    │ │   Service    │ │  (HTTP client)     │  │        │
│  │  └─────┬──────┘ └──────┬───────┘ └────────┬───────────┘  │        │
│  │        │               │                   │              │        │
│  │  ┌─────▼───────────────▼───────────────────▼──────────┐   │        │
│  │  │            Graph Service (NetworkX)                 │   │        │
│  │  │   OSM Import → Multi-Layer Road Graph → Weights    │   │        │
│  │  └────────────────────────────────────────────────────┘   │        │
│  └──────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────┘
                               │ HTTP (port 8001)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     ML MODULE (FastAPI → port 8001)                   │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌──────────────────┐   │
│  │Preprocess│→ │  Train    │→ │  Model    │→ │  Predict API     │   │
│  │  (OSM +  │  │(sklearn / │  │ Registry  │  │  POST /predict   │   │
│  │ traffic) │  │ TF stubs) │  │           │  │  GET  /health    │   │
│  └──────────┘  └───────────┘  └───────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Route Computation Flow

```
User clicks map → MapPage sets origin/destination
     │
     ▼
RoutePanel "Compute" → routeService.computeRoute()
     │
     ▼ POST /route
Backend routes/route.py → routing_engine.compute()
     │
     ├─→ ml_integration.refresh_predictions()
     │        │
     │        ▼ POST http://ml:8001/predict
     │        ML predict.py → returns predicted edge times
     │        │
     │        ▼
     │   graph_service.set_ml_predicted_weight() (updates graph)
     │
     ├─→ graph_service.get_nearest_node() (resolve coordinates)
     ├─→ graph_service.get_subgraph_for_mode() (filter road types)
     ├─→ networkx.shortest_path() (Dijkstra / A*)
     │
     ▼
RouteResponse → frontend renders polyline on MapView
```

### Anomaly Handling Flow

```
External event → POST /anomaly
     │
     ▼
routes/anomaly.py → anomaly_service.ingest()
     │
     ├─→ Validate severity against config thresholds
     ├─→ Resolve location → affected edge IDs
     ├─→ Apply weight multiplier to graph edges
     ├─→ Store in active anomaly list with expiry
     │
     ▼
Subsequent /route calls → routing_engine automatically
avoids high-weight edges (anomaly-affected)
```

---

## Key Design Decisions

### 1. In-Memory Graph (NetworkX)

The road graph is loaded from OSM into a NetworkX `MultiDiGraph` at startup and lives in memory for the duration of the process. This is fast for hackathon scope but wouldn't scale to production traffic. Edge attributes include:

| Attribute | Type | Description |
|---|---|---|
| `length` | float | Physical length in meters |
| `travel_time` | float | Current estimated traversal time (mutable) |
| `base_travel_time` | float | Immutable copy of original travel time |
| `road_type` | str | OSM highway tag |
| `anomaly_multiplier` | float | Current anomaly weight (default 1.0) |
| `ml_predicted` | bool | Whether travel_time uses ML prediction |

### 2. Multi-Modal Routing

Multi-modal routes are built as a sequence of single-modal legs. Transfer points between modes are found by searching for nodes within `transfer_radius_meters` (config) of the previous leg's endpoint. Mode switch penalties (time + cost) come from `config.json.mode_switch_penalties`.

### 3. ML Module Isolation

The ML module runs as a separate microservice (port 8001) to:
- Keep data science dependencies separate from the backend
- Allow independent scaling/updates of the model
- Enable easy A/B testing of different models

The backend talks to it via HTTP (`ml_integration.py → httpx`). If the ML service is down, it falls back to base graph weights (`ml.fallback_to_default = true`).

### 4. Anomaly Severity Multipliers

Anomalies modify edge weights using severity-based multipliers from config:
- `low: 1.2x` — Minor slowdown
- `medium: 1.8x` — Noticeable delay
- `high: 3.0x` — Major delay
- `critical: 999999` — Effectively blocked

This makes Dijkstra naturally route around affected areas without needing separate rerouting logic.

---

## API Reference

### `GET /health`

Returns service health and graph statistics.

```json
{
  "status": "healthy",
  "service": "GoliTransit API",
  "version": "0.1.0",
  "graph": { "loaded": true, "nodes": 15234, "edges": 22891 }
}
```

### `POST /route`

Compute a single-modal or multi-modal route.

**Request:**
```json
{
  "origin": { "lat": 37.7749, "lng": -122.4194 },
  "destination": { "lat": 37.7849, "lng": -122.4094 },
  "modes": ["walk", "transit", "walk"],
  "optimize": "time",
  "avoid_anomalies": true,
  "max_alternatives": 2
}
```

**Response:**
```json
{
  "legs": [
    { "mode": "walk", "geometry": [...], "distance_m": 320, "duration_s": 230, "cost": 0 },
    { "mode": "transit", "geometry": [...], "distance_m": 2100, "duration_s": 420, "cost": 2.50 },
    { "mode": "walk", "geometry": [...], "distance_m": 150, "duration_s": 108, "cost": 0 }
  ],
  "mode_switches": [
    { "from_mode": "walk", "to_mode": "transit", "penalty_time_s": 60 },
    { "from_mode": "transit", "to_mode": "walk", "penalty_time_s": 60 }
  ],
  "total_distance_m": 2570,
  "total_duration_s": 878,
  "total_cost": 2.50,
  "anomalies_avoided": 1,
  "alternatives": []
}
```

### `POST /anomaly`

Report a traffic anomaly.

**Request:**
```json
{
  "location": { "lat": 37.78, "lng": -122.41 },
  "severity": "high",
  "type": "accident",
  "description": "Multi-vehicle collision",
  "duration_minutes": 45
}
```

### `GET /anomaly`

List active anomalies.

### `GET /graph/snapshot`

Export current graph state. Query params: `include_edges`, `bbox`.

---

## Testing Strategy

### Backend Tests (`backend/tests/`)
- `conftest.py` — Shared fixtures (async client, sample data)
- `test_routing.py` — Route endpoint and routing engine validation
- `test_anomaly.py` — Anomaly ingestion, querying, and graph snapshot

Run: `cd backend && pytest -v`

### Real-Time Testing Hooks

Demo scenarios in `config.json` allow simulating:
1. **Rush hour** — Heavy highway congestion
2. **Road closure** — Critical severity forcing detour
3. **Weather** — Global speed reduction across all edges

---

## Configuration Reference

All configuration lives in `config.json` at the project root. Key sections:

| Section | Purpose |
|---|---|
| `graph` | OSM source, default location, network type |
| `vehicle_types` | Speed, allowed road types, cost per mode |
| `mode_switch_penalties` | Time/cost penalty for mode transfers |
| `anomaly` | Severity levels, weight multipliers, auto-expiry |
| `ml` | Model type, prediction URL, features, fallback |
| `routing` | Algorithm, weight attribute, max alternatives |
| `server` | Ports, CORS origins |
| `demo_scenarios` | Pre-built test scenarios with anomaly sets |
