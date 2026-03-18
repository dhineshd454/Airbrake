import React from 'react';
import { BreakCountWidget } from './BreakCountWidget';
import { ErrorRateTrendWidget } from './ErrorRateTrendWidget';
import { SeverityBreakdownWidget } from './SeverityBreakdownWidget';
import { TimeSeriesWidget } from './TimeSeriesWidget';
import { TopServicesWidget } from './TopServicesWidget';
import { useDashboard } from './useDashboard';

const card: React.CSSProperties = {
  background: 'var(--card-bg, rgba(255,255,255,0.05))',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: 20,
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 20,
};

export function Dashboard() {
  const { data, loading, error } = useDashboard();

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700 }}>Dashboard</h2>

      {(error ?? data.airbrakeUnreachable) && (
        <div
          data-testid="airbrake-unreachable-warning"
          role="alert"
          style={{ background: '#7f1d1d', color: '#fca5a5', padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14 }}
        >
          ⚠️ Airbrake API unreachable — showing cached or empty data
        </div>
      )}

      {loading ? (
        <p style={{ opacity: 0.5 }}>Loading…</p>
      ) : (
        <div data-testid="dashboard" style={grid}>
          <div style={card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>Break Counts</h3>
            <BreakCountWidget data={data.breakCounts} />
          </div>
          <div style={card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>Error Rate Trend</h3>
            <ErrorRateTrendWidget trend={data.errorRateTrend} />
          </div>
          <div style={card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>Top Failing Services</h3>
            <TopServicesWidget services={data.topServices} />
          </div>
          <div style={{ ...card, gridColumn: 'span 2' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>Breaks Over Time</h3>
            <TimeSeriesWidget timeSeries={data.timeSeries} deploymentEvents={data.deploymentEvents} />
          </div>
          <div style={card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>Severity Breakdown</h3>
            <SeverityBreakdownWidget breakdown={data.severityBreakdown} />
          </div>
        </div>
      )}
    </div>
  );
}
