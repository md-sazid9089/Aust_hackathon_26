/*
 * MapView - Leaflet Map Wrapper Component
 * ==========================================
 * Renders an interactive Leaflet map with:
 *   - OpenStreetMap tile layer
 *   - Origin/destination markers
 *   - Route polyline visualization (from API response geometry)
 *   - Click handler for setting origin/destination
 *   - Custom FAB zoom controls (replaces default Leaflet controls)
 */

import { createPortal } from 'react-dom';
import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMapEvents, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

const SEGMENT_MODE_COLORS = {
  bus: '#ffffff',      // white
  transit: '#ffffff',  // white alias
  car: '#ef4444',      // red
  bike: '#facc15',     // yellow
  rickshaw: '#22c55e', // green
  walk: '#a855f7',     // purple
};

const SINGLE_MODE_COLORS = {
  car: '#3b82f6',
  bike: '#22c55e',
  rickshaw: '#f97316',
  walk: '#9ca3af',
  bus: '#ef4444',
  transit: '#ef4444',
};

// Mode-specific node colors for visualization
const MODE_NODE_COLORS = {
  car: '#ef4444',      // red
  bike: '#22c55e',     // green
  walk: '#f97316',     // orange
  transit: '#3b82f6',  // blue
  rickshaw: '#facc15', // yellow
};

const originIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width: 20px; height: 20px; border-radius: 50%;
    background: #22c55e;
    border: 3px solid #ffffff;
    box-shadow: 0 0 0 4px rgba(34,197,94,0.30), 0 4px 12px rgba(0,0,0,0.5);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const destIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width: 20px; height: 20px; border-radius: 50%;
    background: #8b5cf6;
    border: 3px solid #ffffff;
    box-shadow: 0 0 0 4px rgba(139,92,246,0.30), 0 4px 12px rgba(0,0,0,0.5);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function MapFABControls({ defaultCenter, defaultZoom }) {
  const map = useMap();
  const container = map.getContainer();

  const fabBase = {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#8b5cf6',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
    transition: 'transform 0.18s ease, filter 0.18s ease',
    outline: 'none',
    userSelect: 'none',
  };

  const onEnter = (e) => {
    e.currentTarget.style.transform = 'scale(1.08)';
    e.currentTarget.style.filter = 'brightness(1.15)';
  };

  const onLeave = (e) => {
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.filter = 'brightness(1)';
  };

  return createPortal(
    <div
      style={{
        position: 'absolute',
        right: 20,
        bottom: 100,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'all',
      }}
    >
      <button
        style={fabBase}
        onClick={() => map.zoomIn()}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        title="Zoom In"
      >
        +
      </button>

      <button
        style={fabBase}
        onClick={() => map.zoomOut()}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        title="Zoom Out"
      >
        -
      </button>

      <button
        style={{ ...fabBase, fontSize: 16 }}
        onClick={() => map.setView(defaultCenter, defaultZoom)}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        title="Recenter"
      >
        o
      </button>
    </div>,
    container
  );
}

// ─── Main MapView Component ───────────────────────────────────────

