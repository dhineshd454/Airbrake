/**
 * Log Stream view — live WebSocket feed with filter controls.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import React from 'react';
import { useLogFilters } from './useLogFilters';
import { useLogStream } from './useLogStream';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/logs`;

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  error: '#f97316',
  warning: '#eab308',
  info: '#3b82f6',
};

const SEVERITY_BG: Record<string, string> = {
  critical: 'rgba(239,68,68,0.08)',
  error: 'rgba(249,115,22,0.08)',
  warning: 'rgba(234,179,8,0.08)',
  info: 'rgba(59,130,246,0.08)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  padding: '7px 11px',
  fontSize: 13,
  outline: 'none',
  transition: 'border-color var(--transition)',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  paddingRight: 28,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
};

export function LogStream() {
  const { logs, connectionState } = useLogStream({ wsUrl: WS_URL });
  const { filters, updateFilter, resetFilters, filtered } = useLogFilters(logs);

  return (
    <div data-testid="log-stream">
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Log Stream</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Live feed of incoming application logs</p>
      </div>

      {/* Connection banner */}
      {connectionState !== 'connected' && (
        <div
          data-testid="disconnected-banner"
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#fca5a5',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          <span style={{ fontSize: 16 }}>⚠</span>
          Disconnected — reconnecting…
        </div>
      )}

      {/* Filter bar */}
      <div
        data-testid="filter-controls"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          padding: '14px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <input
          data-testid="filter-application"
          placeholder="Application"
          value={filters.application}
          onChange={(e) => updateFilter('application', e.target.value)}
          style={{ ...inputStyle, width: 160 }}
        />
        <div style={{ position: 'relative' }}>
          <select
            data-testid="filter-environment"
            value={filters.environment}
            onChange={(e) => updateFilter('environment', e.target.value)}
            aria-label="Environment"
            style={selectStyle}
          >
            <option value="">All environments</option>
            <option value="production">Production</option>
            <option value="qa">QA</option>
            <option value="development">Development</option>
          </select>
        </div>
        <div style={{ position: 'relative' }}>
          <select
            data-testid="filter-severity"
            value={filters.severity}
            onChange={(e) => updateFilter('severity', e.target.value)}
            aria-label="Severity"
            style={selectStyle}
          >
            <option value="">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <input
          data-testid="filter-keyword"
          placeholder="Search…"
          value={filters.keyword}
          onChange={(e) => updateFilter('keyword', e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 140 }}
        />
        <input
          data-testid="filter-from"
          type="datetime-local"
          value={filters.from}
          onChange={(e) => updateFilter('from', e.target.value)}
          aria-label="From"
          style={{ ...inputStyle, colorScheme: 'dark' }}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</span>
        <input
          data-testid="filter-to"
          type="datetime-local"
          value={filters.to}
          onChange={(e) => updateFilter('to', e.target.value)}
          aria-label="To"
          style={{ ...inputStyle, colorScheme: 'dark' }}
        />
        <button
          data-testid="filter-reset"
          onClick={resetFilters}
          style={{
            padding: '7px 14px',
            background: 'transparent',
            border: '1px solid var(--input-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 13,
            transition: 'all var(--transition)',
          }}
        >
          Reset
        </button>
      </div>

      {/* Log count */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 2 }}>
        {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
      </div>

      {/* Log entries */}
      <ul
        data-testid="log-entries"
        style={{
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {filtered.length === 0 && (
          <li style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No log entries
          </li>
        )}
        {filtered.map((log) => {
          const color = SEVERITY_COLORS[log.severity] ?? 'var(--text-muted)';
          const bg = SEVERITY_BG[log.severity] ?? 'transparent';
          return (
            <li
              key={log.id}
              data-testid="log-entry"
              data-severity={log.severity}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '10px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--card-border)',
                borderLeft: `3px solid ${color}`,
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              <span style={{
                flexShrink: 0,
                padding: '2px 7px',
                borderRadius: 4,
                background: bg,
                color,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}>
                {log.severity}
              </span>
              <span style={{ color: 'var(--text-subtle)', flexShrink: 0 }}>{log.applicationId}</span>
              <span style={{ color: 'var(--text)', flex: 1, wordBreak: 'break-all' }}>— {log.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
