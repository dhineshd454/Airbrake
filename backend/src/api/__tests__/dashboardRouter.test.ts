/**
 * Unit tests for Dashboard Aggregation REST API Router
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import {
  createGetDashboardHandler,
  DashboardRepository,
  DashboardRequest,
  DashboardResponse,
} from '../dashboardRouter';
import { createRbacMiddleware, AuditLogRepository, RbacRequest, RbacResponse } from '../../auth/rbac';
import { SessionStore, SessionData } from '../../auth/oauthHandler';

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

function makeReq(overrides: Partial<DashboardRequest> = {}): DashboardRequest {
  return {
    method: 'GET',
    path: '/dashboard',
    headers: {},
    cookies: {},
    query: {},
    params: {},
    ...overrides,
  };
}

function makeRes(): DashboardResponse & { body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.body = body; },
  };
  return res;
}

function makeRepo(overrides: Partial<DashboardRepository> = {}): DashboardRepository {
  return {
    countBreaks: jest.fn().mockResolvedValue(0),
    getErrorRateTrend: jest.fn().mockResolvedValue([]),
    getTopServices: jest.fn().mockResolvedValue([]),
    getTimeSeries: jest.fn().mockResolvedValue([]),
    getSeverityBreakdown: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

// ─── GET /dashboard ───────────────────────────────────────────────────────────

describe('GET /dashboard — aggregation handler', () => {
  it('returns all aggregation fields (Requirements 3.1–3.6)', async () => {
    const trend = [{ timestamp: new Date('2024-01-15T10:00:00Z'), count: 5 }];
    const topSvcs = [{ applicationId: 'app-1', count: 42 }];
    const ts = [{ timestamp: new Date('2024-01-15T00:00:00Z'), count: 10 }];
    const severity = { error: 30, critical: 12 };

    const repo = makeRepo({
      countBreaks: jest.fn()
        .mockResolvedValueOnce(15)   // 24h
        .mockResolvedValueOnce(120), // 7d
      getErrorRateTrend: jest.fn().mockResolvedValue(trend),
      getTopServices: jest.fn().mockResolvedValue(topSvcs),
      getTimeSeries: jest.fn().mockResolvedValue(ts),
      getSeverityBreakdown: jest.fn().mockResolvedValue(severity),
    });

    const handler = createGetDashboardHandler(repo);
    const res = makeRes();
    await handler(makeReq(), res, jest.fn());

    expect(res.statusCode).toBe(200);
    const body = res.body as any;
    expect(body.breakCount24h).toBe(15);
    expect(body.breakCount7d).toBe(120);
    expect(body.errorRateTrend).toEqual(trend);
    expect(body.topServices).toEqual(topSvcs);
    expect(body.timeSeries).toEqual(ts);
    expect(body.severityBreakdown).toEqual(severity);
    expect(body.deploymentEvents).toEqual([]);
  });

  it('calls countBreaks with 24 for 24h and 168 for 7d (Requirement 3.1)', async () => {
    const repo = makeRepo();
    const handler = createGetDashboardHandler(repo);
    await handler(makeReq(), makeRes(), jest.fn());

    expect(repo.countBreaks).toHaveBeenCalledWith(24);
    expect(repo.countBreaks).toHaveBeenCalledWith(168);
  });

  it('defaults granularity to hourly when not specified (Requirement 3.4)', async () => {
    const repo = makeRepo();
    const handler = createGetDashboardHandler(repo);
    await handler(makeReq(), makeRes(), jest.fn());

    expect(repo.getTimeSeries).toHaveBeenCalledWith(
      'hourly',
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('passes granularity=daily to getTimeSeries (Requirement 3.4)', async () => {
    const repo = makeRepo();
    const handler = createGetDashboardHandler(repo);
    await handler(makeReq({ query: { granularity: 'daily' } }), makeRes(), jest.fn());

    expect(repo.getTimeSeries).toHaveBeenCalledWith(
      'daily',
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('passes from/to date range to getTimeSeries (Requirement 3.4)', async () => {
    const from = '2024-01-01T00:00:00Z';
    const to = '2024-01-07T23:59:59Z';
    const repo = makeRepo();
    const handler = createGetDashboardHandler(repo);

    await handler(makeReq({ query: { from, to } }), makeRes(), jest.fn());

    expect(repo.getTimeSeries).toHaveBeenCalledWith(
      'hourly',
      new Date(from),
      new Date(to),
    );
  });

  it('includes deployment events when getDeploymentEvents is available (Requirement 3.6)', async () => {
    const events = [
      { timestamp: new Date('2024-01-15T08:00:00Z'), applicationId: 'app-1', version: 'v1.2.3' },
    ];
    const repo = makeRepo({
      getDeploymentEvents: jest.fn().mockResolvedValue(events),
    });

    const handler = createGetDashboardHandler(repo);
    const res = makeRes();
    await handler(makeReq(), res, jest.fn());

    expect((res.body as any).deploymentEvents).toEqual(events);
  });

  it('returns empty deploymentEvents array when getDeploymentEvents is not defined (Requirement 3.6)', async () => {
    const repo = makeRepo();
    // Ensure getDeploymentEvents is not present
    delete (repo as any).getDeploymentEvents;

    const handler = createGetDashboardHandler(repo);
    const res = makeRes();
    await handler(makeReq(), res, jest.fn());

    expect((res.body as any).deploymentEvents).toEqual([]);
  });

  it('calls getTopServices with limit 10 (Requirement 3.3)', async () => {
    const repo = makeRepo();
    const handler = createGetDashboardHandler(repo);
    await handler(makeReq(), makeRes(), jest.fn());

    expect(repo.getTopServices).toHaveBeenCalledWith(10);
  });

  it('calls getErrorRateTrend with 24h window and 1h buckets (Requirement 3.2)', async () => {
    const repo = makeRepo();
    const handler = createGetDashboardHandler(repo);
    await handler(makeReq(), makeRes(), jest.fn());

    expect(repo.getErrorRateTrend).toHaveBeenCalledWith(24, 1);
  });
});

// ─── RBAC integration ─────────────────────────────────────────────────────────

describe('RBAC middleware — /dashboard', () => {
  function makeRbacReq(overrides: Partial<RbacRequest> = {}): RbacRequest {
    return {
      method: 'GET',
      path: '/dashboard',
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

  it('returns 401 for unauthenticated requests', async () => {
    const middleware = createRbacMiddleware(makeSessionStore(null), makeAuditRepo());
    const res = makeRbacRes();
    await middleware(makeRbacReq(), res, jest.fn());
    expect(res.statusCode).toBe(401);
  });

  it('allows viewer-role requests to GET /dashboard', async () => {
    const middleware = createRbacMiddleware(
      makeSessionStore(makeSession('viewer')),
      makeAuditRepo(),
    );
    const next = jest.fn();
    const res = makeRbacRes();
    await middleware(
      makeRbacReq({ headers: { authorization: 'Bearer viewer-token' } }),
      res,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
