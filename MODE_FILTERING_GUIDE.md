# Transport Mode Node Filtering Implementation Guide

## 🎯 Overview
Dynamic node display and filtering based on selected transport mode with mode-specific accessibility tagging and color-coded visualization.

---

## 🔧 How It Works

### Backend Flow
```
1. OSM Graph Load
   ├─ Extract road network with vehicle permissions
   └─ Tag edges with mode_allowed flags (car, bike, walk, transit, rickshaw)

2. Node Accessibility Computation
   ├─ For each node, check all connected edges
   ├─ Identify which modes can use those edges
   └─ Store accessible_modes = [list of modes]

3. GraphSnapshot Generation
   ├─ Query: GET /graph/snapshot?mode=car
   ├─ Filter nodes by accessible_modes contains mode
   └─ Return nodes with accessibility metadata
```

### Frontend Flow
```
1. User Selects Mode
   └─ ModeSelector triggers onChange([mode])

2. MapView Updates
   ├─ useMemo computes filteredNodes
   ├─ Filter: node.accessible_modes.includes(selectedMode)
   └─ Recompute colors and opacity

3. Render Mode-Specific Nodes
   ├─ Each node colored with MODE_NODE_COLORS[selectedMode]
   ├─ Opacity reflects accessibility diversity
   └─ Popup shows all modes accessible at that node
```

---

## 📊 Node Visualization

### Color Mapping
| Mode | Color | Hex | Use Case |
|------|-------|-----|----------|
| 🚗 Car | Red | #ef4444 | Major road intersections |
| 🚴 Bike | Green | #22c55e | Cycle paths & alleys |  
| 🚶 Walk | Orange | #f97316 | Pedestrian zones |
| 🚌 Transit | Blue | #3b82f6 | Bus stops & stations |
| 🛺 Rickshaw | Yellow | #facc15 | Local streets |

### Opacity Interpretation
- **High (0.8-0.9):** Node accessible by multiple modes
  - Indicates major intersections with broad road types
  - High flexibility for mode switching
  
- **Medium (0.6-0.7):** Node accessible by 2-3 modes
  - Secondary routes with some flexibility
  
- **Low (0.5):** Node accessible by single mode only
  - Specialized paths (e.g., footway, alley)
  - No mode switching opportunity

---

## 📝 API Contract

### Endpoint: GET /graph/snapshot

**Query Parameters:**
```
mode (optional): string
  Values: car | bike | walk | transit | rickshaw
  Effect: Return only nodes accessible by this mode
  
include_edges (optional): boolean (default: false)
  Effect: Include full edge list (large payload)
  
bbox (optional): string "south,west,north,east"
  Effect: Filter geographic bounding box
```

**Response Example:**
```json
{
  "node_count": 2741,
  "edge_count": 6169,
  "nodes": [
    {
      "id": "123456",
      "lat": 23.764,
      "lng": 90.407,
      "accessible_modes": ["car", "walk", "transit"]
    },
    {
      "id": "123457",
      "lat": 23.765,
      "lng": 90.408,
      "accessible_modes": ["walk", "rickshaw"]
    }
  ],
  "edges": [],
  "anomaly_affected_edges": []
}
```

---

## 🎮 User Interactions

### Mode Selection
```
User clicks ModeSelector button
  ↓
MapView.filteredNodes recomputes
  ↓
Only nodes with selectedMode in accessible_modes shown
  ↓
Nodes colored with MODE_NODE_COLORS[selectedMode]
  ↓
Visual feedback: map shows mode-specific network
```

### Node Information
```
User hovers/clicks node
  ↓
Popup displays:
  • Node ID
  • Coordinates
  • List of accessible modes (colored)
  ↓
User sees "this node can be used by: car, walk, transit"
```

### Route Planning
```
User selects mode via ModeSelector
  ↓
User sets origin/destination on visible nodes only
  ↓
System plans route using subgraph_for_mode()
  ↓
Route respects mode accessibility constraints
```

---

## 🔍 Node Filtering Examples

### Scenario 1: Car Mode
```
Available Nodes: ~500 (major roads only)
Colors: All RED
Typical Accessibility:
  - Major streets: [car, walk, transit]
  - Secondary streets: [car, walk, rickshaw]
  - Excluded: Alleys, footways, bike lanes
```

### Scenario 2: Walk Mode  
```
Available Nodes: ~2500 (most nodes)
Colors: All ORANGE
Typical Accessibility:
  - Major streets: [car, walk, transit]
  - Secondary: [car, walk, rickshaw]
  - Alleys: [walk, rickshaw]
  - Footways: [walk]
```

