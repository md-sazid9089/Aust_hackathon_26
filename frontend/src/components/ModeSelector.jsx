/*
 * ModeSelector — Transport Mode Picker Component
 * ==================================================
 * HUD-style mode picker matching the design spec.
 * Grid of transport modes with glow effects on selection.
 * Color-coded indicators for each transportation mode.
 */

const MODE_COLORS = {
  walk: '#ef4444',      // Red for Walking
  bike: '#eab308',      // Yellow for Cycling
  transit: '#3b82f6',   // Blue for Bus/Transit
  rickshaw: '#22c55e',  // Green for Rickshaw
  car: '#a855f7',       // Purple for Car
};

const AVAILABLE_MODES = [
  { id: 'car',      label: 'Car',      icon: '\u{1F697}', color: MODE_COLORS.car },
  { id: 'bike',     label: 'Bike',     icon: '\u{1F6B2}', color: MODE_COLORS.bike },
  { id: 'walk',     label: 'Walk',     icon: '\u{1F6B6}', color: MODE_COLORS.walk },
  { id: 'transit',  label: 'Transit',  icon: '\u{1F68C}', color: MODE_COLORS.transit },
  { id: 'rickshaw', label: 'Rickshaw', icon: '\u{1F6FA}', color: MODE_COLORS.rickshaw },
];

function ModeSelector({ selectedModes, onChange }) {
  const selectSingle = (modeId) => onChange([modeId]);
  const appendMode = (modeId) => onChange([...selectedModes, modeId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingBottom: 12,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          width: 34, height: 34,
          borderRadius: 11,
          background: 'linear-gradient(135deg, rgba(139,92,246,0.20), rgba(139,92,246,0.06))',
          border: '1px solid rgba(139,92,246,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          {'\u{1F6A6}'}
        </div>
        <div>
          <div style={{
            fontSize: 15, fontWeight: 800, color: '#fff',
            letterSpacing: '-0.01em',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            Transport Mode
          </div>
          <div style={{
            fontSize: 9, color: '#525252',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginTop: 1,
          }}>
            Select your mode
          </div>
        </div>
      </div>

      {/* Mode grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
        {AVAILABLE_MODES.map((mode) => {
          const isActive = selectedModes.includes(mode.id);
          const isPrimary = selectedModes.length === 1 && selectedModes[0] === mode.id;

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
                gap: 6,
                padding: '12px 6px',
                borderRadius: 16,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'Inter, system-ui, sans-serif',
                letterSpacing: '0.01em',
                cursor: 'pointer',
                border: isPrimary
                  ? '1.5px solid rgba(139,92,246,0.55)'
                  : isActive
                    ? '1.5px solid rgba(139,92,246,0.30)'
                    : '1.5px solid rgba(255,255,255,0.06)',
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                background: isPrimary
                  ? 'linear-gradient(145deg, rgba(124,58,237,0.90), rgba(139,92,246,0.80))'
                  : isActive
                    ? 'rgba(139,92,246,0.12)'
                    : 'rgba(255,255,255,0.03)',
                color: isPrimary ? '#fff' : isActive ? '#c4b5fd' : '#737373',
                boxShadow: isPrimary
                  ? '0 8px 24px rgba(139,92,246,0.40), inset 0 1px 0 rgba(255,255,255,0.10)'
                  : 'none',
                transform: isPrimary ? 'translateY(-1px)' : 'none',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{mode.icon}</span>
              <span style={{ lineHeight: 1 }}>{mode.label}</span>
              {/* Color indicator dot */}
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: mode.color,
                boxShadow: `0 0 4px ${mode.color}33`,
                marginTop: 2,
              }} />
            </button>
          );
        })}
      </div>

      {/* Sequence bar */}
      <div style={{
        background: 'rgba(0,0,0,0.30)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: '9px 12px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 7,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: '#404040',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            Sequence
          </span>

          {/* Quick add icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {AVAILABLE_MODES.map((m) => (
              <button
                key={`add-${m.id}`}
                onClick={() => appendMode(m.id)}
                title={`Append ${m.label}`}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6,
                  padding: '2px 5px',
                  cursor: 'pointer',
                  fontSize: 12,
                  lineHeight: 1,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(139,92,246,0.15)';
                  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.40)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                }}
              >
                {m.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Sequence pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', minHeight: 24 }}>
          {selectedModes.map((modeId, idx) => {
            const mode = AVAILABLE_MODES.find((m) => m.id === modeId);
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {idx > 0 && (
                  <span style={{
                    color: '#333',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                  }}>
                    {'\u2192'}
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
                    gap: 5,
                    padding: '4px 10px',
                    background: 'rgba(139,92,246,0.15)',
                    border: '1px solid rgba(139,92,246,0.35)',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#a78bfa',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.40)';
                    e.currentTarget.style.color = '#f87171';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(139,92,246,0.15)';
                    e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)';
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
    </div>
  );
}

export default ModeSelector;
