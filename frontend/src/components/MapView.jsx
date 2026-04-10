/*
 * MapView — Leaflet Map Wrapper Component
 * ==========================================
 * Renders an interactive Leaflet map with:
 *   - OpenStreetMap tile layer
 *   - Origin/destination markers
 *   - Route polyline visualization (from API response geometry)
 *   - Click handler for setting origin/destination
 *   - Custom FAB zoom controls (replaces default Leaflet controls)
 *
 * Integration:
 *   - Receives origin, destination, routeResult from MapPage
 *   - Forwards click events to MapPage via onMapClick callback
 *   - Route geometry comes from backend /route API response legs
 *
 * Dependencies:
 *   - react-leaflet (MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap)
 *   - leaflet CSS (loaded in index.html)
 */

import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// ─── Custom marker icons ──────────────────────────────────────────

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


// ─── Click Handler Sub-Component ─────────────────────────────────

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}


// ─── Custom FAB Zoom Controls ─────────────────────────────────────
// Renders floating action buttons inside the map container via portal.
// Replaces the default Leaflet zoom control (zoomControl={false}).

function MapFABControls({ defaultCenter, defaultZoom }) {
  const map = useMap();
  const container = map.getContainer();

  const fabBase = {
    width: 48, height: 48,
    borderRadius: '50%',
    background: '#8b5cf6',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 700,
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
    <div style={{
      position: 'absolute',
      right: 20,
      bottom: 100,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      pointerEvents: 'all',
    }}>
      {/* Zoom In */}
      <button
        style={fabBase}
        onClick={() => map.zoomIn()}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        title="Zoom In"
      >
        +
      </button>

      {/* Zoom Out */}
      <button
        style={fabBase}
        onClick={() => map.zoomOut()}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        title="Zoom Out"
      >
        −
      </button>

      {/* Recenter */}
      <button
        style={{ ...fabBase, fontSize: 16 }}
        onClick={() => map.setView(defaultCenter, defaultZoom)}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        title="Recenter"
      >
        ⊙
      </button>
    </div>,
    container,
  );
}


// ─── Main MapView Component ───────────────────────────────────────

function MapView({ origin, destination, routeResult, onMapClick }) {
  // Default center: San Francisco (matches config.json default_location)
  const defaultCenter = [37.7749, -122.4194];
  const defaultZoom = 13;

  // Extract route geometry from all legs
  const routeCoords = routeResult?.legs?.flatMap((leg) =>
    leg.geometry?.map((point) => [point.lat, point.lng]) || []
  ) || [];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      {/* ─── Base tile layer ──────────────────────────────── */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* ─── Click handler ────────────────────────────────── */}
      <MapClickHandler onMapClick={onMapClick} />

      {/* ─── Custom FAB zoom controls ─────────────────────── */}
      <MapFABControls defaultCenter={defaultCenter} defaultZoom={defaultZoom} />

      {/* ─── Origin marker ────────────────────────────────── */}
      {origin && (
        <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
          <Popup>
            <span style={{ color: '#22c55e', fontWeight: 600 }}>Origin</span>
            <br />
            {origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}
          </Popup>
        </Marker>
      )}

      {/* ─── Destination marker ───────────────────────────── */}
      {destination && (
        <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
          <Popup>
            <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Destination</span>
            <br />
            {destination.lat.toFixed(5)}, {destination.lng.toFixed(5)}
          </Popup>
        </Marker>
      )}

      {/* ─── Route polyline ───────────────────────────────── */}
      {routeCoords.length >= 2 && (
        <Polyline
          positions={routeCoords}
          pathOptions={{
            color: '#22c55e',
            weight: 5,
            opacity: 0.85,
            dashArray: null,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}
    </MapContainer>
  );
}

export default MapView;
