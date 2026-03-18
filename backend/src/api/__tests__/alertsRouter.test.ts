/**
 * Unit tests for Alert Rules REST API Router
 * Requirements: 5.5
 */

import {
  createAlertRuleHandler,
  listAlertRulesHandler,
  updateAlertRuleHandler,
  deleteAlertRuleHandler,
  AlertRuleRepository,
  AlertsRequest,
  AlertsResponse,
} from '../alertsRouter';
import { createRbacMiddleware, AuditLogRepository, RbacRequest, RbacResponse } from '../../auth/rbac';
import { SessionStore, SessionData } from '../../auth/oauthHandler';
import type { AlertRule } from '@portal/shared';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeSessionStore(session: SessionData | null): SessionStore {
  return {
    get: jest.fn().mockResolvedValue(session),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function makeAuditRepo(): AuditLogRepository {
  return { log: jest.fn().mockResolvedValue(undefined) };
}

function makeSession(role: 'admin' | 'developer' | 'viewer' = 'viewer'): SessionData {
  const now = new Date();
  return {
    userId: 'user-1',
    role,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 3600_000),
  };
}

function makeAlertRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: 'rule-1',
    name: 'High Error Rate',
    threshold: 10,
    windowSeconds: 60,
    triggerOnNewError: true,
    channels: [{ type: 'email', address: 'ops@example.com' }],
    createdBy: 'user-1',
    enabled: true,
    ...overrides,
  };
}

function makeReq(overrides: Partial<AlertsRequest> = {}): AlertsRequest {
  return {
    method: 'GET',
    path: '/alerts',
    headers: {},
    cookies: {},
    query: {},
    params: {},
    body: undefined,
    ...overrides,
  };
}

function makeRes(): AlertsResponse & { body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.body = body; },
    send() { /* no body for 204 */ },
  };
  return res;
}

// ─── POST /alerts ─────────────────────────────────────────────────────────────

describe('POST /alerts — create handler', () => {
  it('creates and returns alert rule with 201', async () => {
    const rule = makeAlertRule();
    const repo: AlertRuleRepository = {
      create: jest.fn().mockResolvedValue(rule),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const handler = createAlertRuleHandler(repo);
    const req = makeReq({
      method: 'POST',
      path: '/alerts',
      body: {
        name: 'High Error Rate',
        threshold: 10,
        windowSeconds: 60,
        triggerOnNewError: true,
        channels: [{ type: 'email', address: 'ops@example.com' }],
        createdBy: 'user-1',
        enabled: true,
      },
    });
    const res = makeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(rule);
    expect(repo.create).toHaveBeenCalledWith(req.body);
  });
});

// ─── GET /alerts ──────────────────────────────────────────────────────────────

describe('GET /alerts — list handler', () => {
  it('returns list of alert rules with 200', async () => {
    const rules = [makeAlertRule(), makeAlertRule({ id: 'rule-2', name: 'New Error' })];
    const repo: AlertRuleRepository = {
      create: jest.fn(),
      findAll: jest.fn().mockResolvedValue(rules),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const handler = listAlertRulesHandler(repo);
    const req = makeReq({ method: 'GET', path: '/alerts' });
    const res = makeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(rules);
  });
});

// ─── PUT /alerts/:id ──────────────────────────────────────────────────────────

describe('PUT /alerts/:id — update handler', () => {
  it('updates and returns alert rule with 200', async () => {
    const updated = makeAlertRule({ name: 'Updated Rule', threshold: 20 });
    const repo: AlertRuleRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn().mockResolvedValue(updated),
      delete: jest.fn(),
    };

    const handler = updateAlertRuleHandler(repo);
    const req = makeReq({
      method: 'PUT',
      params: { id: 'rule-1' },
      body: { name: 'Updated Rule', threshold: 20 },
    });
    const res = makeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(updated);
    expect(repo.update).toHaveBeenCalledWith('rule-1', { name: 'Updated Rule', threshold: 20 });
  });

  it('returns 404 for unknown id', async () => {
    const repo: AlertRuleRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn(),
    };

    const handler = updateAlertRuleHandler(repo);
    const req = makeReq({ method: 'PUT', params: { id: 'nonexistent' }, body: { name: 'x' } });
    const res = makeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found', message: 'Alert rule not found.' });
  });
});

// ─── DELETE /alerts/:id ───────────────────────────────────────────────────────

describe('DELETE /alerts/:id — delete handler', () => {
  it('returns 204 on successful delete', async () => {
    const repo: AlertRuleRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue(true),
    };

    const handler = deleteAlertRuleHandler(repo);
    const req = makeReq({ method: 'DELETE', params: { id: 'rule-1' } });
    const res = makeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(204);
  });

  it('returns 404 for unknown id', async () => {
    const repo: AlertRuleRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue(false),
    };

    const handler = deleteAlertRuleHandler(repo);
    const req = makeReq({ method: 'DELETE', params: { id: 'nonexistent' } });
    const res = makeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found', message: 'Alert rule not found.' });
  });
});

// ─── RBAC integration ─────────────────────────────────────────────────────────

describe('RBAC middleware integration', () => {
  function makeRbacReq(overrides: Partial<RbacRequest> = {}): RbacRequest {
    return {
      method: 'POST',
      path: '/alerts',
      headers: {},
      cookies: {},
      ...overrides,
    };
  }

  function makeRbacRes(): RbacResponse & { statusCode: number } {
    const res = {
      statusCode: 200,
      status(code: number) { res.statusCode = code; return res; },
      json(_body: unknown) { /* noop */ },
    };
    return res;
  }

  it('returns 401 for unauthenticated requests (no token)', async () => {
    const middleware = createRbacMiddleware(makeSessionStore(null), makeAuditRepo());
    const req = makeRbacReq({ method: 'POST', path: '/alerts' });
    const res = makeRbacRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('viewer cannot POST /alerts (403)', async () => {
    const middleware = createRbacMiddleware(makeSessionStore(makeSession('viewer')), makeAuditRepo());
    const req = makeRbacReq({
      method: 'POST',
      path: '/alerts',
      headers: { authorization: 'Bearer viewer-token' },
    });
    const res = makeRbacRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('developer can POST /alerts', async () => {
    const middleware = createRbacMiddleware(makeSessionStore(makeSession('developer')), makeAuditRepo());
    const req = makeRbacReq({
      method: 'POST',
      path: '/alerts',
      headers: { authorization: 'Bearer dev-token' },
    });
    const res = makeRbacRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('viewer can GET /alerts', async () => {
    const middleware = createRbacMiddleware(makeSessionStore(makeSession('viewer')), makeAuditRepo());
    const req = makeRbacReq({
      method: 'GET',
      path: '/alerts',
      headers: { authorization: 'Bearer viewer-token' },
    });
    const res = makeRbacRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
