# OSM Graph Extraction for Multi-Modal Routing

## Overview

GoliTransit uses a sophisticated road network graph built from OpenStreetMap (OSM) data using OSMnx and NetworkX. The system supports multi-modal routing for different vehicle types with specialized attributes and travel time calculations.

## Architecture

### 1. Graph Building (`utils/osm_graph_builder.py`)

The `build_graph()` function is the main entry point:

```python
graph = build_graph(
    location="Dhaka, Bangladesh",      # OSM location
    cache_dir="./data/osm_cache",      # Cache directory
    force_download=False                # Skip cache if True
)
```

**Features:**
- ✅ Downloads OSM data via OSMnx
- ✅ Automatic fallback to synthetic graph
- ✅ Graph caching for offline use
- ✅ Coordinate normalization
- ✅ Vehicle attribute assignment

### 2. Road Classification System

Roads are classified into three categories:

#### **Major Roads**
- Types: `motorway`, `trunk`, `primary`, `secondary`
- Vehicle Permissions:
  - 🚗 Car: **Allowed**
  - 🛺 Rickshaw: **Not Allowed**
  - 🚶 Walk: **Allowed**
  - 🚌 Transit: **Allowed**

#### **Secondary Roads**  
- Types: `tertiary`, `unclassified`
- Vehicle Permissions:
  - 🚗 Car: **Allowed**
  - 🛺 Rickshaw: **Allowed**
  - 🚶 Walk: **Allowed**
  - 🚌 Transit: **Allowed**

#### **Small Roads/Alleys**
- Types: `residential`, `service`, `path`, `footway`, `alley`
- Vehicle Permissions:
  - 🚗 Car: **Not Allowed**
  - 🛺 Rickshaw: **Allowed**
  - 🚶 Walk: **Allowed**
  - 🚌 Transit: **Not Allowed**

### 3. Edge Attributes

Each edge (road segment) in the graph contains:

```python
edge_data = {
    # OSM Data
    "highway": "secondary",              # Road type
    "length": 450.0,                     # Meters
    "speed_limit_kmh": 40.0,             # Speed limit
    
    # Classification
    "road_classification": "secondary",  # major/secondary/small_alley
    
    # Vehicle Permissions (boolean)
    "car_allowed": True,
    "rickshaw_allowed": True,
    "walk_allowed": True,
    "transit_allowed": True,
    
    # Travel Times Per Mode (seconds)
    "travel_time_per_mode": {
        "car": 40.5,      # 450m ÷ (40 km/h)
        "rickshaw": 108.0, # 450m ÷ (15 km/h)
        "walk": 324.0,     # 450m ÷ (5 km/h)
        "transit": 54.0,   # 450m ÷ (30 km/h)
    },
    
    # Routing Data
    "travel_time": 40.5,                 # Default (car)
    "base_travel_time": 40.5,            # Immutable copy
    "anomaly_multiplier": 1.0,           # For anomaly detection
    "ml_predicted": False,               # ML override flag
}
```

### 4. Vehicle Speed Defaults

| Vehicle  | Speed (km/h) | Use Case |
|----------|-------------|----------|
| 🚗 Car   | 40          | Personal vehicles, taxis |
| 🛺 Rickshaw | 15       | Local transport, three-wheelers |
| 🚶 Walk  | 5           | Pedestrian movement |
| 🚌 Transit | 30        | Public buses, fixed routes |

## Multi-Modal Routing

### Single-Modal Example (Car Only)

```json
{
  "origin": {"lat": 23.8090, "lng": 90.4105},
  "destination": {"lat": 23.8130, "lng": 90.4175},
  "modes": ["car"],
  "optimize": "time",
  "avoid_anomalies": true
}
```

