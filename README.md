# 🚀 GoliTransit — Multi-Modal Hyper-Local Routing Engine

> A hackathon project that delivers intelligent, multi-modal routing with real-time anomaly handling and ML-based congestion prediction.

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Leaflet)                   │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐  ┌───────────┐   │
│  │  MapView   │  │ RoutePanel  │  │ AnomalyAlert │  │ModeSelect │   │
│  └─────┬──────┘  └──────┬──────┘  └──────┬───────┘  └─────┬─────┘   │
│        └────────────────┴────────────────┴────────────────┘         │
│                              │ REST API                             │
└──────────────────────────────┼──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI)                               │
│                                                                     │
│  Routes:  /health  │  /route  │  /anomaly  │  /graph/snapshot       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │                    Services Layer                        │       │
│  │  ┌────────────┐ ┌──────────────┐ ┌────────────────────┐  │       │
│  │  │  Routing   │ │   Anomaly    │ │  ML Integration    │  │       │
│  │  │  Engine    │ │   Service    │ │  (predict edges)   │  │       │
│  │  └─────┬──────┘ └──────┬───────┘ └─────────┬───────────┘ │       │
│  │        │               │                   │             │       │
│  │  ┌─────▼───────────────▼───────────────────▼──────────┐  │       │
│  │  │            Graph Service (NetworkX)                │  │       │
│  │  │   OSM Import → Multi-Layer Road Graph → Weights    │  │       │
│  │  └────────────────────────────────────────────────────┘  │       │
│  └──────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     ML MODULE (Isolated)                             │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌──────────────────┐    │
│  │Preprocess│→ │  Train    │→ │  Model    │→ │  Predict API     │    │
│  │  (OSM +  │  │(sklearn / │  │ Registry  │  │  (edge traversal │    │
│  │ traffic) │  │ TF stubs) │  │           │  │   time weights)  │    │
│  └──────────┘  └───────────┘  └───────────┘  └──────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🗂 Project Structure

```
GoliTransit/
├── README.md                    # This file
├── config.json                  # Global config: vehicle types, penalties, thresholds
├── docker-compose.yml           # Orchestration for all services
├── .gitignore
│
├── backend/                     # FastAPI backend
│   ├── main.py                  # App entry point, mounts all routers
│   ├── config.py                # Settings loader from config.json
│   ├── requirements.txt
│   ├── routes/                  # API route handlers (thin layer)
│   │   ├── health.py            # GET /health
│   │   ├── route.py             # POST /route
│   │   ├── anomaly.py           # POST /anomaly, GET /anomaly
│   │   └── graph.py             # GET /graph/snapshot
│   ├── services/                # Core business logic
│   │   ├── routing_engine.py    # Single-modal & multi-modal routing
│   │   ├── graph_service.py     # OSM import, NetworkX graph management
│   │   ├── anomaly_service.py   # Anomaly ingestion & dynamic rerouting
│   │   └── ml_integration.py    # Calls ML module for predicted edge weights
│   ├── models/                  # Pydantic request/response schemas
│   │   ├── route_models.py
│   │   ├── anomaly_models.py
│   │   └── graph_models.py
│   └── tests/                   # Unit & integration tests
│       ├── test_routing.py
│       ├── test_anomaly.py
│       └── conftest.py
│
├── ml/                          # Isolated ML module
│   ├── requirements.txt
│   ├── preprocess.py            # Data cleaning & feature engineering
│   ├── train.py                 # Model training pipeline
│   ├── predict.py               # Inference API for edge traversal times
│   ├── model_registry.py        # Load/save/version trained models
│   ├── models/                  # Saved model artifacts (.pkl, .h5)
│   └── data/                    # Raw/processed training data
│
├── frontend/                    # React + Leaflet + TailwindCSS
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── pages/
│       │   ├── HomePage.jsx     # Landing / dashboard
│       │   └── MapPage.jsx      # Interactive routing map
│       ├── components/
│       │   ├── MapView.jsx      # Leaflet map wrapper
│       │   ├── RoutePanel.jsx   # Route results sidebar
│       │   ├── AnomalyAlert.jsx # Real-time anomaly notifications
│       │   └── ModeSelector.jsx # Transport mode picker
│       └── services/
│           ├── api.js           # Axios/fetch base client
│           └── routeService.js  # Route-specific API calls
│
└── docs/
    └── architecture.md          # Extended architecture documentation
```

