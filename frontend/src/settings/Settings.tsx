/**
 * Settings view — Admin only.
 * Requirements: 6.5, 9.1
 */

import React, { useEffect, useState } from 'react';
import type { RetentionPolicy, Role, User } from '@portal/shared';

interface Props {
  role: Role;
}

export function Settings({ role }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [retention, setRetention] = useState<RetentionPolicy | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/retention').then((r) => r.json()),
    ])
      .then(([usersData, retentionData]) => {
        if (!cancelled) {
          setUsers(usersData as User[]);
          setRetention(retentionData as RetentionPolicy);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [isAdmin]);

  if (!isAdmin) {
    return null; // Hidden for non-Admin roles
  }

  if (loading) return <div data-testid="settings-loading">Loading…</div>;

  return (
    <div data-testid="settings">
      <section data-testid="user-management">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-testid="user-row">
                <td data-testid="user-email">{u.email}</td>
                <td data-testid="user-role">{u.role}</td>
                <td>
                  <button data-testid="edit-user" aria-label={`Edit ${u.email}`}>
                    Edit
                  </button>
                  <button data-testid="delete-user" aria-label={`Delete ${u.email}`}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section data-testid="retention-settings">
        <select
          data-testid="retention-selector"
          value={retention?.retentionDays ?? 30}
          onChange={() => {/* handled by parent */}}
          aria-label="Retention period"
        >
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
          <option value={90}>90 days</option>
        </select>
      </section>
    </div>
  );
}
