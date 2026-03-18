/**
 * Breaks List view — paginated, filterable with status badges and severity indicators.
 * Requirements: 2.1, 2.3, 2.4, 2.5
 */

import React, { useEffect, useState } from 'react';
import type { Break } from '@portal/shared';

interface BreakSummary extends Break {
  status: 'new' | 'existing' | 'regression';
}

interface BreaksPage {
  data: BreakSummary[];
  total: number;
  page: number;
  limit: number;
}

const LIMIT = 20;

export function BreaksList() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<BreaksPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(severityFilter ? { severity: severityFilter } : {}),
    });

    fetch(`/api/breaks?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) { setResult(data as BreaksPage); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [page, statusFilter, severityFilter]);

  const totalPages = result ? Math.ceil(result.total / LIMIT) : 1;

  return (
    <div data-testid="breaks-list">
      <div data-testid="breaks-filters">
        <select
          data-testid="filter-status"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="existing">Existing</option>
          <option value="regression">Regression</option>
        </select>
        <select
          data-testid="filter-severity"
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
          aria-label="Severity"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {loading ? (
        <div data-testid="breaks-loading">Loading…</div>
      ) : (
        <>
          <ul data-testid="breaks-items">
            {(result?.data ?? []).map((b) => (
              <li
                key={b.id}
                data-testid="break-item"
                data-severity={b.severity}
                data-status={b.status}
              >
                <a href={`/breaks/${b.id}`} data-testid="break-link">
                  {b.errorMessage}
                </a>
                <span
                  data-testid="status-badge"
                  style={{ color: b.status === 'regression' ? 'orange' : undefined }}
                >
                  {b.status === 'new' ? 'New' : b.status === 'regression' ? 'Regression' : ''}
                </span>
                {b.severity === 'critical' && (
                  <span data-testid="critical-indicator" style={{ color: 'red' }}>
                    ●
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div data-testid="pagination">
            <button
              data-testid="prev-page"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span data-testid="page-info">
              {page} / {totalPages}
            </span>
            <button
              data-testid="next-page"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
