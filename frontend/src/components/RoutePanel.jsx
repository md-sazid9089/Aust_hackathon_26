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

function RoutePanel({ origin, destination, routeResult, isLoading, error, onCompute, onClear }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Route Planner
      </h2>

      {/* ─── Waypoints ────────────────────────────────────────── */}
      <div className="space-y-2">
        <WaypointDisplay
          label="Origin"
          latlng={origin}
          color="text-transit-400"
          dotColor="bg-transit-400"
        />
        <WaypointDisplay
          label="Destination"
          latlng={destination}
          color="text-emerald-400"
          dotColor="bg-emerald-400"
        />
      </div>

      {/* ─── Actions ──────────────────────────────────────────── */}
      <div className="flex gap-2">
        <button
          id="btn-compute-route"
          onClick={onCompute}
          disabled={!origin || !destination || isLoading}
          className="flex-1 px-4 py-2 bg-transit-600 hover:bg-transit-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-all"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Computing...
            </span>
          ) : (
            'Compute Route'
          )}
        </button>
        <button
          id="btn-clear-route"
          onClick={onClear}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
        >
          Clear
        </button>
      </div>

      {/* ─── Error ────────────────────────────────────────────── */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 animate-slide-up">
          ⚠️ {error}
        </div>
      )}

      {/* ─── Route Result ─────────────────────────────────────── */}
      {routeResult && (
        <div className="space-y-3 animate-slide-up">
          {/* Summary */}
          <div className="glass-panel-light p-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Route Summary
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-gray-200">
                  {formatDistance(routeResult.total_distance_m)}
                </div>
                <div className="text-[10px] text-gray-500 uppercase">Distance</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-200">
                  {formatDuration(routeResult.total_duration_s)}
                </div>
                <div className="text-[10px] text-gray-500 uppercase">Duration</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-200">
                  ${routeResult.total_cost.toFixed(2)}
                </div>
                <div className="text-[10px] text-gray-500 uppercase">Cost</div>
              </div>
            </div>
          </div>

          {/* Legs */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Route Legs
            </h3>
            {routeResult.legs.map((leg, idx) => (
              <LegCard key={idx} leg={leg} index={idx} />
            ))}
          </div>

          {/* Mode Switches */}
          {routeResult.mode_switches?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Mode Transfers
              </h3>
              {routeResult.mode_switches.map((sw, idx) => (
                <div key={idx} className="glass-panel-light p-2 text-xs text-gray-400 flex items-center gap-2">
                  <span className="text-transit-400">{getModeEmoji(sw.from_mode)}</span>
                  <span>→</span>
                  <span className="text-emerald-400">{getModeEmoji(sw.to_mode)}</span>
                  <span className="ml-auto text-gray-500">
                    +{sw.penalty_time_s}s
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Anomalies avoided */}
          {routeResult.anomalies_avoided > 0 && (
            <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs text-yellow-400">
              ⚠️ Avoided {routeResult.anomalies_avoided} anomaly-affected edge(s)
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── Sub-Components ──────────────────────────────────────────────

function WaypointDisplay({ label, latlng, color, dotColor }) {
  return (
    <div className="flex items-center gap-2 glass-panel-light p-2 text-sm">
      <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
      <span className={`${color} font-medium text-xs w-20`}>{label}</span>
      {latlng ? (
        <span className="text-gray-400 text-xs">
          {latlng.lat.toFixed(5)}, {latlng.lng.toFixed(5)}
        </span>
      ) : (
        <span className="text-gray-600 text-xs italic">Click map to set</span>
      )}
    </div>
  );
}

function LegCard({ leg, index }) {
  return (
    <div className="glass-panel-light p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
          {getModeEmoji(leg.mode)}
          <span className="capitalize">{leg.mode}</span>
        </span>
        <span className="text-xs text-gray-500">Leg {index + 1}</span>
      </div>
      <div className="flex gap-4 text-xs text-gray-400">
        <span>{formatDistance(leg.distance_m)}</span>
        <span>{formatDuration(leg.duration_s)}</span>
        <span>${leg.cost.toFixed(2)}</span>
      </div>
    </div>
  );
}


// ─── Helpers ─────────────────────────────────────────────────────

function getModeEmoji(mode) {
  const emojis = { car: '🚗', bike: '🚲', walk: '🚶', transit: '🚌' };
  return emojis[mode] || '📍';
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
