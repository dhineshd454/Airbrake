import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const SESSION_TOKEN_KEY = 'session_token';

interface ProtectedRouteProps {
  readonly children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const token = localStorage.getItem(SESSION_TOKEN_KEY);

  if (!token) {
    const redirectUri = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?redirect_uri=${redirectUri}`} replace />;
  }

  return <>{children}</>;
}
