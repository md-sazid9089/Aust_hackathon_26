# Multimodal Vehicle Routing Guide

## Overview

The GoliTransit app now provides **intelligent multimodal vehicle suggestions** that help users choose the fastest vehicle for each road segment. This feature generates two optimized routes:

1. **Shortest Distance Route** - Minimizes total kilometers
2. **Fastest Time Route** - Minimizes total travel time using optimal vehicles

## How It Works

### Route Analysis

When you compute a route from Origin A to Destination B, the system:

1. **Finds the shortest path** using Dijkstra's algorithm across all available roads
2. **Analyzes each road segment** to determine which vehicles are allowed
3. **Calculates travel times** for each allowed vehicle on that segment
4. **Recommends the fastest vehicle** for each segment
5. **Generates two complete route options** with segment-level vehicle suggestions

### Vehicle Selection Logic

For each road segment, the system:

- **Filters vehicles** by road type (e.g., buses can't travel on narrow golis)
- **Calculates individual travel times** based on vehicle speed and segment distance
- **Compares travel times** for all allowed vehicles
- **Highlights the fastest option** with a green checkmark

Example:
```
Segment 1: Secondary Road (182.97m)
├─ Car:      13.2s ⚡ FASTEST (recommended)
├─ Transit:  22.0s
├─ Rickshaw: 26.3s
└─ Bike:     43.9s
```

## Supported Vehicles

| Vehicle  | Speed   | Road Types | Use Case |
|----------|---------|-----------|----------|
| **🚗 Car** | 50 km/h | Main roads (motorway, trunk, primary, secondary, tertiary, residential) | Long distances, good for highways |
| **🛺 Rickshaw** | 25 km/h | Narrow roads (residential, tertiary, secondary, unclassified, service) | Local travel, flexible routes |
| **🚴 Bike** | 15 km/h | Cycleways, small roads (residential, tertiary, secondary, path) | Short distances, eco-friendly |
| **🚶 Walk** | 5 km/h | Footways, paths, pedestrian (footway, path, residential, pedestrian, steps) | Very short distances |
| **🚌 Transit** | 30 km/h | Main roads (primary, secondary, tertiary, trunk) | Scheduled services |

## Road Types & Restrictions

The system restricts vehicle access based on Dhaka's road infrastructure:

### Broad Roads (Highways & Main Streets)
- **motorway, trunk, primary** → Cars only
- **secondary** → Car, Bus, Rickshaw available (but rickshaw risky on highway)
- **tertiary** → Car, Bus, Rickshaw, Bike available
- **residential** → All vehicles allowed

### Narrow Roads & Golis
- **service, unclassified** → Rickshaw, Bike, Walk (cars struggle)
- **cycleway** → Bike, Walk preferred
- **path, footway, pedestrian** → Bike, Walk only
- **steps** → Walk only

## API Response Format

### Route Request
```json
{
  "origin": { "lat": 23.7639, "lng": 90.4066 },
  "destination": { "lat": 23.7739, "lng": 90.4166 },
  "modes": ["car"],
  "optimize": "time",
  "avoid_anomalies": true
}
```

### Route Response Includes
```json
{
  "total_distance_m": 1627.58,
  "total_duration_s": 117.19,
  "total_cost": 0.19,
  
  "multimodal_suggestions": [
    {
      "route_type": "shortest_distance",
      "total_distance_m": 1627.58,
      "total_duration_s": 117.19,
      "geometry": [...],
      "segments": [
        {
          "segment_index": 0,
          "from_node": "12345",
          "to_node": "12346",
          "distance_m": 182.97,
          "road_type": "secondary",
          "recommended_vehicle": "car",
          "vehicle_options": [
            {
              "vehicle": "car",
              "travel_time_s": 13.2,
              "is_recommended": true,
              "distance_m": 182.97
            },
            {
              "vehicle": "transit",
              "travel_time_s": 22.0,
              "is_recommended": false,
              "distance_m": 182.97
            }
          ]
        }
      ]
    },
    {
      "route_type": "fastest_time",
      ...
    }
  ]
}
```

## Frontend Display

The **MultimodalSuggestions** component shows:

### For Each Route
- **Route Type** (Shortest Distance / Fastest Time)
- **Total Distance** in km
- **Total Time** in minutes
- **Segment Count**

### For Each Segment
- **Segment Number** and **Road Type**
- **Distance** breakdown
- **Recommended Vehicle** (highlighted in green)
- **Alternative Vehicles** with travel times
- **Visual Comparison** showing relative speed differences

## Example Journey

**From AUST Central Gate → Ghatil Cricket Ground**

1. **Start (Segment 1-3: 500m Secondary Road)**
   - Only car available on highway
   - Recommended: 🚗 Car (30 seconds)

2. **Mid-Route (Segment 4-6: 800m Tertiary Road)**
   - Multiple options now available
   - Recommended: 🚗 Car (45 seconds) vs 🛺 Rickshaw (95 seconds)
   - User could save money with rickshaw if not in hurry

3. **End (Segment 7-8: 330m Residential Golis)**
   - Narrow alleys, cars struggle
   - Recommended: 🛺 Rickshaw (25 seconds) or 🚴 Bike (55 seconds)
   - Walking: 🚶 2 minutes (if patient)

## Configuration

Edit `config.json` to customize:

```json
{
  "vehicle_types": {
    "car": {
      "default_speed_kmh": 50,
      "allowed_road_types": [...],
      "fuel_cost_per_km": 0.12
    }
  }
}
```

## Backend Implementation

**Key Files:**
- `backend/services/routing_engine.py`: Multimodal analysis logic
- `backend/services/graph_service.py`: Graph querying
- `backend/models/route_models.py`: Data schemas

**Key Method:**
```python
async def _analyze_path_with_vehicles(
    path: list,
    graph: nx.MultiDiGraph,
    all_modes: list[str],
    route_type: str,
    optimize: str,
) -> PathWithVehicleSuggestions
```

## Frontend Implementation

**Key Files:**
- `frontend/src/components/MultimodalSuggestions.jsx`: Display component
- `frontend/src/components/RoutePanel.jsx`: Integration point

## Testing

### Terminal Test
```powershell
$body = @{
  origin = @{ lat = 23.76281; lng = 90.40589 };
  destination = @{ lat = 23.76794; lng = 90.41215 };
  modes = @('car');
  optimize = 'time';
  avoid_anomalies = $true
} | ConvertTo-Json -Depth 5

$resp = Invoke-WebRequest -Method POST -Uri http://localhost:8000/route `
  -ContentType 'application/json' -Body $body
$json = $resp.Content | ConvertFrom-Json

# Check multimodal suggestions
$json.multimodal_suggestions[0].segments | Select-Object -First 3 | 
  ForEach-Object { "$($_.recommended_vehicle) suggested for $($_.distance_m)m segment" }
```

### Expected Output
```
car suggested for 182.974m segment
car suggested for 145.392m segment
car suggested for 108.704m segment
```

## Future Enhancements

1. **Real-time Traffic SIM** - Adjust vehicle recommendations based on live congestion
2. **Cost Optimization** - Show cost-optimal vs time-optimal routes
3. **Historical Data** - Learn preferred routes from user behavior
4. **Weather Integration** - Suggest indoor transit in heavy rain
5. **Multi-transfer Routes** - Combine vehicles (car → bus → bike → walk)
6. **Carbon Footprint** - Show eco-friendly vehicle rankings
7. **Accessibility Features** - Filter vehicles based on mobility needs

## Troubleshooting

### Issue: "No vehicles available for segment"
- **Cause**: Road type not in any vehicle's allowed list
- **Fix**: Expand `allowed_road_types` in config.json

### Issue: Walk always recommended on main roads
- **Cause**: Speed calculation fallback is too aggressive
- **Fix**: Check `default_speed_kmh` for each vehicle type

### Issue: Segments showing duplicate vehicles
- **Cause**: Road type matches multiple vehicle types with same priority
- **Fix**: Fine-tune `allowed_road_types` to differentiate vehicle roles

## Performance Notes

- **Segment Analysis**: O(n × m) where n = segments, m = vehicle types
- **Rendering with 100+ segments**: Uses React virtualization
- **API Latency**: Typically 200-500ms for 50-segment routes
- **Memory**: Caches full graph in memory (~2,741 nodes in 2km AUST radius)

---

**Last Updated**: April 2026
**Version**: 1.0.0
