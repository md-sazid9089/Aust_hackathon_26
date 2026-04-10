# 🚀 GoliTransit — Multi-Modal Hyper-Local Routing Engine

> A hackathon project that delivers intelligent, multi-modal routing with real-time anomaly handling and ML-based congestion prediction.

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Leaflet)                   │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  MapView   │  │ RoutePanel  │  │ AnomalyAlert │  │ModeSelect │ │
│  └─────┬──────┘  └──────┬──────┘  └──────┬───────┘  └─────┬─────┘ │
│        └─────────────────┴───────────────┴─────────────────┘       │
│                              │ REST API                             │
└──────────────────────────────┼──────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI)                                │
│                                                                      │
│  Routes:  /health  │  /route  │  /anomaly  │  /graph/snapshot        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐        │
│  │                    Services Layer                         │        │
│  │  ┌────────────┐ ┌──────────────┐ ┌────────────────────┐  │        │
│  │  │  Routing   │ │   Anomaly    │ │  ML Integration    │  │        │
│  │  │  Engine    │ │   Service    │ │  (predict edges)   │  │        │
│  │  └─────┬──────┘ └──────┬───────┘ └────────┬───────────┘  │        │
│  │        │               │                   │              │        │
│  │  ┌─────▼───────────────▼───────────────────▼──────────┐   │        │
│  │  │            Graph Service (NetworkX)                 │   │        │
│  │  │   OSM Import → Multi-Layer Road Graph → Weights    │   │        │
│  │  └────────────────────────────────────────────────────┘   │        │
│  └──────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     ML MODULE (Isolated)                             │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌──────────────────┐   │
│  │Preprocess│→ │  Train    │→ │  Model    │→ │  Predict API     │   │
│  │  (OSM +  │  │(sklearn / │  │ Registry  │  │  (edge traversal │   │
│  │ traffic) │  │ TF stubs) │  │           │  │   time weights)  │   │
│  └──────────┘  └───────────┘  └───────────┘  └──────────────────┘   │
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
# 1. Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 2. ML Module
cd ml
pip install -r requirements.txt
python predict.py  # starts prediction server on port 8001

# 3. Frontend
cd frontend
npm install
npm run dev
```

---

## 🔧 Configuration

See `config.json` for:

- Vehicle type definitions (speed, allowed road types)
- Mode-switch penalties (time + cost)
- Anomaly severity thresholds
- ML model parameters

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

---

## 🌐 Production Frontend Deploy

The live frontend is deployed at:

👉 **[https://aust-hackathon-26.vercel.app/](https://aust-hackathon-26.vercel.app/)**

---

### Vercel Token Usage

- The `VERCEL_TOKEN` secret is required for deploys and must be stored as a GitHub Actions secret. **Never expose this token in logs or outputs.**
