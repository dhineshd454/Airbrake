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

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  new: { background: 'var(--badge-new)', color: 'var(--badge-new-text)' },
  regression: { background: 'var(--badge-regression)', color: 'var(--badge-regression-text)' },
  existing: { background: 'var(--badge-existing)', color: 'var(--badge-existing-text)' },
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  regression: 'Regression',
  existing: 'Existing',
};

const SEVERITY_DOT: Record<string, string> = {
  critical: '#ef4444',
  error: '#f97316',
  warning: '#eab308',
  info: '#3b82f6',
};

const selectStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: 'var(--radius-sm)' as unknown as number,
  color: 'var(--text)',
  padding: '7px 28px 7px 11px',
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
};

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
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Breaks</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Grouped error occurrences across your services</p>
      </div>

      {/* Filters */}
      <div
        data-testid="breaks-filters"
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          padding: '12px 14px',
          background: 'var(--surface)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)' as unknown as number,
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>Filter:</span>
        <select
          data-testid="filter-status"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Status"
          style={selectStyle}
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
          style={selectStyle}
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {loading ? (
        <div data-testid="breaks-loading" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading…
        </div>
      ) : (
        <>
          <ul data-testid="breaks-items" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(result?.data ?? []).length === 0 && (
              <li style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                No breaks found
              </li>
            )}
            {(result?.data ?? []).map((b) => {
              const dotColor = SEVERITY_DOT[b.severity] ?? 'var(--text-muted)';
              return (
                <li
                  key={b.id}
                  data-testid="break-item"
                  data-severity={b.severity}
                  data-status={b.status}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    background: 'var(--surface)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-sm)' as unknown as number,
                    transition: 'border-color var(--transition)',
                  }}
                >
                  {/* Severity dot */}
                  <span
                    data-testid="critical-indicator"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: dotColor,
                      flexShrink: 0,
                      boxShadow: b.severity === 'critical' ? `0 0 6px ${dotColor}` : 'none',
                    }}
                  />
                  {/* Error message */}
                  <a
                    href={`/breaks/${b.id}`}
                    data-testid="break-link"
                    style={{
                      flex: 1,
                      fontSize: 13.5,
                      color: 'var(--text)',
                      fontFamily: 'ui-monospace, monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {b.errorMessage}
                  </a>
                  {/* Status badge */}
                  {(() => {
                    const badgeStyle = STATUS_STYLES[b.status] ?? {};
                    const statusLabel = STATUS_LABELS[b.status] ?? b.status;
                    return (
                      <span
                        data-testid="status-badge"
                        style={{
                          ...badgeStyle,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: 0.3,
                          flexShrink: 0,
                        }}
                      >
                        {statusLabel}
                      </span>
                    );
                  })()}
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          <div
            data-testid="pagination"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              marginTop: 20,
            }}
          >
            <button
              data-testid="prev-page"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{
                padding: '7px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-sm)' as unknown as number,
                color: page <= 1 ? 'var(--text-muted)' : 'var(--text)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                fontSize: 13,
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              ← Previous
            </button>
            <span data-testid="page-info" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Page {page} of {totalPages}
            </span>
            <button
              data-testid="next-page"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: '7px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-sm)' as unknown as number,
                color: page >= totalPages ? 'var(--text-muted)' : 'var(--text)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                fontSize: 13,
                opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
