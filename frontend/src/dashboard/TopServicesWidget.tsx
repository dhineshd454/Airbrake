import React from 'react';
import type { ServiceBreakCount } from './useDashboard';

interface Props { services: ServiceBreakCount[]; }

export function TopServicesWidget({ services }: Props) {
  if (services.length === 0) {
    return <p data-testid="services-empty" style={{ opacity: 0.4, fontSize: 13 }}>No data available</p>;
  }
  const max = services[0]?.count ?? 1;
  return (
    <ol data-testid="top-services-widget" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {services.map((s) => (
        <li key={s.service} data-testid="service-row">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
            <span>{s.service}</span><span style={{ fontWeight: 600 }}>{s.count}</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${(s.count / max) * 100}%`, background: '#f87171', borderRadius: 2 }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
