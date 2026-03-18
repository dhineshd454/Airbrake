/**
 * RBAC Middleware
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 7.1
 */

import { Role } from '@portal/shared';
import { SessionStore } from './oauthHandler';

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  userId: string | null;
  action: string;
  resource: string;
  outcome: 'allowed' | 'denied';
  ipAddress?: string;
}

export interface AuditLogRepository {
  log(entry: AuditLogEntry): Promise<void>;
}

// ─── Permission Definitions ───────────────────────────────────────────────────

/**
 * A permission rule: an HTTP method pattern and a path prefix/pattern.
 * method: '*' matches any method.
 * path: string prefix to match against the request path.
 */
interface PermissionRule {
  method: string; // 'GET' | 'POST' | 'PUT' | 'DELETE' | '*'
  pathPrefix: string;
}

const VIEWER_PERMISSIONS: PermissionRule[] = [
  { method: 'GET', pathPrefix: '/breaks' },
  { method: 'GET', pathPrefix: '/logs' },
  { method: 'GET', pathPrefix: '/dashboard' },
  { method: 'GET', pathPrefix: '/filters' },
  { method: 'GET', pathPrefix: '/alerts' },
  { method: 'GET', pathPrefix: '/applications' },
];

const DEVELOPER_EXTRA_PERMISSIONS: PermissionRule[] = [
  { method: 'POST',   pathPrefix: '/alerts' },
  { method: 'PUT',    pathPrefix: '/alerts' },
  { method: 'DELETE', pathPrefix: '/alerts' },
  { method: 'POST',   pathPrefix: '/filters' },
  { method: 'PUT',    pathPrefix: '/filters' },
  { method: 'DELETE', pathPrefix: '/filters' },
];

const ADMIN_EXTRA_PERMISSIONS: PermissionRule[] = [
  { method: 'GET',    pathPrefix: '/users' },
  { method: 'POST',   pathPrefix: '/users' },
  { method: 'PUT',    pathPrefix: '/users' },
  { method: 'DELETE', pathPrefix: '/users' },
  { method: 'GET',    pathPrefix: '/retention' },
  { method: 'PUT',    pathPrefix: '/retention' },
  { method: 'POST',   pathPrefix: '/applications' },
];

const ROLE_PERMISSIONS: Record<Role, PermissionRule[]> = {
  viewer: VIEWER_PERMISSIONS,
  developer: [...VIEWER_PERMISSIONS, ...DEVELOPER_EXTRA_PERMISSIONS],
  admin: [...VIEWER_PERMISSIONS, ...DEVELOPER_EXTRA_PERMISSIONS, ...ADMIN_EXTRA_PERMISSIONS],
};

// ─── Pure Permission Check ────────────────────────────────────────────────────

/**
 * Pure function: returns true if the given role is allowed to access
 * the given HTTP method + path combination.
 *
 * Exported for testability (Property 15).
 */
export function hasPermission(role: Role, method: string, path: string): boolean {
  const rules = ROLE_PERMISSIONS[role];
  if (!rules) return false;

  const upperMethod = method.toUpperCase();

  return rules.some(
    (rule) =>
      (rule.method === '*' || rule.method === upperMethod) &&
      (path === rule.pathPrefix || path.startsWith(rule.pathPrefix + '/') || path.startsWith(rule.pathPrefix + '?'))
  );
}

// ─── Middleware Types ─────────────────────────────────────────────────────────

export interface RbacRequest {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  method: string;
  path: string;
  ip?: string;
  session?: { userId: string; role: Role };
}

export interface RbacResponse {
  status(code: number): RbacResponse;
  json(body: unknown): void;
}

export type NextFunction = () => void;

export type RbacMiddleware = (
  req: RbacRequest,
  res: RbacResponse,
  next: NextFunction
) => Promise<void>;

// ─── Token Extraction ─────────────────────────────────────────────────────────

function extractToken(req: RbacRequest): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const bearerToken = headerValue?.startsWith('Bearer ') ? headerValue.slice(7).trim() : undefined;
  if (bearerToken) return bearerToken;

  // 2. Cookie: session=<token>
  const cookieToken = req.cookies?.['session'];
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

// ─── Middleware Factory ───────────────────────────────────────────────────────

/**
 * Creates an Express-compatible RBAC middleware using dependency injection.
 *
 * - Returns 401 for missing or invalid/expired session tokens.
 * - Returns 403 (and writes to audit log) for valid sessions with insufficient role.
 * - Attaches session data to `req.session` and calls `next()` on success.
 */
export function createRbacMiddleware(
  sessionStore: SessionStore,
  auditLogRepo: AuditLogRepository
): RbacMiddleware {
  return async (req: RbacRequest, res: RbacResponse, next: NextFunction): Promise<void> => {
    const token = extractToken(req);

    // 401 — no token provided
    if (!token) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
      return;
    }

    // Resolve session
    const { getSession } = await import('./oauthHandler');
    const session = await getSession(token, sessionStore);

    // 401 — token invalid or expired
    if (!session) {
      res.status(401).json({ error: 'Unauthorized', message: 'Session invalid or expired.' });
      return;
    }

    // Check role permission
    if (!hasPermission(session.role, req.method, req.path)) {
      // Write to audit log (Requirement 6.6)
      await auditLogRepo.log({
        userId: session.userId,
        action: `${req.method} ${req.path}`,
        resource: req.path,
        outcome: 'denied',
        ipAddress: req.ip,
      });

      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions.' });
      return;
    }

    // Attach session to request and proceed
    req.session = { userId: session.userId, role: session.role };
    next();
  };
}
