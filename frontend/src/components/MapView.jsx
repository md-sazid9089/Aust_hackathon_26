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

const SINGLE_MODE_COLORS = {
  car: '#ef4444',
  bike: '#22c55e',
  rickshaw: '#facc15',
  walk: '#f97316',
  transit: '#3b82f6',
};

// Route-level colors
const ROUTE_COLORS = {
  min_time: '#3b82f6',      // Blue for minimum time
  min_distance: '#22c55e',  // Green for minimum distance
};

// Mode-based segment colors (shown when single route selected)
const SEGMENT_MODE_COLORS = {
  car: '#ef4444',      // red
  bike: '#8b5cf6',     // purple
  rickshaw: '#facc15', // yellow
  walk: '#9ca3af',     // gray
  transit: '#dc2626',  // red (bus)
};

// Mode-specific node colors
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

function MapView({ origin, destination, routeResult, selectedMode, graphNodes, selectedRouteType, onRouteTypeChange, onMapClick, onOriginDrag, onDestinationDrag }) {
  // Default center: Ahsanullah University of Science and Technology area
  const defaultCenter = [23.7639, 90.4066];
  const defaultZoom = 14;

  const routeCoords =
    routeResult?.legs?.flatMap((leg) => leg.geometry?.map((point) => [point.lat, point.lng]) || []) || [];

  const singleModeLineColor = SINGLE_MODE_COLORS[selectedMode] || '#22c55e';

  // Build route segments from legs
  const buildRouteSegments = (legs, routeType) => {
    if (!legs || !Array.isArray(legs)) return [];
    
    return legs
      .flatMap((leg, legIdx) => {
        if (!leg.geometry || leg.geometry.length < 2) return [];
        
        return [{
          key: `${routeType}-leg-${legIdx}`,
          routeType,
          mode: leg.mode,
          positions: leg.geometry.map((p) => [p.lat, p.lng]),
          distance_m: leg.distance_m,
          duration_s: leg.duration_s,
        }];
      });
  };

  // Process both routes
  const allRoutes = useMemo(() => {
    if (!routeResult) return { timeRoute: [], distRoute: [], combined: [] };
    
    const timeRoute = buildRouteSegments(routeResult.min_time_route?.legs, 'time');
    const distRoute = buildRouteSegments(routeResult.min_distance_route?.legs, 'distance');
    
    return { timeRoute, distRoute, combined: [...timeRoute, ...distRoute] };
  }, [routeResult]);

  // Render routes based on selection
  const renderedRoutes = useMemo(() => {
    if (selectedRouteType === 'both') {
      // Show both routes with route colors (merge overlaps)
      return [
        ...allRoutes.timeRoute.map((seg) => ({
          ...seg,
          color: ROUTE_COLORS.min_time,
          weight: 5,
          opacity: 0.8,
        })),
        ...allRoutes.distRoute.map((seg) => ({
          ...seg,
          color: ROUTE_COLORS.min_distance,
          weight: 5,
          opacity: 0.8,
        })),
      ];
    } else if (selectedRouteType === 'time' && allRoutes.timeRoute.length > 0) {
      // Show only time route with mode colors
      return allRoutes.timeRoute.map((seg) => ({
        ...seg,
        color: SEGMENT_MODE_COLORS[seg.mode] || '#3b82f6',
        weight: 6,
        opacity: 0.95,
      }));
    } else if (selectedRouteType === 'distance' && allRoutes.distRoute.length > 0) {
      // Show only distance route with mode colors
      return allRoutes.distRoute.map((seg) => ({
        ...seg,
        color: SEGMENT_MODE_COLORS[seg.mode] || '#22c55e',
        weight: 6,
        opacity: 0.95,
      }));
    }
    return [];
  }, [allRoutes, selectedRouteType]);

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
  }, [graphNodes, selectedMode]);

  const nodeCoords = useMemo(() => {
    return filteredNodes.map((node) => node.position);
  }, [filteredNodes]);

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

      {/* ─── Both routes or single route polylines ──────────── */}
      {renderedRoutes.map((seg) => (
        <Polyline
          key={seg.key}
          positions={seg.positions}
          pathOptions={{
            color: seg.color,
            weight: seg.weight || 5,
            opacity: seg.opacity || 0.8,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      ))}

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
