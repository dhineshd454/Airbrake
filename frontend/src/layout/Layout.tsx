import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../theme/ThemeContext';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/logs', label: 'Log Stream' },
  { to: '/breaks', label: 'Breaks' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/settings', label: 'Settings' },
];

interface Props {
  children: React.ReactNode;
}

export function Layout({ children }: Props) {
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const isDark = theme === 'dark';

  const bg = isDark ? '#0f172a' : '#f8fafc';
  const sidebar = isDark ? '#1e293b' : '#1e40af';
  const text = isDark ? '#f1f5f9' : '#1e293b';
  const activeLink = isDark ? '#38bdf8' : '#bfdbfe';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: bg, color: text, fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <nav style={{ width: 220, background: sidebar, padding: '24px 0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '0 20px 24px', fontSize: 16, fontWeight: 700, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          🔥 Airbrake Portal
        </div>
        <div style={{ flex: 1, paddingTop: 16 }}>
          {NAV_LINKS.map(({ to, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                style={{
                  display: 'block',
                  padding: '10px 20px',
                  color: active ? activeLink : 'rgba(255,255,255,0.75)',
                  textDecoration: 'none',
                  fontWeight: active ? 600 : 400,
                  background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                  borderLeft: active ? `3px solid ${activeLink}` : '3px solid transparent',
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            {isDark ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
