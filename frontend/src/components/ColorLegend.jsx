/*
 * ColorLegend Component
 * ====================
 * Displays the transportation mode to color mapping for map visualization.
 * Shows all 5 transportation modes with their corresponding colors.
 */

function ColorLegend() {
  const modes = [
    { label: 'Walking', color: '#ef4444', emoji: '🚶' },
    { label: 'Cycling', color: '#eab308', emoji: '🚴' },
    { label: 'Bus/Transit', color: '#3b82f6', emoji: '🚌' },
    { label: 'Rickshaw', color: '#22c55e', emoji: '🛺' },
    { label: 'Car', color: '#a855f7', emoji: '🚗' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 90,
        right: 16,
        zIndex: 25,
        background: 'rgba(18,18,22,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: 14,
        padding: 12,
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)',
        minWidth: 160,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#888',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 10,
        }}
      >
        Mode Colors
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {modes.map((mode) => (
          <div
            key={mode.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: mode.color,
                boxShadow: `0 0 8px ${mode.color}40`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: '#ccc',
              }}
            >
              {mode.label}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          fontSize: 10,
          color: '#666',
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          lineHeight: 1.4,
        }}
      >
        Nodes update color based on selected transportation mode
      </div>
    </div>
  );
}

export default ColorLegend;
