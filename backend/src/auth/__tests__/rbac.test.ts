/**
 * Unit tests for RBAC middleware
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 7.1
 */

import {
  hasPermission,
  createRbacMiddleware,
  AuditLogRepository,
  AuditLogEntry,
  RbacRequest,
  RbacResponse,
} from '../rbac';
import { SessionStore, SessionData } from '../oauthHandler';
import { Role } from '@portal/shared';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSessionStore(session: SessionData | null): SessionStore {
  return {
    get: jest.fn().mockResolvedValue(session),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function makeAuditRepo(): AuditLogRepository & { entries: AuditLogEntry[] } {
  const entries: AuditLogEntry[] = [];
  return {
    entries,
    log: jest.fn(async (entry: AuditLogEntry) => { entries.push(entry); }),
  };
}

function makeSession(role: Role): SessionData {
  const now = new Date();
  return {
    userId: 'user-1',
    role,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 86400_000),
  };
}

function makeReq(
  method: string,
  path: string,
  token?: string,
  cookie?: string
): RbacRequest {
  const headers: Record<string, string | undefined> = {};
  if (token) headers['authorization'] = `Bearer ${token}`;
  return {
    headers,
    cookies: cookie ? { session: cookie } : {},
    method,
    path,
    ip: '127.0.0.1',
  };
}

function makeRes(): RbacResponse & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.body = body; },
  };
  return res;
}

// ─── hasPermission ────────────────────────────────────────────────────────────

describe('hasPermission', () => {
  describe('viewer', () => {
    it('allows GET /breaks', () => expect(hasPermission('viewer', 'GET', '/breaks')).toBe(true));
    it('allows GET /breaks/123', () => expect(hasPermission('viewer', 'GET', '/breaks/123')).toBe(true));
    it('allows GET /logs', () => expect(hasPermission('viewer', 'GET', '/logs')).toBe(true));
    it('allows GET /dashboard', () => expect(hasPermission('viewer', 'GET', '/dashboard')).toBe(true));
    it('allows GET /filters', () => expect(hasPermission('viewer', 'GET', '/filters')).toBe(true));
    it('allows GET /alerts', () => expect(hasPermission('viewer', 'GET', '/alerts')).toBe(true));

    it('denies POST /alerts', () => expect(hasPermission('viewer', 'POST', '/alerts')).toBe(false));
    it('denies DELETE /alerts/1', () => expect(hasPermission('viewer', 'DELETE', '/alerts/1')).toBe(false));
    it('denies POST /filters', () => expect(hasPermission('viewer', 'POST', '/filters')).toBe(false));
    it('denies GET /users', () => expect(hasPermission('viewer', 'GET', '/users')).toBe(false));
    it('denies PUT /retention', () => expect(hasPermission('viewer', 'PUT', '/retention')).toBe(false));
    it('denies POST /applications', () => expect(hasPermission('viewer', 'POST', '/applications')).toBe(false));
  });

  describe('developer', () => {
    it('allows GET /breaks', () => expect(hasPermission('developer', 'GET', '/breaks')).toBe(true));
    it('allows POST /alerts', () => expect(hasPermission('developer', 'POST', '/alerts')).toBe(true));
    it('allows PUT /alerts/1', () => expect(hasPermission('developer', 'PUT', '/alerts/1')).toBe(true));
    it('allows DELETE /alerts/1', () => expect(hasPermission('developer', 'DELETE', '/alerts/1')).toBe(true));
    it('allows POST /filters', () => expect(hasPermission('developer', 'POST', '/filters')).toBe(true));
    it('allows PUT /filters/1', () => expect(hasPermission('developer', 'PUT', '/filters/1')).toBe(true));
    it('allows DELETE /filters/1', () => expect(hasPermission('developer', 'DELETE', '/filters/1')).toBe(true));

    it('denies GET /users', () => expect(hasPermission('developer', 'GET', '/users')).toBe(false));
    it('denies POST /users', () => expect(hasPermission('developer', 'POST', '/users')).toBe(false));
    it('denies PUT /retention', () => expect(hasPermission('developer', 'PUT', '/retention')).toBe(false));
    it('denies POST /applications', () => expect(hasPermission('developer', 'POST', '/applications')).toBe(false));
  });

  describe('admin', () => {
    it('allows GET /breaks', () => expect(hasPermission('admin', 'GET', '/breaks')).toBe(true));
    it('allows POST /alerts', () => expect(hasPermission('admin', 'POST', '/alerts')).toBe(true));
    it('allows GET /users', () => expect(hasPermission('admin', 'GET', '/users')).toBe(true));
    it('allows POST /users', () => expect(hasPermission('admin', 'POST', '/users')).toBe(true));
    it('allows PUT /users/1', () => expect(hasPermission('admin', 'PUT', '/users/1')).toBe(true));
    it('allows DELETE /users/1', () => expect(hasPermission('admin', 'DELETE', '/users/1')).toBe(true));
    it('allows GET /retention', () => expect(hasPermission('admin', 'GET', '/retention')).toBe(true));
    it('allows PUT /retention', () => expect(hasPermission('admin', 'PUT', '/retention')).toBe(true));
    it('allows POST /applications', () => expect(hasPermission('admin', 'POST', '/applications')).toBe(true));
  });
});

