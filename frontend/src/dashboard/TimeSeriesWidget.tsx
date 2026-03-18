import React, { useState } from 'react';
import type { DeploymentEvent, TrendPoint } from './useDashboard';

type Granularity = 'hourly' | 'daily';

interface Props {
  timeSeries: TrendPoint[];
  deploymentEvents: DeploymentEvent[];
}

export function TimeSeriesWidget({ timeSeries, deploymentEvents }: Props) {
  const [granularity, setGranularity] = useState<Granularity>('hourly');

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', fontSize: 12, borderRadius: 4, border: 'none', cursor: 'pointer',
    background: active ? '#3b82f6' : 'rgba(255,255,255,0.1)',
    color: active ? '#fff' : 'inherit',
  });

  return (
    <div data-testid="time-series-widget">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button data-testid="granularity-hourly" style={btnStyle(granularity === 'hourly')} onClick={() => setGranularity('hourly')} aria-pressed={granularity === 'hourly'}>Hourly</button>
        <button data-testid="granularity-daily" style={btnStyle(granularity === 'daily')} onClick={() => setGranularity('daily')} aria-pressed={granularity === 'daily'}>Daily</button>
      </div>

      {timeSeries.length === 0 ? (
        <p style={{ opacity: 0.4, fontSize: 13 }}>No time-series data available</p>
      ) : (
        <div data-testid="time-series-points" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {timeSeries.map((point) => (
            <div key={point.timestamp} data-testid="ts-point" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ opacity: 0.6 }}>{point.timestamp}</span>
              <span style={{ fontWeight: 600 }}>{point.count}</span>
            </div>
          ))}
        </div>
      )}

      {deploymentEvents.length > 0 && (
        <div data-testid="deployment-overlays" style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
          <p style={{ fontSize: 11, opacity: 0.5, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Deployments</p>
          {deploymentEvents.map((ev) => (
            <div key={`${ev.timestamp}-${ev.version}`} data-testid="deployment-event" style={{ fontSize: 12, opacity: 0.7 }}>
              🚀 {ev.version} — {ev.service} @ {new Date(ev.timestamp).toLocaleString()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
