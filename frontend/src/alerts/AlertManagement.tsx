/**
 * Alert Management view — Admin/Developer only.
 * Requirements: 5.5, 6.3, 6.4
 */

import React, { useEffect, useState } from 'react';
import type { AlertRule, Role } from '@portal/shared';

interface Props {
  readonly role: Role;
}

const VARIANT_BG: Record<string, string> = {
  primary: 'var(--accent)',
  danger: 'rgba(239,68,68,0.1)',
  ghost: 'transparent',
};
const VARIANT_COLOR: Record<string, string> = {
  primary: '#fff',
  danger: '#ef4444',
  ghost: 'var(--text-muted)',
};
const btnStyle = (variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
  padding: '6px 14px',
  borderRadius: 'var(--radius-sm)' as unknown as number,
  fontSize: 12.5,
  fontWeight: 500,
  cursor: 'pointer',
  border: variant === 'primary' ? 'none' : '1px solid var(--card-border)',
  background: VARIANT_BG[variant],
  color: VARIANT_COLOR[variant],
  transition: 'all var(--transition)',
});

export function AlertManagement({ role }: Props) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);

  const canEdit = role === 'admin' || role === 'developer';

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    fetch('/api/alerts')
      .then((r) => r.json())
      .then((data) => { if (!cancelled) { setRules(data as AlertRule[]); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [canEdit]);

  if (!canEdit) return null;

  return (
    <div data-testid="alert-management">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Alerts</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Manage alert rules and notification thresholds</p>
        </div>
        <button data-testid="create-rule" style={btnStyle('primary')}>
          + Create Rule
        </button>
      </div>

      {loading ? (
        <div data-testid="alerts-loading" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading…
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)' as unknown as number,
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 120px 100px',
            padding: '10px 16px',
            borderBottom: '1px solid var(--card-border)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}>
            <span>Rule Name</span>
            <span>Threshold</span>
            <span>Window</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          <ul data-testid="alert-rules" style={{ listStyle: 'none' }}>
            {rules.length === 0 && (
              <li style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                No alert rules configured
              </li>
            )}
            {rules.map((rule, i) => (
              <li
                key={rule.id}
                data-testid="alert-rule-item"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 120px 100px',
                  padding: '12px 16px',
                  alignItems: 'center',
                  borderBottom: i < rules.length - 1 ? '1px solid var(--card-border)' : 'none',
                  fontSize: 13.5,
                }}
              >
                <span data-testid="rule-name" style={{ fontWeight: 500 }}>{rule.name}</span>
                <span data-testid="rule-threshold" style={{ color: 'var(--text-muted)' }}>{rule.threshold}</span>
                <span data-testid="rule-window" style={{ color: 'var(--text-muted)' }}>{rule.windowSeconds}s</span>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button data-testid="edit-rule" aria-label={`Edit ${rule.name}`} style={btnStyle('ghost')}>
                    Edit
                  </button>
                  <button data-testid="delete-rule" aria-label={`Delete ${rule.name}`} style={btnStyle('danger')}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