### Scenario 3: Rickshaw Mode
```
Available Nodes: ~1800 (avoid motorways)
Colors: All YELLOW
Typical Accessibility:
  - Secondary streets: [car, walk, rickshaw]
  - Local streets: [walk, rickshaw]
  - Excluded: Motorways, footways
```

---

## 💻 Implementation Details

### Backend: Node Accessibility Algorithm

```python
def get_node_accessibility(node_id: str) -> list[str]:
    """Compute which modes can access a node"""
    accessible = set()
    
    # Check outgoing edges
    for target, edges in graph[node_id].items():
        for key, edge_data in edges.items():
            for mode in VEHICLE_TYPES:
                if edge_data.get(f"{mode}_allowed"):
                    accessible.add(mode)
    
    # Check incoming edges
    for source in graph.pred[node_id]:
        for key, edge_data in graph[source][node_id].items():
            for mode in VEHICLE_TYPES:
                if edge_data.get(f"{mode}_allowed"):
                    accessible.add(mode)
    
    return sorted(list(accessible))
```

### Frontend: Node Filtering & Rendering

```javascript
// Filter nodes by selected mode
const filteredNodes = useMemo(() => {
  return graphNodes
    .filter(node => 
      node.accessible_modes?.includes(selectedMode)
    )
    .map(node => ({
      ...node,
      color: MODE_NODE_COLORS[selectedMode],
      opacity: 0.5 + (node.accessible_modes.length * 0.1)
    }));
}, [graphNodes, selectedMode]);

// Render with CircleMarker
{filteredNodes.map(node => (
  <CircleMarker
    center={node.position}
    radius={2.2}
    pathOptions={{
      color: node.color,
      fillOpacity: node.opacity
    }}
  >
    <Popup>
      {/* Show accessible modes */}
    </Popup>
  </CircleMarker>
))}
```

---

## 🧪 Testing Checklist

- [ ] Backend compiles without errors
- [ ] Node accessibility computed correctly per mode
- [ ] GET /graph/snapshot returns nodes with accessible_modes
- [ ] Mode filter query parameter works
- [ ] Frontend loads nodes with accessibility data
- [ ] MapView filters nodes by selectedMode
- [ ] Nodes display with correct MODE_NODE_COLORS
- [ ] Opacity varies with accessibility_modes.length
- [ ] Popups show accessible modes
- [ ] Route planning respects visible nodes
- [ ] Mode switching updates node display instantly
- [ ] No visual glitches during mode changes

---

## 📌 Configuration

### Vehicle Types (from settings)
Defined in `config.py`:
```python
VEHICLE_TYPES = {
    'car': {'allowed_road_types': [...]},
    'bike': {'allowed_road_types': [...]},
    'walk': {'allowed_road_types': [...]},
    'transit': {'allowed_road_types': [...]},
    'rickshaw': {'allowed_road_types': [...]}
}
```

### OSM Tag Overrides
- `highway=footway` → car NOT allowed
- `service=alley` → car, bike NOT allowed; rickshaw, walk allowed
- `highway=motorway` → rickshaw, walk NOT allowed

---

## 🚀 Performance Notes

- **Node Computation:** O(n) per mode change where n = node count (~2700)
- **useMemo:** Prevents unnecessary recalculations
- **Lazy Evaluation:** Nodes computed only when selectedMode changes
- **Payload:** +list of strings per node (~50 bytes average)
- **Rendering:** CircleMarkers are fast for 500-2500 nodes

---

## 📚 Files Modified

### Backend
- `backend/models/graph_models.py` - GraphNode schema enhancement
- `backend/services/graph_service.py` - Accessibility computation & filtering
- `backend/routes/graph.py` - Endpoint parameter addition

### Frontend
- `frontend/src/components/MapView.jsx` - Node filtering & visualization
- `frontend/src/pages/MapPage.jsx` - Documentation update

**No new files created** - All logic integrated into existing components.

---

## 🔗 Related Features

- **Route Planning:** Uses subgraph_for_mode() for mode-specific routing
- **Mode Selector:** Drives node filtering and route computation
- **Route Display:** Shows mode-optimized paths on filtered network
- **Anomaly Handling:** Affects edge weights, not node accessibility

---

## 🎓 Architecture Diagram

```
User Interface
  │
  ├─ ModeSelector (user picks mode)
  │
  ├─ MapView
  │   ├─ filteredNodes.map(...) useMemo
  │   ├─ Filter: accessible_modes.includes(mode)
  │   ├─ Color: MODE_NODE_COLORS[mode]
  │   └─ Render: CircleMarker + Popup
  │
  └─ Backend API
     ├─ GET /graph/snapshot?mode=X
     ├─ GraphService.get_node_accessibility()
     ├─ Filter nodes by mode
     └─ Return with accessible_modes metadata
```