---

## 🚦 Key Features

| Feature                      | Description                                                             |
| ---------------------------- | ----------------------------------------------------------------------- |
| **Single-Modal Routing**     | Shortest/fastest path for one transport mode (car, bike, walk, transit) |
| **Multi-Modal Routing**      | Combine modes with configurable switch penalties                        |
| **Real-Time Anomalies**      | Ingest accidents, closures, weather — dynamically reroute               |
| **ML Congestion Prediction** | Predict edge traversal times using historical + live data               |
| **Graph Snapshots**          | Export current graph state for debugging / visualization                |

---

## ⚡ Quick Start

```bash
# Clone and enter repository
git clone https://github.com/<your-username>/Aust_hackathon_26.git
cd Aust_hackathon_26

# Start everything using Docker (recommended)
docker compose up --build
```

---

## ✅ Prerequisites

- Python 3.11+
- Node.js 18+
- npm 9+
- Docker + Docker Compose (recommended for one-command startup)
- Git

---

## 🔌 Environment And Configuration

This project uses shared configuration from root config.json and environment variables from production.env.

Important runtime variables:

- CONFIG_PATH: path to config.json for backend and ml services
- VITE_PROXY_TARGET: frontend dev proxy target (default localhost backend)
- DATABASE_URL: SQLAlchemy connection URL (used in container and non-container modes)
- ML_PREDICTION_URL: backend URL for ML prediction server

For local frontend development without Docker, ensure backend is reachable on http://127.0.0.1:8000 or set VITE_PROXY_TARGET.

---

## 🧪 Local Development Setup (Without Docker)

1. Start backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

2. Start ML service:

```bash
cd ml
pip install -r requirements.txt
python predict.py
```

3. Start frontend:

```bash
cd frontend
npm install
npm run dev
```

4. Open the app at http://localhost:5173.

---

## 🐳 Docker Execution Steps (Recommended)

1. Build and run all services:

```bash
docker compose up --build
```

2. Verify service health:

```bash
curl http://localhost:8000/health
curl http://localhost:8001/health
```

3. Stop services:

```bash
docker compose down
```

---

## 🛰 API Usage

Base URL:

- Local backend: http://127.0.0.1:8000
- Frontend proxy path in dev: /api

### 1) Health

Endpoint: GET /health

Example:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

### 2) Compute Route

Endpoint: POST /route

Single-mode example:

```bash
curl -X POST http://127.0.0.1:8000/route \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": 23.7639, "lng": 90.4066},
    "destination": {"lat": 23.7512, "lng": 90.3938},
    "modes": ["car"],
    "optimize": "time",
    "avoid_anomalies": true,
    "include_multimodal": false,
    "traffic_hour_of_day": 18
  }'
```

Multi-modal example:

```bash
curl -X POST http://127.0.0.1:8000/route \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": 23.7639, "lng": 90.4066},
    "destination": {"lat": 23.7512, "lng": 90.3938},
    "modes": ["walk", "bike", "rickshaw"],
    "optimize": "time",
    "avoid_anomalies": true,
    "include_multimodal": true,
    "traffic_hour_of_day": 9
  }'
```

Route response includes:

- legs with geometry, distance, duration and instructions
- total_distance_m, total_duration_s, total_cost
- multimodal_suggestions (shortest-distance and fastest-time strategies)
- traffic_jam_prediction (route-level jam chance for selected hour)

### 3) Report Anomaly

Endpoint: POST /anomaly

```bash
curl -X POST http://127.0.0.1:8000/anomaly \
  -H "Content-Type: application/json" \
  -d '{
    "edge_ids": ["12345->67890"],
    "severity": "high",
    "type": "accident",
    "description": "Collision near intersection",
    "duration_minutes": 30
  }'
```

### 4) List Active Anomalies

Endpoint: GET /anomaly

```bash
curl http://127.0.0.1:8000/anomaly
```

### 5) Graph Snapshot

Endpoint: GET /graph/snapshot

