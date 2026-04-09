/*
 * AnomalyAlert — Real-Time Anomaly Notification Component
 * ==========================================================
 * Shows active traffic anomalies affecting the routing area.
 *
 * Display:
 *   - Color-coded severity badges (low=blue, medium=yellow, high=orange, critical=red)
 *   - Anomaly type icon and description
 *   - Countdown timer to expiry
 *
 * Integration:
 *   - Receives anomaly list from MapPage state
 *   - Anomalies come from GET /anomaly API via routeService
 *   - Can be polled on an interval for real-time updates
 */

function AnomalyAlert({ anomalies }) {
  if (!anomalies || anomalies.length === 0) return null;

  return (
    <div className="space-y-2 animate-slide-up">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse-soft" />
        Active Anomalies ({anomalies.length})
      </h3>

      {anomalies.map((anomaly) => (
        <div
          key={anomaly.anomaly_id}
          className={`p-3 rounded-lg border text-sm animate-fade-in ${getSeverityStyle(anomaly.severity)}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5">
              <span>{getTypeIcon(anomaly.type)}</span>
              <span className="font-medium capitalize">{anomaly.type}</span>
            </span>
            <SeverityBadge severity={anomaly.severity} />
          </div>
          {anomaly.description && (
            <p className="text-xs opacity-80 mt-1">{anomaly.description}</p>
          )}
          <div className="flex items-center justify-between mt-2 text-[10px] opacity-60">
            <span>{anomaly.affected_edges?.length || 0} edge(s) affected</span>
            <span>{anomaly.weight_multiplier}x weight</span>
          </div>
        </div>
      ))}
    </div>
  );
}


// ─── Sub-Components ──────────────────────────────────────────────

function SeverityBadge({ severity }) {
  const colors = {
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full border ${colors[severity] || colors.low}`}>
      {severity}
    </span>
  );
}


// ─── Helpers ─────────────────────────────────────────────────────

function getSeverityStyle(severity) {
  const styles = {
    low: 'bg-blue-500/5 border-blue-500/20 text-blue-300',
    medium: 'bg-yellow-500/5 border-yellow-500/20 text-yellow-300',
    high: 'bg-orange-500/5 border-orange-500/20 text-orange-300',
    critical: 'bg-red-500/5 border-red-500/20 text-red-300',
  };
  return styles[severity] || styles.low;
}

function getTypeIcon(type) {
  const icons = {
    accident: '🚨',
    closure: '🚧',
    congestion: '🐌',
    weather: '🌧️',
    construction: '🏗️',
  };
  return icons[type] || '⚠️';
}

export default AnomalyAlert;