**Response:**
```json
{
  "total_distance_m": 1950.0,
  "total_duration_s": 175.5,
  "total_cost": 0.15,
  "legs": [
    {
      "mode": "car",
      "geometry": [
        {"lat": 23.8090, "lng": 90.4105},
        {"lat": 23.8090, "lng": 90.4140},
        {"lat": 23.8110, "lng": 90.4140},
        {"lat": 23.8130, "lng": 90.4140},
        {"lat": 23.8130, "lng": 90.4175}
      ],
      "distance_m": 1950.0,
      "duration_s": 175.5,
      "cost": 0.15,
      "instructions": [...]
    }
  ]
}
```

### Multi-Modal Example (Walk → Transit → Walk)

```json
{
  "origin": {"lat": 23.8090, "lng": 90.4105},
  "destination": {"lat": 23.8130, "lng": 90.4175},
  "modes": ["walk", "transit", "walk"],
  "optimize": "time"
}
```

**Response:**
```json
{
  "legs": [
    {"mode": "walk", ...},    // Walk to station
    {"mode": "transit", ...}, // Take bus
    {"mode": "walk", ...}     // Walk from station
  ],
  "mode_switches": [
    {
      "from_mode": "walk",
      "to_mode": "transit",
      "penalty_time_s": 60,
      "penalty_cost": 0.2
    }
  ],
  "total_distance_m": 2100.0,
  "total_duration_s": 520.0
}
```

## Shortest-Path Algorithm

GoliTransit uses **Dijkstra's algorithm** via NetworkX:

```python
# Get mode-specific subgraph (only allowed roads for vehicle type)
subgraph = graph_service.get_subgraph_for_mode('car')

# Find shortest path using travel_time weights
path_nodes = nx.shortest_path(
    subgraph,
    source=origin_node,
    target=dest_node,
    weight='travel_time'  # Per-mode travel time is used
)
```

**Key Features:**
- ✅ Dynamic weight calculation per vehicle type
- ✅ Respects vehicle restrictions (cars avoid alleys, etc.)
- ✅ Optimizable by time, distance, or cost
- ✅ Support for anomaly avoidance
- ✅ Alternative route computation

## Synthetic Graph (Fallback)

When OSM download fails or times out, GoliTransit uses a high-quality synthetic graph representing Dhaka city:

**Synthetic Network Features:**
- 9 nodes in realistic grid pattern
- 32 directional edges (16 road segments × 2 directions)
- Mix of road types: motorway, trunk, primary, secondary, tertiary, residential, service, alley, path
- Realistic distances: 400-700 meters per segment
- Bidirectional connectivity for testing multi-mode path variations

**Location:** Central Dhaka (Motijheel/Gulshan area)
- Base coordinates: ~23.81°N, 90.41°E

## Integration with Routing Engine

### Graph Service (`services/graph_service.py`)

Provides graph access methods:

```python
# Load graph
graph_service.load_graph("Dhaka, Bangladesh")

# Query methods
nearest_node = graph_service.get_nearest_node(lat, lng)
subgraph = graph_service.get_subgraph_for_mode(mode)
snapshot = graph_service.get_snapshot()

# Weight updates (for anomalies)
graph_service.update_edge_weight(source, target, multiplier)
graph_service.reset_edge_weight(source, target)
```

### Routing Engine (`services/routing_engine.py`)

Uses the graph for pathfinding:

```python
# Single-modal routing
legs, switches, anomalies_avoided = await routing_engine._single_modal(
    origin=LatLng(lat=23.8090, lng=90.4105),
    destination=LatLng(lat=23.8130, lng=90.4175),
    mode="car",
    optimize="time",
    avoid_anomalies=True
)

# Multi-modal routing
legs, switches, anomalies = await routing_engine._multi_modal(
    origin, destination,
    modes=["walk", "transit", "walk"],
    optimize="time",
    avoid_anomalies=True
)
```

## Testing

### Run Comprehensive Tests

```bash
cd backend
python test_osm_graph.py
```

**Output Examples:**

#### Graph Statistics
```
Graph Statistics:
  Nodes: 9
  Edges: 32
  Vehicle Coverage:
    Car: 28/32 edges (87.5%)
    Rickshaw: 32/32 edges (100%)
    Walk: 32/32 edges (100%)
    Transit: 24/32 edges (75%)
  Total Network Length: 9.70 km
```

