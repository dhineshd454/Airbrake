/**
 * Log Stream view — live WebSocket feed with filter controls.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import React from 'react';
import { useLogFilters } from './useLogFilters';
import { useLogStream } from './useLogStream';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/logs`;

export function LogStream() {
  const { logs, connectionState } = useLogStream({ wsUrl: WS_URL });
  const { filters, updateFilter, resetFilters, filtered } = useLogFilters(logs);

  return (
    <div data-testid="log-stream">
      {connectionState !== 'connected' && (
        <div data-testid="disconnected-banner" role="alert">
          Disconnected — reconnecting…
        </div>
      )}

      <div data-testid="filter-controls">
        <input
          data-testid="filter-application"
          placeholder="Application"
          value={filters.application}
          onChange={(e) => updateFilter('application', e.target.value)}
        />
        <select
          data-testid="filter-environment"
          value={filters.environment}
          onChange={(e) => updateFilter('environment', e.target.value)}
          aria-label="Environment"
        >
          <option value="">All environments</option>
          <option value="production">Production</option>
          <option value="qa">QA</option>
          <option value="development">Development</option>
        </select>
        <select
          data-testid="filter-severity"
          value={filters.severity}
          onChange={(e) => updateFilter('severity', e.target.value)}
          aria-label="Severity"
        >
          <option value="">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>
        <input
          data-testid="filter-keyword"
          placeholder="Search…"
          value={filters.keyword}
          onChange={(e) => updateFilter('keyword', e.target.value)}
        />
        <input
          data-testid="filter-from"
          type="datetime-local"
          value={filters.from}
          onChange={(e) => updateFilter('from', e.target.value)}
          aria-label="From"
        />
        <input
          data-testid="filter-to"
          type="datetime-local"
          value={filters.to}
          onChange={(e) => updateFilter('to', e.target.value)}
          aria-label="To"
        />
        <button data-testid="filter-reset" onClick={resetFilters}>
          Reset
        </button>
      </div>

      <ul data-testid="log-entries">
        {filtered.map((log) => (
          <li key={log.id} data-testid="log-entry" data-severity={log.severity}>
            [{log.severity.toUpperCase()}] {log.applicationId} — {log.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
