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
  { id: 'car',     label: 'Car',     icon: '🚗' },
  { id: 'bike',    label: 'Bike',    icon: '🚲' },
  { id: 'walk',    label: 'Walk',    icon: '🚶' },
  { id: 'transit', label: 'Transit', icon: '🚌' },
  { id: 'rickshaw',label: 'Rickshaw',icon: '🛺' },
];

function ModeSelector({ selectedModes, onChange }) {
  // ─── Toggle mode: add/remove from sequence ────────────────
  const toggleMode = (modeId) => {
    const lastMode = selectedModes[selectedModes.length - 1];
    if (selectedModes.length === 1 && selectedModes[0] === modeId) return;
    if (lastMode === modeId) {
      onChange(selectedModes.slice(0, -1));
    } else {
      onChange([...selectedModes, modeId]);
    }
  };

  // ─── Quick single-mode selection ──────────────────────────
  const selectSingle = (modeId) => onChange([modeId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Mode grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {AVAILABLE_MODES.map((mode) => {
          const isActive = selectedModes.length === 1 && selectedModes[0] === mode.id;
          return (
            <button
              key={mode.id}
              id={`mode-btn-${mode.id}`}
              onClick={() => selectSingle(mode.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                padding: '14px 6px',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 800,
                fontFamily: 'Inter, system-ui, sans-serif',
                letterSpacing: '0.01em',
                cursor: 'pointer',
                border: isActive
                  ? '1.5px solid rgba(139,92,246,0.60)'
                  : '1.5px solid rgba(255,255,255,0.06)',
                transition: 'all 0.18s ease',
                background: isActive
                  ? 'linear-gradient(145deg, #7c3aed, #8b5cf6)'
                  : '#1e1e20',
                color: isActive ? '#ffffff' : '#737373',
                boxShadow: isActive
                  ? '0 6px 20px rgba(139,92,246,0.45), inset 0 1px 0 rgba(255,255,255,0.12)'
                  : '0 2px 8px rgba(0,0,0,0.35)',
                transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{mode.icon}</span>
              <span style={{ lineHeight: 1 }}>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Sequence row ── */}
      <div style={{
        background: '#111113',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: '10px 12px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <span style={{
            fontSize: 9,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: '#525252',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            Sequence
          </span>
          
          {/* Quick Add Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: '#404040', fontFamily: 'Inter, sans-serif', fontWeight: 600, marginRight: 2 }}>ADD:</span>
            {AVAILABLE_MODES.map((m) => (
              <button
                key={`add-${m.id}`}
                onClick={() => onChange([...selectedModes, m.id])}
                style={{
                  background: '#161618',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6,
                  padding: '2px 5px',
                  cursor: 'pointer',
                  fontSize: 12,
                  transition: 'all 0.15s ease',
                }}
                title={`Append ${m.label}`}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(139,92,246,0.15)';
                  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.50)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#161618';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }}
              >
                {m.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Sequence pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', minHeight: 26 }}>
          {selectedModes.map((modeId, idx) => {
            const mode = AVAILABLE_MODES.find((m) => m.id === modeId);
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {idx > 0 && (
                  <span style={{
                    color: '#525252',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                  }}>
                    →
                  </span>
                )}
                <span
                  onClick={() => {
                    const newModes = selectedModes.filter((_, i) => i !== idx);
                    if (newModes.length > 0) onChange(newModes);
                  }}
                  title="Click to remove"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    background: 'rgba(139,92,246,0.18)',
                    border: '1px solid rgba(139,92,246,0.40)',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#a78bfa',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.45)';
                    e.currentTarget.style.color = '#f87171';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(139,92,246,0.18)';
                    e.currentTarget.style.borderColor = 'rgba(139,92,246,0.40)';
                    e.currentTarget.style.color = '#a78bfa';
                  }}
                >
                  {mode?.icon} {mode?.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Preset chips ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { id: 'preset-walk-transit-walk', label: '🚶→🚌→🚶', fn: () => onChange(['walk', 'transit', 'walk']) },
          { id: 'preset-transit-rickshaw',  label: '🚌→🛺',    fn: () => onChange(['transit', 'rickshaw']) },
          { id: 'preset-car-walk',          label: '🚗→🚶',    fn: () => onChange(['car', 'walk']) },
        ].map((p) => (
          <button
            key={p.id}
            id={p.id}
            onClick={p.fn}
            style={{
              fontSize: 11,
              padding: '5px 12px',
              background: '#1e1e20',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 999,
              color: '#737373',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(139,92,246,0.15)';
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.50)';
              e.currentTarget.style.color = '#a78bfa';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#1e1e20';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.color = '#737373';
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ModeSelector;
