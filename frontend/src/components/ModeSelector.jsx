/*
 * ModeSelector — Transport Mode Picker Component
 * ==================================================
 * Allows users to build a sequence of transport modes for their route.
 *
 * Single-modal: Click one mode (e.g., "Car" → modes = ["car"])
 * Multi-modal: Click multiple modes in order (e.g., Walk → Transit → Walk)
 *
 * Integration:
 *   - Receives selectedModes from MapPage state
 *   - Calls onChange callback with updated mode sequence
 *   - Mode identifiers match config.json vehicle_types keys
 */

const AVAILABLE_MODES = [
  { id: 'car', label: 'Car', icon: '🚗', color: 'transit' },
  { id: 'bike', label: 'Bike', icon: '🚲', color: 'green' },
  { id: 'walk', label: 'Walk', icon: '🚶', color: 'amber' },
  { id: 'transit', label: 'Transit', icon: '🚌', color: 'purple' },
];

function ModeSelector({ selectedModes, onChange }) {
  // ─── Toggle mode: add/remove from sequence ────────────────
  const toggleMode = (modeId) => {
    const lastMode = selectedModes[selectedModes.length - 1];

    if (selectedModes.length === 1 && selectedModes[0] === modeId) {
      // Can't deselect the only mode
      return;
    }

    if (lastMode === modeId) {
      // Remove last mode if same as clicked
      onChange(selectedModes.slice(0, -1));
    } else {
      // Append mode to sequence (multi-modal)
      onChange([...selectedModes, modeId]);
    }
  };

  // ─── Quick single-mode selection ──────────────────────────
  const selectSingle = (modeId) => {
    onChange([modeId]);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Transport Modes
      </h2>

      {/* Single-mode quick select */}
      <div className="grid grid-cols-4 gap-2">
        {AVAILABLE_MODES.map((mode) => {
          const isActive = selectedModes.length === 1 && selectedModes[0] === mode.id;
          return (
            <button
              key={mode.id}
              id={`mode-btn-${mode.id}`}
              onClick={() => selectSingle(mode.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-all ${
                isActive
                  ? 'bg-transit-600/30 border border-transit-500/50 text-transit-300'
                  : 'bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
              }`}
            >
              <span className="text-lg">{mode.icon}</span>
              <span className="font-medium">{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Multi-modal builder */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Multi-Modal Sequence</span>
          <button
            id="btn-add-mode"
            onClick={() => {}}
            className="text-[10px] text-transit-400 hover:text-transit-300"
          >
            Click modes to append →
          </button>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {selectedModes.map((modeId, idx) => {
            const mode = AVAILABLE_MODES.find((m) => m.id === modeId);
            return (
              <div key={idx} className="flex items-center gap-1">
                {idx > 0 && <span className="text-gray-600 text-xs">→</span>}
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-transit-600/20 border border-transit-500/30 rounded text-xs text-transit-300 cursor-pointer hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 transition-colors"
                  onClick={() => {
                    const newModes = selectedModes.filter((_, i) => i !== idx);
                    if (newModes.length > 0) onChange(newModes);
                  }}
                  title="Click to remove"
                >
                  {mode?.icon} {mode?.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Quick multi-modal presets */}
        <div className="mt-3 flex gap-2">
          <button
            id="preset-walk-transit-walk"
            onClick={() => onChange(['walk', 'transit', 'walk'])}
            className="text-[10px] px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors"
          >
            🚶→🚌→🚶
          </button>
          <button
            id="preset-car-walk"
            onClick={() => onChange(['car', 'walk'])}
            className="text-[10px] px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors"
          >
            🚗→🚶
          </button>
          <button
            id="preset-bike-transit"
            onClick={() => onChange(['bike', 'transit', 'walk'])}
            className="text-[10px] px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors"
          >
            🚲→🚌→🚶
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModeSelector;
