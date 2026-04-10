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

/* ─── HUD token shortcuts ──────────────────────────────────────── */
const HUD = {
  card:   '#161618',
  surface:'#1c1c1e',
  raised: '#262626',
  green:  '#22c55e',
  purple: '#8b5cf6',
  amber:  '#f59e0b',
  text:   '#ffffff',
  muted:  '#a3a3a3',
  border: 'rgba(255,255,255,0.06)',
};

function MapPage({ apiStatus }) {
  // Route state
  const [origin, setOrigin]           = useState(null);   // { lat, lng }
  const [destination, setDestination] = useState(null);   // { lat, lng }
  const [modes, setModes]             = useState(['car']); // selected transport modes
  const [routeResult, setRouteResult] = useState(null);   // API response
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState(null);

  // Anomaly state
  const [anomalies, setAnomalies] = useState([]);

  // ─── Handle map clicks to set origin/destination ──────────
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
    /*
     * Root layer: fixed, covers entire viewport.
     * The App navbar (z-index 100) stays visible above this (z-index 10).
     * The footer is intentionally hidden behind the map on this page.
     */
    <div style={{
      position: 'fixed', inset: 0,
      zIndex: 10,
      overflow: 'hidden',
      background: '#0a0a0a',
    }}>

      {/* ══════════════════════════════════════════════════════
          LAYER 0 — Full-screen map (background)
      ══════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', inset: 0,
        zIndex: 0,
      }}>
        <MapView
          origin={origin}
          destination={destination}
          routeResult={routeResult}
          onMapClick={handleMapClick}
        />
      </div>

      {/* ══════════════════════════════════════════════════════
          LAYER 1 — Subtle dark vignette overlay
      ══════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', inset: 0,
        zIndex: 1,
        background: 'rgba(0,0,0,0.28)',
        pointerEvents: 'none',
      }} />

      {/* ══════════════════════════════════════════════════════
          LAYER 20 — Left floating control card
          (ModeSelector + RoutePanel stacked vertically)
      ══════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute',
        top: 76, left: 20, bottom: 20,
        zIndex: 20,
        width: 292,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflowY: 'auto',
        /* hide scrollbar visually */
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>

        {/* ── Mode selector card ── */}
        <div style={{
          background: '#161618',
          borderRadius: 24,
          padding: '20px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          {/* Card header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9,
            marginBottom: 18,
            paddingBottom: 14,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(139,92,246,0.08))',
              border: '1px solid rgba(139,92,246,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15,
            }}>🚦</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', fontFamily: 'Inter, sans-serif' }}>Transport Mode</div>
              <div style={{ fontSize: 9, color: '#525252', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em' }}>Select your mode</div>
            </div>
          </div>
          <ModeSelector selectedModes={modes} onChange={setModes} />
        </div>

        {/* ── Route planner card ── */}
        <div style={{
          background: '#161618',
          borderRadius: 24,
          padding: '20px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.07)',
          flex: 1,
          overflowY: 'auto',
          scrollbarWidth: 'none',
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

        {/* ── Anomaly panel (conditional) ── */}
        {anomalies.length > 0 && (
          <div style={{
            background: '#161618',
            borderRadius: 24,
            padding: '20px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.75)',
            border: '1px solid rgba(249,115,22,0.22)',
            flexShrink: 0,
          }}>
            <AnomalyAlert anomalies={anomalies} />
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          LAYER 30 — Instruction pill (top center)
      ══════════════════════════════════════════════════════ */}
      {!origin && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: 80, left: '50%',
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
          Tap the map to set your{' '}
          <span style={{ color: HUD.green, fontWeight: 700 }}>origin</span>
        </div>
      )}
      {origin && !destination && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: 80, left: '50%',
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
          Tap the map to set your{' '}
          <span style={{ color: HUD.purple, fontWeight: 700 }}>destination</span>
        </div>
      )}
    </div>
  );
}

export default MapPage;