function MapView({
  origin,
  destination,
  routeResult,
  routeMode,
  selectedMode,
  graphNodes,
  graphEdges,
  anomalyEdgeIds,
  anomalies,
  selectedAnomalyEdgeId,
  selectedBBox,
  bboxStart,
  onMapClick,
  onOriginDrag,
  onDestinationDrag,
}) {
  // Default center: Ahsanullah University of Science and Technology area
  const defaultCenter = [23.7639, 90.4066];
  const defaultZoom = 14;

  const routeCoords =
    routeResult?.legs?.flatMap((leg) => leg.geometry?.map((point) => [point.lat, point.lng]) || []) || [];

  const singleModeLineColor = SINGLE_MODE_COLORS[selectedMode] || '#22c55e';

  const coloredSegments = useMemo(() => {
    if (routeMode !== 'multimodal') {
      return [];
    }

    const legSegments = (routeResult?.legs || [])
      .filter((leg) => Array.isArray(leg.geometry) && leg.geometry.length >= 2)
      .map((leg, idx) => ({
        key: `leg-${idx}`,
        mode: leg.mode,
        color: SEGMENT_MODE_COLORS[leg.mode] || '#22c55e',
        positions: leg.geometry.map((p) => [p.lat, p.lng]),
      }));

    if (legSegments.length > 0) {
      return legSegments;
    }

    const suggestions = routeResult?.multimodal_suggestions || [];
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return [];
    }

    const shortest = suggestions.find((s) => s.strategy === 'shortest_distance');
    const fastest = suggestions.find((s) => s.strategy === 'fastest_time');
    const chosen = shortest || fastest;
    if (!chosen || !Array.isArray(chosen.segments)) {
      return [];
    }

    return chosen.segments
      .filter((seg) => Array.isArray(seg.geometry) && seg.geometry.length >= 2)
      .map((seg, idx) => ({
        key: `seg-${idx}`,
        mode: seg.recommended_vehicle,
        color: SEGMENT_MODE_COLORS[seg.recommended_vehicle] || '#22c55e',
        positions: seg.geometry.map((p) => [p.lat, p.lng]),
      }));
  }, [routeResult, routeMode]);

  const originDragHandlers = useMemo(
    () => ({
      dragend(e) {
        const latlng = e.target.getLatLng();
        if (onOriginDrag) {
          onOriginDrag({ lat: latlng.lat, lng: latlng.lng });
        }
      },
    }),
    [onOriginDrag]
  );

  const destinationDragHandlers = useMemo(
    () => ({
      dragend(e) {
        const latlng = e.target.getLatLng();
        if (onDestinationDrag) {
          onDestinationDrag({ lat: latlng.lat, lng: latlng.lng });
        }
      },
    }),
    [onDestinationDrag]
  );

  // Filter nodes by selected mode and compute their visualization
  const filteredNodes = useMemo(() => {
    if (!graphNodes || !Array.isArray(graphNodes)) return [];

    if (routeMode === 'multimodal') {
      return graphNodes.map((node) => ({
        ...node,
        position: [node.lat, node.lng],
        color: '#3b82f6',
        opacity: 0.78,
      }));
    }

    return graphNodes
      .filter((node) => {
        // Show node if it's accessible by the current mode
        return node.accessible_modes && node.accessible_modes.includes(selectedMode);
      })
      .map((node) => ({
        ...node,
        position: [node.lat, node.lng],
        color: MODE_NODE_COLORS[selectedMode] || '#60a5fa',
        // Calculate opacity based on how many modes can access this node
        opacity: Math.min(0.9, 0.5 + (node.accessible_modes.length * 0.1)),
      }));
  }, [graphNodes, selectedMode, routeMode]);

  const nodeLookup = useMemo(() => {
    const map = new Map();
    (graphNodes || []).forEach((n) => map.set(String(n.id), n));
    return map;
  }, [graphNodes]);

  const anomalyPolylines = useMemo(() => {
    if (!Array.isArray(graphEdges) || graphEdges.length === 0) {
      return [];
    }
    const affected = new Set(anomalyEdgeIds || []);
    const highlighted = [];

    const anomalyByEdge = new Map();
    (anomalies || []).forEach((a) => {
      (a.edge_ids || a.affected_edges || []).forEach((eid) => {
        if (!anomalyByEdge.has(eid)) {
          anomalyByEdge.set(eid, []);
        }
        anomalyByEdge.get(eid).push(a);
      });
    });

    graphEdges.forEach((edge, idx) => {
      const edgeId = `${edge.source}->${edge.target}`;
      if (!affected.has(edgeId) && edgeId !== selectedAnomalyEdgeId) {
        return;
      }

      let positions = [];
      if (Array.isArray(edge.geometry) && edge.geometry.length >= 2) {
        positions = edge.geometry
          .map((pt) => {
            if (Array.isArray(pt) && pt.length >= 2) {
              return [Number(pt[0]), Number(pt[1])];
            }
            return null;
          })
          .filter(Boolean);
      }

      if (positions.length < 2) {
        const src = nodeLookup.get(String(edge.source));
        const dst = nodeLookup.get(String(edge.target));
        if (!src || !dst) {
          return;
        }
        positions = [[src.lat, src.lng], [dst.lat, dst.lng]];
      }

      highlighted.push({
        key: `anomaly-edge-${idx}`,
        positions,
        selected: edgeId === selectedAnomalyEdgeId,
        edgeId,
        anomalies: anomalyByEdge.get(edgeId) || [],
      });
    });

    return highlighted;
  }, [graphEdges, anomalyEdgeIds, selectedAnomalyEdgeId, nodeLookup, anomalies]);

  const bboxPolyline = useMemo(() => {
    if (!selectedBBox || selectedBBox.length !== 4) {
      return null;
    }
    const [south, west, north, east] = selectedBBox;
    return [
      [south, west],
      [south, east],
      [north, east],
      [north, west],
      [south, west],
    ];
  }, [selectedBBox]);

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      preferCanvas={true}
    >
      {/* ─── Base tile layer ──────────────────────────────── */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <MapClickHandler onMapClick={onMapClick} />
      <MapFABControls defaultCenter={defaultCenter} defaultZoom={defaultZoom} />


      {origin && (
        <Marker position={[origin.lat, origin.lng]} icon={originIcon} draggable eventHandlers={originDragHandlers}>
          <Popup>
            <span style={{ color: '#22c55e', fontWeight: 600 }}>Origin</span>
            <br />
            {origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}
            <br />
            Drag to update
          </Popup>
        </Marker>
      )}

      {destination && (
        <Marker
          position={[destination.lat, destination.lng]}
          icon={destIcon}
          draggable
          eventHandlers={destinationDragHandlers}
        >
          <Popup>
            <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Destination</span>
            <br />
            {destination.lat.toFixed(5)}, {destination.lng.toFixed(5)}
            <br />
            Drag to update
          </Popup>
        </Marker>
      )}

      {coloredSegments.length > 0 ? (
        coloredSegments.map((seg) => (
          <Polyline
            key={seg.key}
            positions={seg.positions}
            pathOptions={{
              color: seg.color,
              weight: 6,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))
      ) : routeCoords.length >= 2 ? (
        <Polyline
          positions={routeCoords}
          pathOptions={{
            color: singleModeLineColor,
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      ) : null}

      {anomalyPolylines.map((line) => (
        <Polyline
          key={line.key}
          positions={line.positions}
          pathOptions={{
            color: line.selected ? '#f97316' : '#ef4444',
            weight: line.selected ? 7 : 5,
            opacity: line.selected ? 0.95 : 0.75,
            lineCap: 'round',
            lineJoin: 'round',
            dashArray: line.selected ? null : '8 6',
          }}
        >
          <Popup>
            <div style={{ minWidth: 200 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Affected Edge</div>
              <div style={{ fontSize: 12, marginBottom: 6 }}>{line.edgeId}</div>
              {line.anomalies.slice(0, 3).map((a) => (
                <div key={a.anomaly_id} style={{ fontSize: 12, marginBottom: 4 }}>
                  {a.type}: x{Number(a.severity || a.weight_multiplier || 1).toFixed(1)}
                </div>
              ))}
            </div>
          </Popup>
        </Polyline>
      ))}

      {bboxPolyline && (
        <Polyline
          positions={bboxPolyline}
          pathOptions={{
            color: '#f59e0b',
            weight: 3,
            opacity: 0.9,
            dashArray: '8 6',
          }}
        />
      )}

      {bboxStart && (
        <CircleMarker
          center={[bboxStart.lat, bboxStart.lng]}
          radius={6}
          pathOptions={{
            color: '#f59e0b',
            weight: 2,
            fillColor: '#fbbf24',
            fillOpacity: 0.9,
          }}
        />
      )}

      {/* ─── Graph node dots (filtered by selected mode) ───── */}
      {filteredNodes.map((node, idx) => (
        <CircleMarker
          key={`graph-node-${node.id}-${idx}`}
          center={node.position}
          radius={2.2}
          pathOptions={{
            color: node.color,
            weight: 1.5,
            fillColor: node.color,
            fillOpacity: node.opacity,
          }}
        >
          <Popup>
            <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: node.color }}>
                Node {node.id}
              </div>
              <div style={{ fontSize: 11, marginBottom: 2 }}>
                {node.lat.toFixed(5)}, {node.lng.toFixed(5)}
              </div>
              <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                Accessible to:
              </div>
              <div style={{ fontSize: 10, marginTop: 2 }}>
                {node.accessible_modes?.length > 0 ? (
                  node.accessible_modes.map((m) => (
                    <div key={m} style={{ color: MODE_NODE_COLORS[m] }}>
                      • {m}
                    </div>
                  ))
                ) : (
                  <span style={{ color: '#666' }}>No modes</span>
                )}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

export default MapView;