// ─── createRbacMiddleware ─────────────────────────────────────────────────────

describe('createRbacMiddleware', () => {
  it('returns 401 when no token is provided', async () => {
    const store = makeSessionStore(null);
    const audit = makeAuditRepo();
    const middleware = createRbacMiddleware(store, audit);

    const req = makeReq('GET', '/breaks');
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid/expired (session not found)', async () => {
    const store = makeSessionStore(null);
    const audit = makeAuditRepo();
    const middleware = createRbacMiddleware(store, audit);

    const req = makeReq('GET', '/breaks', 'bad-token');
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when session is expired', async () => {
    const expired: SessionData = {
      userId: 'user-1',
      role: 'viewer',
      createdAt: new Date(Date.now() - 200_000),
      expiresAt: new Date(Date.now() - 100_000), // already expired
    };
    const store = makeSessionStore(expired);
    const audit = makeAuditRepo();
    const middleware = createRbacMiddleware(store, audit);

    const req = makeReq('GET', '/breaks', 'expired-token');
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 and writes audit log when viewer tries to POST /alerts', async () => {
    const store = makeSessionStore(makeSession('viewer'));
    const audit = makeAuditRepo();
    const middleware = createRbacMiddleware(store, audit);

    const req = makeReq('POST', '/alerts', 'valid-token');
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({
      userId: 'user-1',
      outcome: 'denied',
      resource: '/alerts',
    });
  });

  it('returns 403 and writes audit log when developer tries to GET /users', async () => {
    const store = makeSessionStore(makeSession('developer'));
    const audit = makeAuditRepo();
    const middleware = createRbacMiddleware(store, audit);

    const req = makeReq('GET', '/users', 'valid-token');
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
    expect(audit.entries[0].outcome).toBe('denied');
  });

  it('calls next() and attaches session for authorized viewer GET /breaks', async () => {
    const store = makeSessionStore(makeSession('viewer'));
    const audit = makeAuditRepo();
    const middleware = createRbacMiddleware(store, audit);

    const req = makeReq('GET', '/breaks', 'valid-token');
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(200); // unchanged
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.session).toEqual({ userId: 'user-1', role: 'viewer' });
    expect(audit.entries).toHaveLength(0);
  });

  it('calls next() for developer POST /alerts', async () => {
    const store = makeSessionStore(makeSession('developer'));
    const audit = makeAuditRepo();
    const middleware = createRbacMiddleware(store, audit);

    const req = makeReq('POST', '/alerts', 'valid-token');
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(audit.entries).toHaveLength(0);
  });

  it('calls next() for admin GET /users', async () => {
    const store = makeSessionStore(makeSession('admin'));
    const audit = makeAuditRepo();
    const middleware = createRbacMiddleware(store, audit);

    const req = makeReq('GET', '/users', 'valid-token');
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(audit.entries).toHaveLength(0);
  });

  it('extracts token from cookie when no Authorization header', async () => {
    const store = makeSessionStore(makeSession('viewer'));
    const audit = makeAuditRepo();
    const middleware = createRbacMiddleware(store, audit);

    const req = makeReq('GET', '/breaks', undefined, 'cookie-token');
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(store.get).toHaveBeenCalledWith('cookie-token');
  });

  it('does not write audit log on successful access', async () => {
    const store = makeSessionStore(makeSession('admin'));
    const audit = makeAuditRepo();
    const middleware = createRbacMiddleware(store, audit);

    const req = makeReq('PUT', '/retention', 'valid-token');
    const res = makeRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(audit.entries).toHaveLength(0);
  });
});
