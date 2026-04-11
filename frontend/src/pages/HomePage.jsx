/*
 * HomePage — Landing / Dashboard Page
 * ======================================
 * Displays:
 *   - Project hero section with description
 *   - Feature cards highlighting key capabilities
 *   - Backend status dashboard
 *   - Quick-start button to navigate to the MapPage
 *
 * Integration:
 *   - Receives apiStatus from App.jsx to show backend health
 *   - Calls onNavigateToMap() to switch to the routing interface
 */

function HomePage({ onNavigateToMap, apiStatus }) {
  const features = [
    {
      icon: '⬡',
      title: 'Multi-Modal Routing',
      description: 'Combine car, bike, walk, and transit for optimal multi-leg journeys with configurable switch penalties.',
      accent: '#38bdf8',
    },
    {
      icon: '⚡',
      title: 'Real-Time Anomalies',
      description: 'Ingest accidents, closures, and weather events. Routes dynamically adjust with severity-based weight multipliers.',
      accent: '#f97316',
    },
    {
      icon: '◈',
      title: 'ML Congestion Prediction',
      description: 'Machine learning predicts edge traversal times using historical patterns, time-of-day, and road characteristics.',
      accent: '#14b8a6',
    },
    {
      icon: '▦',
      title: 'Graph Snapshots',
      description: 'Export the current road graph state for debugging, visualization, and integration testing.',
      accent: '#a78bfa',
    },
  ];

  const systemMetrics = [
    { value: '4.2K+',  label: 'Graph Nodes',         mono: true },
    { value: '<2.5s',  label: 'Avg Latency',          mono: true },
    { value: '12',     label: 'Active Routes',         mono: true },
    { value: '99.8%',  label: 'Engine Uptime',         mono: true },
  ];

  return (
    <div className="animate-fade-in" style={{ background: 'var(--bg-deep)', width: '100%' }}>

      {/* ═══ Hero Section ══════════════════════════════════════ */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#000000',
        marginTop: 0,
      }}>
        {/* Radial glow backdrop */}
        <div className="radial-glow" style={{
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }} />
        <div className="radial-glow" style={{
          width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(20,184,166,0.10) 0%, transparent 70%)',
          top: '20%', right: '10%',
        }} />

        {/* Node-based map network background */}
        <svg
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
            opacity: 0.4,
            pointerEvents: 'none',
          }}
          viewBox="0 0 1200 600"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor: 'rgba(56,189,248,0.3)', stopOpacity: 1}} />
              <stop offset="100%" style={{stopColor: 'rgba(20,184,166,0.2)', stopOpacity: 1}} />
            </linearGradient>
          </defs>
          
          {/* Network edges/paths - OSM style */}
          <g stroke="url(#edgeGradient)" strokeWidth="1.5" fill="none">
            {/* Major routes */}
            <path d="M100 50 L 300 180 L 500 100 L 700 280 L 900 120 L 1100 320" />
            <path d="M150 500 L 350 350 L 550 480 L 750 320 L 950 450 L 1100 280" />
            <path d="M50 200 L 200 350 L 350 150 L 600 400 L 850 200 L 1050 450" />
            
            {/* Secondary routes */}
            <path d="M100 50 L 100 300 L 100 550" />
            <path d="M300 180 L 300 400" />
            <path d="M500 100 L 500 480" />
            <path d="M700 280 L 700 500" />
            <path d="M900 120 L 900 450" />
            
            {/* Cross-connections */}
            <path d="M200 150 Q 400 250, 600 180" />
            <path d="M400 200 Q 600 350, 800 250" />
            <path d="M600 320 Q 800 400, 1000 350" />
          </g>
          
          {/* Network nodes - city/intersection points */}
          <g fill="#38bdf8" opacity="0.8">
            <circle cx="100" cy="50" r="3" />
            <circle cx="300" cy="180" r="3.5" />
            <circle cx="500" cy="100" r="3" />
            <circle cx="700" cy="280" r="4" />
            <circle cx="900" cy="120" r="3" />
            <circle cx="1100" cy="320" r="3.5" />
            
            <circle cx="150" cy="500" r="3" />
            <circle cx="350" cy="350" r="3.5" />
            <circle cx="550" cy="480" r="3" />
            <circle cx="750" cy="320" r="3.5" />
            <circle cx="950" cy="450" r="3" />
            
            <circle cx="50" cy="200" r="3" />
            <circle cx="200" cy="350" r="3" />
            <circle cx="1050" cy="450" r="3" />
          </g>
          
          {/* Glow effect on major nodes */}
          <g fill="none" stroke="#14b8a6" strokeWidth="1" opacity="0.3">
            <circle cx="700" cy="280" r="8" />
            <circle cx="550" cy="480" r="8" />
            <circle cx="300" cy="180" r="8" />
          </g>
        </svg>

        <div style={{ position: 'relative', maxWidth: 780, width: '100%', textAlign: 'center', zIndex: 1 }}>
          {/* Tag pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 16px', marginBottom: 28,
            background: 'rgba(56,189,248,0.08)',
            border: '1px solid rgba(56,189,248,0.22)',
            borderRadius: 999, fontSize: 11, fontWeight: 600,
            color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.10em',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} className="animate-pulse-soft" />
            Real-Time Routing Engine
          </div>

          <h2 style={{
            fontSize: 'clamp(42px, 7vw, 72px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            margin: '0 0 20px',
            color: '#fff',
          }}>
            GoliTransit
            <span style={{
              display: 'block',
              background: 'linear-gradient(90deg, #38bdf8, #14b8a6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              AI Engine
            </span>
          </h2>

          <p style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 10, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.65 }}>
            Multi-Modal Hyper-Local Routing Engine
          </p>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.7 }}>
            Intelligent route planning with real-time traffic anomaly handling
            and ML-based congestion prediction.
          </p>

          {/* CTA group */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              id="cta-open-map"
              onClick={onNavigateToMap}
              className="btn-accent"
              style={{ padding: '13px 32px', fontSize: 15 }}
            >
              Launch Route Engine →
            </button>
            <button
              style={{
                padding: '13px 28px', fontSize: 14,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-mid)',
                borderRadius: 999, color: 'var(--text-secondary)',
                cursor: 'default', fontWeight: 500,
              }}
            >
              ◈ View Docs
            </button>
          </div>
        </div>
      </section>

      {/* ═══ System Metrics Bar ════════════════════════════════ */}
      <section style={{ padding: '0 24px 72px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 1,
            background: 'var(--border-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            {systemMetrics.map((m, i) => (
              <div key={i} style={{
                background: 'var(--bg-surface)',
                padding: '28px 24px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 40, fontWeight: 600,
                  color: '#fff', lineHeight: 1.1,
                  marginBottom: 6,
                }}>
                  {m.value}
                </div>
                <div className="metric-label">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Feature Grid ══════════════════════════════════════ */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 40, textAlign: 'center' }}>
            <div className="section-label" style={{ marginBottom: 10 }}>System Modules</div>
            <h3 style={{ fontSize: 32, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
              Control Surface
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="sys-card animate-slide-up"
                style={{ padding: 28, animationDelay: `${idx * 80}ms` }}
              >
                {/* Icon */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${feature.accent}18`,
                  border: `1px solid ${feature.accent}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: feature.accent, marginBottom: 18,
                  fontWeight: 700,
                }}>
                  {feature.icon}
                </div>

                <h4 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                  {feature.title}
                </h4>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 20px' }}>
                  {feature.description}
                </p>

                {/* Arrow indicator */}
                <div style={{ fontSize: 18, color: feature.accent, fontWeight: 700 }}>→</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ System Status Panel ═══════════════════════════════ */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 16,
            padding: '32px 36px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <div className="section-label" style={{ marginBottom: 4 }}>Live Telemetry</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>Backend Engine Status</h3>
              </div>
              {apiStatus && (
                <span className={`badge ${apiStatus.status === 'healthy' ? 'badge-healthy' : apiStatus.status === 'degraded' ? 'badge-warn' : 'badge-critical'}`}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} className="animate-pulse-soft" />
                  {apiStatus.status || 'unknown'}
                </span>
              )}
            </div>

            {apiStatus ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
                <StatusCard label="API Health"    value={apiStatus.status || 'unknown'} good={apiStatus.status === 'healthy'} />
                <StatusCard label="Graph Loaded"  value={apiStatus.graph?.loaded ? 'Yes' : 'No'} good={apiStatus.graph?.loaded} />
                <StatusCard label="Nodes"         value={apiStatus.graph?.nodes?.toLocaleString() || '0'} />
                <StatusCard label="Edges"         value={apiStatus.graph?.edges?.toLocaleString() || '0'} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 14 }}>
                <span style={{ width: 16, height: 16, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                Connecting to routing engine...
              </div>
            )}
          </div>
        </div>
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── Status Card Sub-Component ────────────────────────────────── */

function StatusCard({ label, value, good }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 10,
      padding: '14px 16px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 6, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{
        fontSize: 20, fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace',
        color: good === true ? '#34d399' : good === false ? '#f87171' : 'var(--text-primary)',
      }}>
        {value}
      </div>
    </div>
  );
}

export default HomePage;
