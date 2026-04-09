/*
 * MapPage — Interactive Routing Map Interface
 * ==============================================
 * The primary routing interface. Contains:
 *   - Full-screen Leaflet map with route visualization
 *   - Sidebar with route input form and results
 *   - Mode selector for transport modes
 *   - Anomaly alert overlay
 *
 * Integration:
 *   - Uses MapView component for Leaflet map rendering
 *   - Uses RoutePanel for route input/output sidebar
 *   - Uses ModeSelector for transport mode picking
 *   - Uses AnomalyAlert for real-time anomaly notifications
 *   - Calls routeService to compute routes via backend API
 */

import { useState } from 'react';
import MapView from '../components/MapView';
import RoutePanel from '../components/RoutePanel';
import ModeSelector from '../components/ModeSelector';
import AnomalyAlert from '../components/AnomalyAlert';
import { computeRoute } from '../services/routeService';

function MapPage({ apiStatus }) {
  // Route state
  const [origin, setOrigin] = useState(null);           // { lat, lng }
  const [destination, setDestination] = useState(null);  // { lat, lng }
  const [modes, setModes] = useState(['car']);            // selected transport modes
  const [routeResult, setRouteResult] = useState(null);  // API response
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Anomaly state
  const [anomalies, setAnomalies] = useState([]);

  // ─── Handle map clicks to set origin/destination ──────────
  const handleMapClick = (latlng) => {
    if (!origin) {
      setOrigin(latlng);
    } else if (!destination) {
      setDestination(latlng);
    } else {
      // Reset: start new route
      setOrigin(latlng);
      setDestination(null);
      setRouteResult(null);
      setError(null);
    }
  };

  // ─── Compute route via API ────────────────────────────────
  const handleComputeRoute = async () => {
    if (!origin || !destination) {
      setError('Please set both origin and destination by clicking the map.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await computeRoute({
        origin,
        destination,
        modes,
        optimize: 'time',
        avoid_anomalies: true,
      });
      setRouteResult(result);
    } catch (err) {
      setError(err.message || 'Failed to compute route');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Clear current route ──────────────────────────────────
  const handleClear = () => {
    setOrigin(null);
    setDestination(null);
    setRouteResult(null);
    setError(null);
  };

  return (
    <div className="flex h-[calc(100vh-96px)]">
      {/* ─── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-80 flex-shrink-0 glass-panel m-0 rounded-none border-y-0 border-l-0 overflow-y-auto flex flex-col">
        {/* Mode Selector */}
        <div className="p-4 border-b border-gray-700/50">
          <ModeSelector
            selectedModes={modes}
            onChange={setModes}
          />
        </div>

        {/* Route Panel */}
        <div className="flex-1 p-4">
          <RoutePanel
            origin={origin}
            destination={destination}
            routeResult={routeResult}
            isLoading={isLoading}
            error={error}
            onCompute={handleComputeRoute}
            onClear={handleClear}
          />
        </div>

        {/* Anomaly Alerts */}
        {anomalies.length > 0 && (
          <div className="p-4 border-t border-gray-700/50">
            <AnomalyAlert anomalies={anomalies} />
          </div>
        )}
      </aside>

      {/* ─── Map Area ────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <MapView
          origin={origin}
          destination={destination}
          routeResult={routeResult}
          onMapClick={handleMapClick}
        />

        {/* Map overlay: click instructions */}
        {!origin && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-panel px-4 py-2 text-sm text-gray-300 animate-fade-in z-[1000]">
            Click the map to set your <span className="text-transit-400 font-semibold">origin</span>
          </div>
        )}
        {origin && !destination && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-panel px-4 py-2 text-sm text-gray-300 animate-fade-in z-[1000]">
            Click the map to set your <span className="text-emerald-400 font-semibold">destination</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default MapPage;
