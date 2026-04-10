/*
 * MapPage - Interactive Routing Map Interface
 * ==============================================
 * Full-screen map with floating HUD panels matching the design spec.
 */

import { useEffect, useState } from 'react';
import MapView from '../components/MapView';
import RoutePanel from '../components/RoutePanel';
import ModeSelector from '../components/ModeSelector';
import AnomalyAlert from '../components/AnomalyAlert';
import ColorLegend from '../components/ColorLegend';
import { computeRoute } from '../services/routeService';
import { getGraphSnapshot } from '../services/api';

function MapPage({ apiStatus }) {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [modes, setModes] = useState(['car']);
  const [routeResult, setRouteResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [graphNodes, setGraphNodes] = useState([]);
  const [anomalies] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const loadGraphNodes = async () => {
      try {
        const snapshot = await getGraphSnapshot(false);
        if (isMounted) {
          setGraphNodes(Array.isArray(snapshot?.nodes) ? snapshot.nodes : []);
        }
      } catch (err) {
        console.error('Failed to load graph nodes:', err);
      }
    };
    loadGraphNodes();
    return () => { isMounted = false; };
  }, []);

  const handleMapClick = (latlng) => {
    if (!origin) {
      setOrigin(latlng);
    } else if (!destination) {
      setDestination(latlng);
    } else {
      setOrigin(latlng);
      setDestination(null);
      setRouteResult(null);
      setError(null);
    }
  };

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

  const handleClear = () => {
    setOrigin(null);
    setDestination(null);
    setRouteResult(null);
    setError(null);
  };

  const handleOriginDrag = (latlng) => {
    setOrigin(latlng);
    setRouteResult(null);
    setError(null);
  };

  const handleDestinationDrag = (latlng) => {
    setDestination(latlng);
    setRouteResult(null);
    setError(null);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10,
      overflow: 'hidden',
      background: '#070709',
    }}>
      {/* Full-screen map */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <MapView
          origin={origin}
          destination={destination}
          routeResult={routeResult}
          graphNodes={graphNodes}
          modes={modes}
          onMapClick={handleMapClick}
          onOriginDrag={handleOriginDrag}
          onDestinationDrag={handleDestinationDrag}
        />
      </div>

      {/* Dark overlay for contrast */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        background: 'linear-gradient(135deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.35) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Color Legend */}
      <ColorLegend />

      {/* Floating side panel */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        bottom: 10,
        width: 300,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        overflowY: 'auto',
        overflowX: 'hidden',
        pointerEvents: 'auto',
        scrollbarWidth: 'none',
      }}>
        {/* Transport Mode Card */}
        <div style={{
          background: 'rgba(18,18,22,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 22,
          padding: 16,
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)',
        }}>
          <ModeSelector selectedModes={modes} onChange={setModes} />
        </div>

        {/* Route Planner Card */}
        <div style={{
          background: 'rgba(18,18,22,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 22,
          padding: 16,
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)',
        }}>
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

        {/* Anomaly Alert Card */}
        {anomalies.length > 0 && (
          <div style={{
            background: 'rgba(18,18,22,0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 22,
            padding: 16,
            border: '1px solid rgba(249,115,22,0.18)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          }}>
            <AnomalyAlert anomalies={anomalies} />
          </div>
        )}
      </div>

      {/* Top-center instruction pill */}
      {!origin && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            background: 'rgba(18,18,22,0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 999,
            padding: '10px 24px',
            fontSize: 13,
            color: '#a3a3a3',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          Tap the map to set your <span style={{ color: '#22c55e', fontWeight: 700 }}>origin</span>
        </div>
      )}

      {origin && !destination && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            background: 'rgba(18,18,22,0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 999,
            padding: '10px 24px',
            fontSize: 13,
            color: '#a3a3a3',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          Tap the map to set your <span style={{ color: '#8b5cf6', fontWeight: 700 }}>destination</span>
        </div>
      )}
    </div>
  );
}

export default MapPage;
