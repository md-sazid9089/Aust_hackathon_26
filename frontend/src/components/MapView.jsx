/*
 * MapView — Leaflet Map Wrapper Component
 * ==========================================
 * Renders an interactive Leaflet map with:
 *   - OpenStreetMap tile layer
 *   - Origin/destination markers
 *   - Route polyline visualization (from API response geometry)
 *   - Click handler for setting origin/destination
 *
 * Integration:
 *   - Receives origin, destination, routeResult from MapPage
 *   - Forwards click events to MapPage via onMapClick callback
 *   - Route geometry comes from backend /route API response legs
 *
 * Dependencies:
 *   - react-leaflet (MapContainer, TileLayer, Marker, Polyline, useMapEvents)
 *   - leaflet CSS (loaded in index.html)
 */

import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';

// ─── Custom marker icons (avoid default Leaflet icon issues with bundlers) ───

const originIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width: 24px; height: 24px; border-radius: 50%;
    background: linear-gradient(135deg, #38bdf8, #0ea5e9);
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(14, 165, 233, 0.5);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const destIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width: 24px; height: 24px; border-radius: 50%;
    background: linear-gradient(135deg, #34d399, #10b981);
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.5);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});


// ─── Click Handler Sub-Component ────────────────────────────────

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}


// ─── Main MapView Component ─────────────────────────────────────

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
      zoomControl={true}
    >
      {/* ─── Base tile layer ─────────────────────────────────── */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* ─── Click handler ───────────────────────────────────── */}
      <MapClickHandler onMapClick={onMapClick} />

      {/* ─── Origin marker ───────────────────────────────────── */}
      {origin && (
        <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
          <Popup>
            <span style={{ color: '#0ea5e9', fontWeight: 600 }}>Origin</span>
            <br />
            {origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}
          </Popup>
        </Marker>
      )}

      {/* ─── Destination marker ──────────────────────────────── */}
      {destination && (
        <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
          <Popup>
            <span style={{ color: '#10b981', fontWeight: 600 }}>Destination</span>
            <br />
            {destination.lat.toFixed(5)}, {destination.lng.toFixed(5)}
          </Popup>
        </Marker>
      )}

      {/* ─── Route polyline ──────────────────────────────────── */}
      {routeCoords.length >= 2 && (
        <Polyline
          positions={routeCoords}
          pathOptions={{
            color: '#38bdf8',
            weight: 5,
            opacity: 0.8,
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