```bash
curl "http://127.0.0.1:8000/graph/snapshot?include_edges=true"
```

Optional query params:

- include_edges: boolean
- bbox: south,west,north,east
- mode: car | bike | walk | transit | rickshaw

### Route Response Contract (Problem 1 Justification Mapping)

Problem 1 asks every successful `/route` response to include route justification information.
In this implementation, the required evidence is provided by the following response fields:

- Computation details: route totals and selected strategy under `legs`, `total_duration_s`, and `multimodal_suggestions`
- Sequential route coordinates: per-segment `geometry` in each leg
- Vehicle class per segment: `legs[].mode` and segment-level strategy output in `multimodal_suggestions`
- Mode-switch penalties: each switch is listed in `mode_switches[].penalty_time_s` and `mode_switches[].penalty_cost`

Example successful route response (trimmed):

```json
{
  "legs": [
    {
      "mode": "walk",
      "geometry": [{"lat": 23.7639, "lng": 90.4066}, {"lat": 23.7621, "lng": 90.4044}],
      "distance_m": 240.2,
      "duration_s": 172.9,
      "cost": 0.0
    },
    {
      "mode": "rickshaw",
      "geometry": [{"lat": 23.7621, "lng": 90.4044}, {"lat": 23.7512, "lng": 90.3938}],
      "distance_m": 1630.8,
      "duration_s": 412.0,
      "cost": 40.0
    }
  ],
  "mode_switches": [
    {
      "from_mode": "walk",
      "to_mode": "rickshaw",
      "location": {"lat": 23.7621, "lng": 90.4044},
      "penalty_time_s": 60.0,
      "penalty_cost": 5.0
    }
  ],
  "total_distance_m": 1871.0,
  "total_duration_s": 644.9,
  "total_cost": 45.0,
  "multimodal_suggestions": [
    {
      "strategy": "shortest_distance",
      "total_distance_m": 1820.2,
      "total_duration_s": 701.3,
      "segments": []
    },
    {
      "strategy": "fastest_time",
      "total_distance_m": 1934.5,
      "total_duration_s": 620.1,
      "segments": []
    }
  ],
  "traffic_jam_prediction": {
    "hour_of_day": 18,
    "route_jam_chance_pct": 46.2,
    "edges_analyzed": 12,
    "heavy_edges": 3,
    "moderate_edges": 5,
    "low_edges": 4,
    "confidence": 0.87
  }
}
```

---

## 📋 Problem 1 Compliance Matrix

| Problem 1 Requirement | Current Implementation |
| --- | --- |
| Multi-layer graph with mode restrictions | Implemented via mode-specific edge flags and filtering in graph/routing services |
| Single-modal routing | Implemented in `/route` with `modes: ["car"]`-style requests |
| Multi-modal segmented routing with switch penalties | Implemented in `/route` using ordered `modes` and `mode_switches` penalties |
| Gridlock anomaly ingestion and targeted updates | Implemented in `POST /anomaly` (edge/bbox impact) |
| Expose graph state for verification | Implemented in `GET /graph/snapshot` |
| Route justification evidence | Returned through `legs`, `geometry`, `mode_switches`, route totals, suggestions |
| Real-time reroute behavior after anomaly | New route requests reflect updated graph weights immediately |

---

## 🎬 Problem 1 Demo Checklist

Use these exact scenarios in the demo video for scoring alignment:

1. Single-modal route request under urban traffic
2. Multi-modal route computation with at least one mode switch
3. Gridlock anomaly ingestion and visible rerouting effect
4. Verification that vehicle-class restrictions are respected on every segment

---

## 🧠 Design Decisions

- Thin-route, service-first backend structure: API handlers stay lightweight while business logic lives in services.
- Graph-centric routing: OSM road network is loaded into memory once and reused for fast route computation.
- Dynamic anomaly weighting: anomalies update edge weights so rerouting behavior is immediate.
- Pluggable ML traffic signal: route-level traffic risk is computed from route edges and selected hour-of-day.
- Frontend/backend mode symmetry: single and multimodal logic share common contracts with explicit mode toggling.

---

## 📌 Assumptions

