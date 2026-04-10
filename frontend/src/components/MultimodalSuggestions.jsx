/*
 * MultimodalSuggestions — Vehicle Recommendations per Route Segment
 * ==================================================================
 * Displays:
 *   - Shortest distance vs. fastest time routes
 *   - For each route: vehicle suggestions per segment
 *   - Recommended vehicle highlighted (fastest for segment)
 *   - Road type and distance information
 *   - Travel time comparison
 *
 * Integration:
 *   - Receives multimodal_suggestions from RouteResponse
 *   - Shows segment-by-segment vehicle recommendations
 */

const VEHICLE_COLORS = {
  car:      '#ef4444',
  bike:     '#3b82f6',
  walk:     '#f59e0b',
  transit:  '#8b5cf6',
  rickshaw: '#ec4899',
};

const VEHICLE_ICONS = {
  car:      '🚗',
  bike:     '🚴',
  walk:     '🚶',
  transit:  '🚌',
  rickshaw: '🛺',
};

function MultimodalSuggestions({ suggestions, isLoading }) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 900,
        color: '#737373',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        paddingBottom: 8,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        🚗 Vehicle Recommendations
      </div>

      {suggestions.map((route, idx) => (
        <div
          key={idx}
          style={{
            background: '#111113',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {/* Route type header */}
          <div style={{
            padding: '12px 14px',
            background: idx === 0
              ? 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))'
              : 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#ffffff',
              fontFamily: 'Inter, sans-serif',
            }}>
              {route.route_type === 'shortest_distance' ? '📏 Shortest Distance' : '⚡ Fastest Time'}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
              <span style={{ color: '#a78bfa' }}>
                {(route.total_distance_m / 1000).toFixed(2)} km
              </span>
              <span style={{ color: '#60a5fa' }}>
                {Math.ceil(route.total_duration_s / 60)} min
              </span>
            </div>
          </div>

          {/* Segments list */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {route.segments.slice(0, 15).map((segment, segIdx) => (
              <SegmentRow key={segIdx} segment={segment} segmentIndex={segIdx} />
            ))}
          </div>

          {/* Show more indicator */}
          {route.segments.length > 15 && (
            <div style={{
              padding: '8px 14px',
              fontSize: 11,
              color: '#737373',
              textAlign: 'center',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              background: 'rgba(0,0,0,0.3)',
            }}>
              +{route.segments.length - 15} more segments...
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SegmentRow({ segment, segmentIndex }) {
  const recommendedVehicle = segment.recommended_vehicle;
  const recommendedColor = VEHICLE_COLORS[recommendedVehicle] || '#666';
  const recommendedIcon = VEHICLE_ICONS[recommendedVehicle] || '🚗';

  // Calculate fastest travel time for comparison
  const fastestTime = Math.min(...segment.vehicle_options.map(opt => opt.travel_time_s));
  const slowestTime = Math.max(...segment.vehicle_options.map(opt => opt.travel_time_s));

  return (
    <div style={{
      padding: '11px 14px',
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
    }}>
      {/* Segment header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          minWidth: 0,
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#404040',
            background: '#282828',
            padding: '2px 6px',
            borderRadius: 4,
            minWidth: 28,
            textAlign: 'center',
          }}>
            #{segmentIndex + 1}
          </div>
          <div style={{
            fontSize: 10,
            color: '#a1a1a1',
            fontFamily: 'JetBrains Mono, monospace',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {segment.road_type ? `${segment.road_type} road` : 'path'}
          </div>
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: '#888',
          whiteSpace: 'nowrap',
        }}>
          {(segment.distance_m / 1000).toFixed(2)} km
        </div>
      </div>

      {/* Recommended vehicle highlight */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 9px',
        background: `rgba(34,197,94,0.08)`,
        border: `1px solid ${recommendedColor}33`,
        borderRadius: 8,
      }}>
        <div style={{ fontSize: 14 }}>{recommendedIcon}</div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#22c55e',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}>
            Fastest: {recommendedVehicle}
          </div>
          <div style={{
            fontSize: 9,
            color: '#888',
          }}>
            {fastestTime.toFixed(1)}s {recommendedVehicle === 'walk' ? '(slow)' : ''}
          </div>
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#22c55e',
        }}>
          ✓
        </div>
      </div>

      {/* All available vehicles */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
      }}>
        {segment.vehicle_options.map((option) => (
          <VehicleOptionBadge
            key={option.vehicle}
            option={option}
            isRecommended={option.vehicle === recommendedVehicle}
            minTime={fastestTime}
            maxTime={slowestTime}
          />
        ))}
      </div>
    </div>
  );
}

function VehicleOptionBadge({ option, isRecommended, minTime, maxTime }) {
  const color = VEHICLE_COLORS[option.vehicle] || '#666';
  const icon = VEHICLE_ICONS[option.vehicle] || '🚗';
  const timePercent = minTime === maxTime ? 100 : ((maxTime - option.travel_time_s) / (maxTime - minTime)) * 100;

  return (
    <div
      title={`${option.vehicle}: ${option.travel_time_s.toFixed(1)}s`}
      style={{
        padding: '4px 8px',
        borderRadius: 6,
        fontSize: 9,
        fontWeight: 600,
        background: isRecommended
          ? `${color}20`
          : 'rgba(255,255,255,0.03)',
        border: isRecommended
          ? `1px solid ${color}66`
          : '1px solid rgba(255,255,255,0.06)',
        color: isRecommended ? color : '#888',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        cursor: 'default',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}30`;
        e.currentTarget.style.borderColor = `${color}88`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isRecommended ? `${color}20` : 'rgba(255,255,255,0.03)';
        e.currentTarget.style.borderColor = isRecommended ? `${color}66` : 'rgba(255,255,255,0.06)';
      }}
    >
      <span>{icon}</span>
      <span>{option.travel_time_s.toFixed(1)}s</span>
    </div>
  );
}

export default MultimodalSuggestions;