#### Edge Attributes
```
Edge: n1 → n2
  Length: 450m
  Road Type: secondary
  Car allowed: ✅
  Rickshaw allowed: ✅
  Walk allowed: ✅
  Travel times:
    - car: 40.5s
    - rickshaw: 108.0s
    - walk: 324.0s
```

#### Routing Examples
```
Car Route:
  Distance: 1950.0m
  Duration: 175.5s
  Waypoints: 5

Walk Route:
  Distance: 1400.0m
  Duration: 280.0s
  Waypoints: 3
```

### API Testing

**Car Route:**
```bash
curl -X POST http://localhost:8000/route \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": 23.8090, "lng": 90.4105},
    "destination": {"lat": 23.8130, "lng": 90.4175},
    "modes": ["car"]
  }'
```

**Multi-Modal Route:**
```bash
curl -X POST http://localhost:8000/route \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": 23.8090, "lng": 90.4105},
    "destination": {"lat": 23.8130, "lng": 90.4175},
    "modes": ["walk", "transit", "walk"]
  }'
```

## Configuration

### config.json Graph Settings

```json
{
  "graph": {
    "osm_source": "osmnx",              // Data source
    "default_location": "Dhaka, Bangladesh",
    "network_type": "drive",            // OSMnx network type
    "simplify": true,                   // Simplify topology
    "cache_dir": "./data/osm_cache"     // Cache location
  },
  "vehicle_types": {
    "car": {
      "default_speed_kmh": 50,
      "allowed_road_types": ["motorway", "trunk", "primary", ...]
    },
    "walk": {
      "default_speed_kmh": 5,
      "allowed_road_types": ["footway", "path", "residential", ...]
    }
    // ... more vehicles
  }
}
```

### Backend Settings

```python
from config import settings

location = settings.osm_location  # "Dhaka, Bangladesh"
cache_dir = settings.osm_cache_dir  # "./data/osm_cache"
vehicle_types = settings.vehicle_types  # Config dict
```

## Advanced Features

### 1. Anomaly Handling
Edges affected by traffic incidents, accidents, or construction get multiplied weights:

```python
# High severity anomaly = 3x slower
graph_service.update_edge_weight("n1", "n2", multiplier=3.0)

# When anomaly expires
graph_service.reset_edge_weight("n1", "n2")
```

### 2. ML-Predicted Weights
Machine learning models can override travel times based on real data:

```python
# Set ML-predicted weight (overrides base)
graph_service.set_ml_predicted_weight("n1", "n2", predicted_time=45.2)
```

### 3. Alternative Routes
The routing engine can compute multiple routes:

```python
request.max_alternatives = 3  # Get up to 3 routes
response = await routing_engine.compute(request)
# response.alternatives: [[legs], [legs], [legs]]
```

## Performance Notes

| Operation | Time | Notes |
|-----------|------|-------|
| Graph load (synthetic) | ~100ms | Instant, fallback ready |
| OSM download | 5-60s | Depends on location size |
| Shortest path (Dijkstra) | 10-50ms | 9-node fallback graph |
| Real OSM (SF) | 500ms-5s | Large networks take longer |
| Dhaka synthetic | 50-200ms | Typical routing |

## Future Enhancements

- [ ] Real OSM data for Dhaka with timeout handling
- [ ] A* pathfinding for faster large graphs
- [ ] Time-dependent edge weights (rush hour, holidays)
- [ ] GraphML caching with dict attribute serialization
- [ ] Transit schedule integration
- [ ] Real-time traffic data integration
- [ ] Carbon footprint calculation per mode

## References

- [OSMnx Documentation](https://osmnx.readthedocs.io/)
- [NetworkX Algorithms](https://networkx.org/documentation/stable/reference/algorithms/index.html)
- [OpenStreetMap Tagging](https://wiki.openstreetmap.org/wiki/Map_Features)
- [Dijkstra Algorithm](https://en.wikipedia.org/wiki/Dijkstra's_algorithm)
