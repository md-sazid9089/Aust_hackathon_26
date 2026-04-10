/*
 * MapPage - Interactive Routing Map Interface
 * ==============================================
 */

import { useEffect, useState } from 'react';
import MapView from '../components/MapView';
import RoutePanel from '../components/RoutePanel';
import ModeSelector from '../components/ModeSelector';
import AnomalyAlert from '../components/AnomalyAlert';
import { computeRoute } from '../services/routeService';
import { getGraphSnapshot } from '../services/api';

const HUD = {
  green: '#22c55e',
  purple: '#8b5cf6',
  muted: '#a3a3a3',
  border: 'rgba(255,255,255,0.06)',
};

function MapPage({ apiStatus }) {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [modes, setModes] = useState(['car']);
  const [routeResult, setRouteResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [graphNodes, setGraphNodes] = useState([]);
  const [anomalies] = useState([]);
  const [panelScale, setPanelScale] = useState(getPanelScale(window.innerHeight));

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
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setPanelScale(getPanelScale(window.innerHeight));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        overflow: 'hidden',
        background: '#0a0a0a',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <MapView
          origin={origin}
          destination={destination}
          routeResult={routeResult}
          graphNodes={graphNodes}
          onMapClick={handleMapClick}
          onOriginDrag={handleOriginDrag}
          onDestinationDrag={handleDestinationDrag}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background: 'rgba(0,0,0,0.28)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 12,
            top: 2,
            left: 10,
            bottom: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: '#161618',
            borderRadius: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              transform: `scale(${panelScale})`,
              transformOrigin: 'top left',
              width: `${100 / panelScale}%`,
            }}
            padding: '14px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.07)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              marginBottom: 14,
              paddingBottom: 12,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(139,92,246,0.08))',
                border: '1px solid rgba(139,92,246,0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
              }}
            >
              🚦
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', fontFamily: 'Inter, sans-serif' }}>
                Transport Mode
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: '#525252',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                }}
              >
                Select your mode
              </div>
            </div>
          </div>
          <ModeSelector selectedModes={modes} onChange={setModes} />
        </div>

        <div
          style={{
            background: '#161618',
            borderRadius: 20,
            padding: '14px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.07)',
            flexShrink: 0,
          }}
        >
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

        {anomalies.length > 0 && (
          <div
            style={{
              background: '#161618',
              borderRadius: 20,
              padding: '14px',
              boxShadow: '0 32px 80px rgba(0,0,0,0.75)',
              border: '1px solid rgba(249,115,22,0.22)',
              flexShrink: 0,
            }}
          >
            <AnomalyAlert anomalies={anomalies} />
          </div>
        )}
      </div>

      {!origin && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            background: 'rgba(22,22,24,0.90)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: `1px solid ${HUD.border}`,
            borderRadius: 999,
            padding: '9px 22px',
            fontSize: 13,
            color: HUD.muted,
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          Tap the map to set your <span style={{ color: HUD.green, fontWeight: 700 }}>origin</span>
        </div>
      )}

      {origin && !destination && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            background: 'rgba(22,22,24,0.90)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: `1px solid ${HUD.border}`,
            borderRadius: 999,
            padding: '9px 22px',
            fontSize: 13,
            color: HUD.muted,
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          Tap the map to set your <span style={{ color: HUD.purple, fontWeight: 700 }}>destination</span>
        </div>
      )}
    </div>
  );
}

export default MapPage;
