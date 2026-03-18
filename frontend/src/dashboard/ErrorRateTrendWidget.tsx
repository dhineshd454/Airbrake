import React from 'react';
import type { TrendPoint } from './useDashboard';

interface Props { trend: TrendPoint[]; }

export function ErrorRateTrendWidget({ trend }: Props) {
  if (trend.length === 0) {
    return <p data-testid="trend-empty" style={{ opacity: 0.4, fontSize: 13 }}>No data available</p>;
  }
  return (
    <ul data-testid="error-rate-trend-widget" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {trend.map((point) => (
        <li key={point.timestamp} data-testid="trend-point" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ opacity: 0.6 }}>{new Date(point.timestamp).toLocaleTimeString()}</span>
          <span style={{ fontWeight: 600 }}>{point.count}</span>
        </li>
      ))}
    </ul>
  );
}
