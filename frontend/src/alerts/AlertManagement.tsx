/**
 * Alert Management view — Admin/Developer only.
 * Requirements: 5.5, 6.3, 6.4
 */

import React, { useEffect, useState } from 'react';
import type { AlertRule, Role } from '@portal/shared';

interface Props {
  role: Role;
}

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

  if (!canEdit) {
    return null; // Hidden for Viewer role
  }

  if (loading) return <div data-testid="alerts-loading">Loading…</div>;

  return (
    <div data-testid="alert-management">
      <ul data-testid="alert-rules">
        {rules.map((rule) => (
          <li key={rule.id} data-testid="alert-rule-item">
            <span data-testid="rule-name">{rule.name}</span>
            <span data-testid="rule-threshold">{rule.threshold}</span>
            <span data-testid="rule-window">{rule.windowSeconds}s</span>
            <button data-testid="edit-rule" aria-label={`Edit ${rule.name}`}>
              Edit
            </button>
            <button data-testid="delete-rule" aria-label={`Delete ${rule.name}`}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <button data-testid="create-rule">Create Rule</button>
    </div>
  );
}
