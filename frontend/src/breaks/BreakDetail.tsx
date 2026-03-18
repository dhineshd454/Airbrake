/**
 * Break Detail view — full context including stack trace, request data, correlated logs.
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import React, { useEffect, useState } from 'react';
import type { Break, LogRecord } from '@portal/shared';

interface BreakDetailData extends Break {
  status: 'new' | 'existing' | 'regression';
  firstOccurrence: string;
  lastOccurrence: string;
  occurrenceCount: number;
  correlatedLogs: LogRecord[];
}

interface Props {
  breakId: string;
}

export function BreakDetail({ breakId }: Props) {
  const [data, setData] = useState<BreakDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/breaks/${breakId}`)
      .then((r) => {
        if (r.status === 404) { if (!cancelled) setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => {
        if (!cancelled && d) { setData(d as BreakDetailData); setLoading(false); }
        else if (!cancelled) setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [breakId]);

  if (loading) return <div data-testid="break-detail-loading">Loading…</div>;
  if (notFound || !data) return <div data-testid="break-not-found">Break not found.</div>;

  return (
    <div data-testid="break-detail">
      {/* Error message — Requirement 4.1 */}
      <h1 data-testid="break-error-message">{data.errorMessage}</h1>

      {/* Stack trace — Requirement 4.1 */}
      <pre data-testid="break-stack-trace">{data.stackTrace}</pre>

      {/* Endpoint — Requirement 4.1 */}
      <div data-testid="break-endpoint">
        {data.endpoint ?? <em data-testid="endpoint-unavailable">Data not available</em>}
      </div>

      {/* Lifecycle — Requirement 4.3 */}
      <div data-testid="break-lifecycle">
        <span data-testid="first-occurrence">{data.firstOccurrence}</span>
        <span data-testid="last-occurrence">{data.lastOccurrence}</span>
        <span data-testid="occurrence-count">{data.occurrenceCount}</span>
        <span data-testid="break-status">{data.status}</span>
      </div>

      {/* Request payload — Requirement 4.4 */}
      <div data-testid="break-request-payload">
        {data.requestPayload !== null && data.requestPayload !== undefined ? (
          <pre>{JSON.stringify(data.requestPayload, null, 2)}</pre>
        ) : (
          <em data-testid="request-payload-unavailable">Data not available</em>
        )}
      </div>

      {/* User session — Requirement 4.4 */}
      <div data-testid="break-user-session">
        {data.userSession !== null && data.userSession !== undefined ? (
          <pre>{JSON.stringify(data.userSession, null, 2)}</pre>
        ) : (
          <em data-testid="user-session-unavailable">Data not available</em>
        )}
      </div>

      {/* Correlated logs — Requirement 4.2 */}
      <div data-testid="correlated-logs">
        {data.correlatedLogs.length === 0 ? (
          <span data-testid="no-correlated-logs">No correlated logs</span>
        ) : (
          <ul>
            {data.correlatedLogs.map((log) => (
              <li key={log.id} data-testid="correlated-log-entry">
                [{log.severity}] {log.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