- The selected map area is bounded by config.json graph radius and center.
- ML service is reachable when traffic-aware prediction is requested; otherwise fallback behavior applies.
- OSM data quality determines road-type and mode accessibility accuracy.
- Route quality depends on available nodes near origin and destination coordinates.
- Severity labels and multipliers in anomaly flow are configured in config.json.

---

## ▶️ Execution Flow Summary

1. Frontend sends route request with origin, destination, mode(s), and optional traffic_hour_of_day.
2. Backend routing engine computes candidate path(s) from current graph state.
3. Active anomalies alter edge weights before final path scoring.
4. ML traffic module estimates jam chance from route edges for chosen hour.
5. Response returns legs, totals, multimodal suggestions, and traffic prediction.

---

## 🧪 Testing And Validation

Backend tests:

```bash
cd backend
pytest tests -q
```

Frontend build validation:

```bash
cd frontend
npm run build
```

Compose validation:

```bash
docker compose config
```

Optional performance verification (Problem 1 real-time targets):

- Route latency target: multimodal p95 under 2.5s
- Anomaly update target: propagation under 500ms
- Concurrency target: 50+ simultaneous requests

You can validate these with your preferred load-test tool (Locust, k6, JMeter) against `/route` and `/anomaly`.

---

## 🔧 Configuration

See `config.json` for:

- Vehicle type definitions (speed, allowed road types)
- Mode-switch penalties (time + cost)
- Anomaly severity thresholds
- ML model parameters

Also review:

- `backend/config.py` for runtime settings mapping
- `backend/routes/route.py` and `backend/models/route_models.py` for request/response contract
- `backend/routes/anomaly.py` for anomaly ingestion and clearing behavior

---

## 🛠 Troubleshooting

- Frontend cannot call backend:
  - Confirm backend is running on port 8000.
  - If running locally, check frontend Vite proxy target.
- Route returns empty/poor geometry:
  - Confirm origin/destination are within configured graph area.
  - Expand graph radius in config.json if required.
- Traffic prediction missing:
  - Confirm ML service is up on port 8001 and reachable from backend.
- Docker startup issues:
  - Run docker compose down -v, then docker compose up --build.

---

## 🏗 Tech Stack

- **Frontend**: React 18, Leaflet.js, TailwindCSS, Vite
- **Backend**: Python 3.11+, FastAPI, NetworkX, OSMnx
- **ML**: scikit-learn / TensorFlow (pluggable)
- **Data**: OpenStreetMap (OSM) via OSMnx

---

## 📄 License

MIT — Built for hackathon demonstration purposes.

---

## 🔁 CI/CD (GitHub Actions)

This repository now includes two workflows:

- `.github/workflows/ci.yml`
  - Runs on push to `dev`, and on every pull request.
  - Executes backend tests (`pytest backend/tests -q`).
  - Builds the frontend (`npm run build`).
  - Validates Docker Compose (`docker compose config`).

- `.github/workflows/cd.yml`
  - Runs on push to `dev`, on pull requests targeting `dev`, and manual trigger.
  - Builds and pushes Docker images to GHCR:
    - `ghcr.io/<owner>/aust-hackathon-26-backend`
    - `ghcr.io/<owner>/aust-hackathon-26-ml`
    - `ghcr.io/<owner>/aust-hackathon-26-frontend`
  - Builds and deploys the frontend to Vercel production on `dev`.
  - Creates Vercel preview deployments for pull requests.

### Required repository setup

1. Add repository variable:
   - `VITE_API_BASE_URL` = your production API URL (example: `https://api.example.com`).
2. Add repository secrets (from your Vercel project settings):
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
3. Ensure workflow permissions allow writing packages (already set in workflow file).

### Notes

- CI validates backend tests, frontend build, and compose syntax on each PR/push to `dev`.
- CD builds and publishes container images, then deploys frontend via Vercel workflow.

---

## 🌐 Production Frontend Deploy

The live frontend is deployed at:

👉 **[https://aust-hackathon-26.vercel.app/](https://aust-hackathon-26.vercel.app/)**

---

### Vercel Token Usage

- The `VERCEL_TOKEN` secret is required for deploys and must be stored as a GitHub Actions secret. **Never expose this token in logs or outputs.**
