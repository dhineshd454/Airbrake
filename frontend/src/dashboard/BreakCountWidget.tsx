import React from 'react';
import type { BreakCountData } from './useDashboard';

interface Props { data: BreakCountData; }

export function BreakCountWidget({ data }: Props) {
  return (
    <div data-testid="break-count-widget" style={{ display: 'flex', gap: 24 }}>
      <div data-testid="break-count-24h" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: '#f87171' }}>{data.last24h}</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>Last 24h</div>
      </div>
      <div data-testid="break-count-7d" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: '#fb923c' }}>{data.last7d}</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>Last 7 days</div>
      </div>
    </div>
  );
}
