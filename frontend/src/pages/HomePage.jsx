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
      icon: '🗺️',
      title: 'Multi-Modal Routing',
      description: 'Combine car, bike, walk, and transit for optimal multi-leg journeys with configurable switch penalties.',
    },
    {
      icon: '⚠️',
      title: 'Real-Time Anomalies',
      description: 'Ingest accidents, closures, and weather events. Routes dynamically adjust with severity-based weight multipliers.',
    },
    {
      icon: '🤖',
      title: 'ML Congestion Prediction',
      description: 'Machine learning predicts edge traversal times using historical patterns, time-of-day, and road characteristics.',
    },
    {
      icon: '📊',
      title: 'Graph Snapshots',
      description: 'Export the current road graph state for debugging, visualization, and integration testing.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 animate-fade-in">
      {/* ─── Hero Section ─────────────────────────────────────── */}
      <section className="text-center mb-16">
        <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-transit-300 via-transit-400 to-emerald-400 bg-clip-text text-transparent">
          GoliTransit
        </h2>
        <p className="text-xl text-gray-400 mb-2">
          Multi-Modal Hyper-Local Routing Engine
        </p>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Intelligent route planning with real-time traffic anomaly handling
          and ML-based congestion prediction. Built for the hackathon.
        </p>

        <button
          id="cta-open-map"
          onClick={onNavigateToMap}
          className="mt-8 px-8 py-3 bg-gradient-to-r from-transit-600 to-transit-500 hover:from-transit-500 hover:to-transit-400 text-white font-semibold rounded-xl shadow-lg shadow-transit-500/25 transition-all hover:shadow-transit-500/40 hover:-translate-y-0.5 active:translate-y-0"
        >
          Open Route Map →
        </button>
      </section>

      {/* ─── Feature Cards ────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        {features.map((feature, idx) => (
          <div
            key={idx}
            className="glass-panel p-6 hover:border-transit-500/30 transition-all hover:-translate-y-1 animate-slide-up"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className="text-3xl mb-3">{feature.icon}</div>
            <h3 className="text-lg font-semibold text-gray-200 mb-2">{feature.title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </section>

      {/* ─── Backend Status ───────────────────────────────────── */}
      <section className="glass-panel p-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Backend Status
        </h3>
        {apiStatus ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatusCard label="API" value={apiStatus.status || 'unknown'} good={apiStatus.status === 'healthy'} />
            <StatusCard label="Graph Loaded" value={apiStatus.graph?.loaded ? 'Yes' : 'No'} good={apiStatus.graph?.loaded} />
            <StatusCard label="Nodes" value={apiStatus.graph?.nodes?.toLocaleString() || '0'} />
            <StatusCard label="Edges" value={apiStatus.graph?.edges?.toLocaleString() || '0'} />
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Connecting to backend...</p>
        )}
      </section>
    </div>
  );
}

/* ─── Status Card Sub-Component ────────────────────────────────── */

function StatusCard({ label, value, good }) {
  return (
    <div className="glass-panel-light p-3 text-center">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold ${
        good === true ? 'text-emerald-400' :
        good === false ? 'text-red-400' :
        'text-gray-300'
      }`}>
        {value}
      </div>
    </div>
  );
}

export default HomePage;
