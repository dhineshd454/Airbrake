import React from 'react';
import { BreakCountWidget } from './BreakCountWidget';
import { ErrorRateTrendWidget } from './ErrorRateTrendWidget';
import { SeverityBreakdownWidget } from './SeverityBreakdownWidget';
import { TimeSeriesWidget } from './TimeSeriesWidget';
import { TopServicesWidget } from './TopServicesWidget';
import { useDashboard } from './useDashboard';

const card: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: 'var(--radius-md)' as unknown as number,
  padding: 20,
};

const cardTitle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 1,
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: 18,
};

export function Dashboard() {
  const { data, loading, error } = useDashboard();

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Dashboard</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Overview of errors and system health</p>
      </div>

      {(error ?? data.airbrakeUnreachable) && (
        <div
          data-testid="airbrake-unreachable-warning"
          role="alert"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#fca5a5', padding: '10px 14px', borderRadius: 'var(--radius-md)' as unknown as number,
            marginBottom: 20, fontSize: 13,
          }}
        >
          <span>⚠️</span> Airbrake API unreachable — showing cached or empty data
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 14, padding: '40px 0' }}>
          <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span> Loading…
        </div>
      ) : (
        <div data-testid="dashboard" style={grid}>
          <div style={card}>
            <h3 style={cardTitle}>Break Counts</h3>
            <BreakCountWidget data={data.breakCounts} />
          </div>
          <div style={card}>
            <h3 style={cardTitle}>Error Rate Trend</h3>
            <ErrorRateTrendWidget trend={data.errorRateTrend} />
          </div>
          <div style={card}>
            <h3 style={cardTitle}>Top Failing Services</h3>
            <TopServicesWidget services={data.topServices} />
          </div>
          <div style={{ ...card, gridColumn: 'span 2' }}>
            <h3 style={cardTitle}>Breaks Over Time</h3>
            <TimeSeriesWidget timeSeries={data.timeSeries} deploymentEvents={data.deploymentEvents} />
          </div>
          <div style={card}>
            <h3 style={cardTitle}>Severity Breakdown</h3>
            <SeverityBreakdownWidget breakdown={data.severityBreakdown} />
          </div>
        </div>
      )}
    </div>
  );
}
