/*
 * RoutePanel — Route Input & Results Sidebar
 * =============================================
 * Displays:
 *   - Origin/destination coordinates (set by map clicks)
 *   - "Compute Route" button
 *   - Computed route details (legs, duration, distance, cost)
 *   - Mode switch information for multi-modal routes
 *   - Error messages
 *
 * Integration:
 *   - Receives state from MapPage (origin, destination, result, error)
 *   - Triggers route computation via onCompute callback
 *   - Route result matches backend RouteResponse schema
 */

const MODE_COLORS = {
  car:     '#22c55e',
  bike:    '#34d399',
  walk:    '#f59e0b',
  transit: '#8b5cf6',
  rickshaw:'#ec4899',
};

function RoutePanel({ origin, destination, routeResult, isLoading, error, onCompute, onClear }) {
  const hasPoints = origin && destination;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Section header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingBottom: 12,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          width: 28, height: 28,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #22c55e22, #22c55e10)',
          border: '1px solid rgba(34,197,94,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13,
        }}>
          🗺
        </div>
        <div>
          <div style={{
            fontSize: 14, fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.01em',
            fontFamily: 'Inter, sans-serif',
          }}>
            Route Planner
          </div>
          <div style={{
            fontSize: 10, color: '#525252',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {!origin ? 'Set origin on map' : !destination ? 'Set destination on map' : 'Ready to compute'}
          </div>
        </div>
      </div>

      {/* ── Waypoints ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <WaypointDisplay
          label="Origin"
          latlng={origin}
          accentColor="#22c55e"
          emptyText="Tap map to set origin"
        />
        <WaypointDisplay
          label="Destination"
          latlng={destination}
          accentColor="#8b5cf6"
          emptyText="Tap map to set destination"
        />
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 0 }}>
        <button
          id="btn-compute-route"
          onClick={onCompute}
          disabled={!hasPoints || isLoading}
          style={{
            flex: 1,
            padding: '14px 0',
            borderRadius: 14,
            border: 'none',
            cursor: (!hasPoints || isLoading) ? 'not-allowed' : 'pointer',
            fontWeight: 800,
            fontSize: 15,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '-0.01em',
            background: (!hasPoints || isLoading)
              ? '#1e1e20'
              : 'linear-gradient(135deg, #16a34a, #22c55e)',
            color: (!hasPoints || isLoading) ? '#404040' : '#0a0a0a',
            boxShadow: (!hasPoints || isLoading)
              ? 'none'
              : '0 8px 24px rgba(34,197,94,0.40), inset 0 1px 0 rgba(255,255,255,0.15)',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={e => {
            if (hasPoints && !isLoading) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(34,197,94,0.55), inset 0 1px 0 rgba(255,255,255,0.15)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = (!hasPoints || isLoading)
              ? 'none'
              : '0 8px 24px rgba(34,197,94,0.40), inset 0 1px 0 rgba(255,255,255,0.15)';
          }}
        >
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
              <span style={{
                width: 15, height: 15,
                border: '2.5px solid rgba(10,10,10,0.25)',
                borderTopColor: '#0a0a0a',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }} />
              Computing…
            </span>
          ) : 'Compute Route →'}
        </button>

        <button
          id="btn-clear-route"
          onClick={onClear}
          style={{
            padding: '14px 16px',
            borderRadius: 14,
            border: '1.5px solid rgba(255,255,255,0.10)',
            background: 'transparent',
            color: '#737373',
            fontWeight: 700,
            fontSize: 13,
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#1e1e20';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.20)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
            e.currentTarget.style.color = '#737373';
          }}
        >
          Clear
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="animate-slide-up"
          style={{
            padding: '11px 14px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.22)',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            color: '#f87171',
            lineHeight: 1.55,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <span style={{ marginRight: 7 }}>⚠</span>{error}
        </div>
      )}

      {/* ── Route result ── */}
      {routeResult && (
        <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Summary metrics */}
          <div style={{
            background: '#111113',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 12px 4px',
              fontSize: 9,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: '#525252',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              Route Summary
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              borderTop: '1px solid rgba(255,255,255,0.04)',
            }}>
              <MetricCell
                value={formatDistance(routeResult.total_distance_m)}
                label="Distance"
                accent="#22c55e"
                borderRight
              />
              <MetricCell
                value={formatDuration(routeResult.total_duration_s)}
                label="Duration"
                accent="#ffffff"
                borderRight
              />
              <MetricCell
                value={`$${routeResult.total_cost.toFixed(2)}`}
                label="Cost"
                accent="#f59e0b"
              />
            </div>
          </div>

          {/* Legs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{
              fontSize: 9, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              color: '#525252',
              fontFamily: 'JetBrains Mono, monospace',
              paddingLeft: 2,
            }}>
              Route Legs
            </div>
            {routeResult.legs.map((leg, idx) => (
              <LegCard key={idx} leg={leg} index={idx} />
            ))}
          </div>

          {/* Mode switches */}
          {routeResult.mode_switches?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{
                fontSize: 9, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.14em',
                color: '#525252',
                fontFamily: 'JetBrains Mono, monospace',
                paddingLeft: 2,
              }}>
                Mode Transfers
              </div>
              {routeResult.mode_switches.map((sw, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px',
                  background: '#111113',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 10,
                }}>
                  <span style={{ fontSize: 14 }}>{getModeEmoji(sw.from_mode)}</span>
                  <span style={{ color: '#404040', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>→</span>
                  <span style={{ fontSize: 14 }}>{getModeEmoji(sw.to_mode)}</span>
                  <span style={{
                    marginLeft: 'auto',
                    color: '#f59e0b',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    +{sw.penalty_time_s}s
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Anomalies avoided */}
          {routeResult.anomalies_avoided > 0 && (
            <div style={{
              padding: '9px 14px',
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.22)',
              borderRadius: 10, fontSize: 12,
              fontWeight: 600,
              color: '#f59e0b',
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'Inter, sans-serif',
            }}>
              <span>⚠</span>
              Avoided {routeResult.anomalies_avoided} anomaly-affected edge(s)
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}


// ─── Sub-Components ───────────────────────────────────────────────

function WaypointDisplay({ label, latlng, accentColor, emptyText }) {
  const coordText = latlng
    ? `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`
    : null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '11px 14px',
      background: latlng ? '#1a1a1c' : '#141416',
      border: latlng
        ? `1px solid ${accentColor}28`
        : '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      transition: 'all 0.2s ease',
    }}>
      {/* Dot */}
      <div style={{
        width: 9, height: 9,
        borderRadius: '50%',
        flexShrink: 0,
        background: latlng ? accentColor : '#2e2e30',
        boxShadow: latlng ? `0 0 10px ${accentColor}70` : 'none',
        transition: 'all 0.2s ease',
      }} />

      {/* Label */}
      <span style={{
        fontSize: 10,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.10em',
        color: latlng ? accentColor : '#404040',
        fontFamily: 'JetBrains Mono, monospace',
        width: 72,
        flexShrink: 0,
        transition: 'color 0.2s ease',
      }}>
        {label}
      </span>

      {/* Coordinate / placeholder */}
      {latlng ? (
        <span style={{
          color: '#a3a3a3',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          fontWeight: 500,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          flex: 1,
          minWidth: 0,
        }}>
          {coordText}
        </span>
      ) : (
        <span style={{
          color: '#404040',
          fontSize: 12,
          fontWeight: 500,
          fontStyle: 'italic',
          fontFamily: 'Inter, sans-serif',
        }}>
          {emptyText}
        </span>
      )}
    </div>
  );
}

function MetricCell({ value, label, accent, borderRight }) {
  return (
    <div style={{
      padding: '8px 10px 10px',
      textAlign: 'center',
      borderRight: borderRight ? '1px solid rgba(255,255,255,0.04)' : 'none',
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 16, fontWeight: 800,
        color: accent || '#fff',
        marginBottom: 2,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 9,
        color: '#525252',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {label}
      </div>
    </div>
  );
}

function LegCard({ leg, index }) {
  const accent = MODE_COLORS[leg.mode] || '#22c55e';
  return (
    <div style={{
      background: '#111113',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 12,
      padding: '8px 12px 8px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Left accent stripe */}
      <div style={{
        position: 'absolute', left: 0, top: 4, bottom: 4, width: 3,
        background: accent,
        borderRadius: 99,
        boxShadow: `0 0 8px ${accent}70`,
      }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 15 }}>{getModeEmoji(leg.mode)}</span>
          <span style={{
            textTransform: 'capitalize',
            color: accent,
            fontSize: 12,
            fontWeight: 800,
            fontFamily: 'Inter, sans-serif',
          }}>
            {leg.mode}
          </span>
        </span>
        <span style={{
          fontSize: 9,
          color: '#525252',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 700,
          background: '#1e1e20',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 6,
          padding: '2px 8px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          Leg {index + 1}
        </span>
      </div>

      <div style={{
        display: 'flex',
        gap: 10,
        fontSize: 10,
        fontWeight: 600,
        color: '#737373',
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        <span>{formatDistance(leg.distance_m)}</span>
        <span style={{ color: '#2a2a2c' }}>|</span>
        <span>{formatDuration(leg.duration_s)}</span>
        <span style={{ color: '#2a2a2c' }}>|</span>
        <span style={{ color: '#f59e0b' }}>${leg.cost.toFixed(2)}</span>
      </div>
    </div>
  );
}


// ─── Helpers ──────────────────────────────────────────────────────

function getModeEmoji(mode) {
  return ({ car: '🚗', bike: '🚲', walk: '🚶', transit: '🚌', rickshaw: '🛺' })[mode] || '📍';
}

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds) {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds)}s`;
}

export default RoutePanel;
