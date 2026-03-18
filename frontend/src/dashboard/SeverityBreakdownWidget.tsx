import React from 'react';
import type { SeverityCount } from './useDashboard';

const COLORS: Record<string, string> = {
  critical: '#ef4444',
  error: '#f97316',
  warning: '#eab308',
  info: '#3b82f6',
};

interface Props { breakdown: SeverityCount[]; }

export function SeverityBreakdownWidget({ breakdown }: Props) {
  if (breakdown.length === 0) {
    return <p data-testid="severity-empty" style={{ opacity: 0.4, fontSize: 13 }}>No data available</p>;
  }
  return (
    <ul data-testid="severity-breakdown-widget" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {breakdown.map((item) => (
        <li key={item.severity} data-testid="severity-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[item.severity] ?? '#888', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, textTransform: 'capitalize' }}>{item.severity}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{item.count}</span>
        </li>
      ))}
    </ul>
  );
}
