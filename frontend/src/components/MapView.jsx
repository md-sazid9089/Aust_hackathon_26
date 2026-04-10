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
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

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

function MapView({ origin, destination, routeResult, onMapClick, onOriginDrag, onDestinationDrag }) {
  // Default center: Dhaka, near Ahsanullah University of Science and Technology
  const defaultCenter = [23.7391, 90.3703];
  const defaultZoom = 14;

  const routeCoords =
    routeResult?.legs?.flatMap((leg) => leg.geometry?.map((point) => [point.lat, point.lng]) || []) || [];

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

  return (
    <MapContainer center={defaultCenter} zoom={defaultZoom} style={{ width: '100%', height: '100%' }} zoomControl={false}>
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

      {routeCoords.length >= 2 && (
        <Polyline
          positions={routeCoords}
          pathOptions={{
            color: '#22c55e',
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}
    </MapContainer>
  );
}

export default MapView;
