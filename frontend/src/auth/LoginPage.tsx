import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ROLES = ['admin', 'developer', 'viewer'] as const;

export function LoginPage() {
  const [role, setRole] = useState<string>('admin');
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const handleLogin = () => {
    // Dev bypass: set a fake session token and role, then redirect
    localStorage.setItem('session_token', `dev-token-${role}`);
    localStorage.setItem('session_role', role);
    const redirect = params.get('redirect_uri') ?? '/dashboard';
    navigate(decodeURIComponent(redirect), { replace: true });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 120, fontFamily: 'sans-serif' }}>
      <h2>Airbrake Monitoring Portal</h2>
      <p style={{ color: '#666' }}>Dev login — pick a role to continue</p>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        style={{ padding: '8px 12px', fontSize: 14, marginBottom: 12, borderRadius: 4, border: '1px solid #ccc' }}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <button
        onClick={handleLogin}
        style={{ padding: '8px 24px', fontSize: 14, borderRadius: 4, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}
      >
        Sign in
      </button>
    </div>
  );
}
