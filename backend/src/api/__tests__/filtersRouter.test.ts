/**
 * Unit tests for Saved Filters REST API Router
 * Requirements: 8.3, 8.4
 */

import {
  createSavedFilterHandler,
  getFilterHandler,
  updateFilterHandler,
  deleteFilterHandler,
  SavedFilterRepository,
  FiltersRequest,
  FiltersResponse,
} from '../filtersRouter';
import { createRbacMiddleware, AuditLogRepository, RbacRequest, RbacResponse } from '../../auth/rbac';
import { SessionStore, SessionData } from '../../auth/oauthHandler';
import type { SavedFilter } from '@portal/shared';

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

function makeFilter(overrides: Partial<SavedFilter> = {}): SavedFilter {
  return {
    id: 'filter-1',
    userId: 'user-1',
    name: 'My Filter',
    criteria: {
      keyword: 'TypeError',
      severity: ['error'],
    },
    ...overrides,
  };
}

function makeReq(overrides: Partial<FiltersRequest> = {}): FiltersRequest {
  return {
    method: 'GET',
    path: '/filters',
    headers: {},
    cookies: {},
    query: {},
    params: {},
    body: undefined,
    ...overrides,
  };
}

function makeRes(): FiltersResponse & { body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.body = body; },
    send() { /* no body for 204 */ },
  };
  return res;
}

// ─── POST /filters ────────────────────────────────────────────────────────────

describe('POST /filters — create handler', () => {
  it('creates and returns filter with 201', async () => {
    const filter = makeFilter();
    const repo: SavedFilterRepository = {
      create: jest.fn().mockResolvedValue(filter),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const handler = createSavedFilterHandler(repo);
    const req = makeReq({
      method: 'POST',
      path: '/filters',
      body: { userId: 'user-1', name: 'My Filter', criteria: { keyword: 'TypeError', severity: ['error'] } },
    });
    const res = makeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(filter);
    expect(repo.create).toHaveBeenCalledWith(req.body);
  });
});

// ─── GET /filters/:id ─────────────────────────────────────────────────────────

describe('GET /filters/:id — get handler', () => {
  it('returns filter with 200', async () => {
    const filter = makeFilter();
    const repo: SavedFilterRepository = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue(filter),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const handler = getFilterHandler(repo);
    const req = makeReq({ params: { id: 'filter-1' } });
    const res = makeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(filter);
  });

  it('returns 404 for unknown id', async () => {
    const repo: SavedFilterRepository = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const handler = getFilterHandler(repo);
    const req = makeReq({ params: { id: 'nonexistent' } });
    const res = makeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found', message: 'Filter not found.' });
  });
});

// ─── PUT /filters/:id ─────────────────────────────────────────────────────────

describe('PUT /filters/:id — update handler', () => {
  it('updates and returns filter with 200', async () => {
    const updated = makeFilter({ name: 'Updated Filter' });
    const repo: SavedFilterRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn().mockResolvedValue(updated),
      delete: jest.fn(),
    };

    const handler = updateFilterHandler(repo);
    const req = makeReq({
      method: 'PUT',
      params: { id: 'filter-1' },
      body: { name: 'Updated Filter' },
    });
    const res = makeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(updated);
    expect(repo.update).toHaveBeenCalledWith('filter-1', { name: 'Updated Filter' });
  });

  it('returns 404 for unknown id', async () => {
    const repo: SavedFilterRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn(),
    };

    const handler = updateFilterHandler(repo);
    const req = makeReq({ method: 'PUT', params: { id: 'nonexistent' }, body: { name: 'x' } });
    const res = makeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found', message: 'Filter not found.' });
  });
});

// ─── DELETE /filters/:id ──────────────────────────────────────────────────────

describe('DELETE /filters/:id — delete handler', () => {
  it('returns 204 on successful delete', async () => {
    const repo: SavedFilterRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue(true),
    };

    const handler = deleteFilterHandler(repo);
    const req = makeReq({ method: 'DELETE', params: { id: 'filter-1' } });
    const res = makeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(204);
  });

  it('returns 404 for unknown id', async () => {
    const repo: SavedFilterRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue(false),
    };

    const handler = deleteFilterHandler(repo);
    const req = makeReq({ method: 'DELETE', params: { id: 'nonexistent' } });
    const res = makeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found', message: 'Filter not found.' });
  });
});

// ─── RBAC integration ─────────────────────────────────────────────────────────

describe('RBAC middleware integration', () => {
  function makeRbacReq(overrides: Partial<RbacRequest> = {}): RbacRequest {
    return {
      method: 'POST',
      path: '/filters',
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
    const req = makeRbacReq({ method: 'POST', path: '/filters' });
    const res = makeRbacRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('viewer cannot POST /filters (403)', async () => {
    const middleware = createRbacMiddleware(makeSessionStore(makeSession('viewer')), makeAuditRepo());
    const req = makeRbacReq({
      method: 'POST',
      path: '/filters',
      headers: { authorization: 'Bearer viewer-token' },
    });
    const res = makeRbacRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('developer can POST /filters', async () => {
    const middleware = createRbacMiddleware(makeSessionStore(makeSession('developer')), makeAuditRepo());
    const req = makeRbacReq({
      method: 'POST',
      path: '/filters',
      headers: { authorization: 'Bearer dev-token' },
    });
    const res = makeRbacRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('viewer can GET /filters/:id', async () => {
    const middleware = createRbacMiddleware(makeSessionStore(makeSession('viewer')), makeAuditRepo());
    const req = makeRbacReq({
      method: 'GET',
      path: '/filters/filter-1',
      headers: { authorization: 'Bearer viewer-token' },
    });
    const res = makeRbacRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
