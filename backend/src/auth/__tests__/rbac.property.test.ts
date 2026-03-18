/**
 * Property-based tests for RBAC enforcement
 * Feature: live-airbrake-monitoring-portal, Property 15: RBAC Enforcement
 * Feature: live-airbrake-monitoring-portal, Property 16: Unauthenticated Access Rejection
 *
 * Validates: Requirements 5.5, 6.3, 6.4, 6.5, 6.6, 7.1
 */

import * as fc from 'fast-check';
import {
  hasPermission,
  createRbacMiddleware,
  RbacRequest,
  RbacResponse,
  NextFunction,
  AuditLogRepository,
} from '../rbac';
import { SessionStore } from '../oauthHandler';

// Mock the dynamic import of oauthHandler inside createRbacMiddleware
jest.mock('../oauthHandler', () => ({
  ...jest.requireActual('../oauthHandler'),
  getSession: jest.fn(),
}));

import * as oauthHandler from '../oauthHandler';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const writeMethods = fc.constantFrom('POST', 'PUT', 'DELETE');
const anyMethod = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE');

// Endpoints that viewers cannot write to
const writeRestrictedPaths = fc.constantFrom('/alerts', '/filters', '/users', '/retention');

// Endpoints that developers cannot access at all
const developerRestrictedPaths = fc.constantFrom('/users', '/retention');

// Viewer read-only endpoints
const viewerReadPaths = fc.constantFrom('/breaks', '/logs', '/dashboard');

// ─── Property 15: RBAC Enforcement ───────────────────────────────────────────

// Feature: live-airbrake-monitoring-portal, Property 15: RBAC Enforcement
describe('Property 15: RBAC Enforcement', () => {
  it('viewer is denied any write operation on /alerts, /filters, /users, /retention', () => {
    fc.assert(
      fc.property(writeMethods, writeRestrictedPaths, (method, path) => {
        expect(hasPermission('viewer', method, path)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('developer is denied any operation on /users and /retention', () => {
    fc.assert(
      fc.property(anyMethod, developerRestrictedPaths, (method, path) => {
        // Developer has no access to /users or /retention at all
        // (admin-only endpoints)
        expect(hasPermission('developer', method, path)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('admin is allowed all operations that viewer, developer, or admin-extra permissions grant', () => {
    // Admin inherits all viewer + developer + admin-extra permissions.
    // We verify that every permission granted to viewer or developer is also
    // granted to admin (i.e., admin is a superset of all lower roles).
    const viewerAllowedCombinations = fc.constantFrom(
      ['GET', '/breaks'] as const,
      ['GET', '/logs'] as const,
      ['GET', '/dashboard'] as const,
      ['GET', '/filters'] as const,
      ['GET', '/alerts'] as const,
      ['GET', '/applications'] as const,
    );
    const developerAllowedCombinations = fc.constantFrom(
      ['POST', '/alerts'] as const,
      ['PUT', '/alerts'] as const,
      ['DELETE', '/alerts'] as const,
      ['POST', '/filters'] as const,
      ['PUT', '/filters'] as const,
      ['DELETE', '/filters'] as const,
    );
    const adminOnlyCombinations = fc.constantFrom(
      ['GET', '/users'] as const,
      ['POST', '/users'] as const,
      ['PUT', '/users'] as const,
      ['DELETE', '/users'] as const,
      ['GET', '/retention'] as const,
      ['PUT', '/retention'] as const,
      ['POST', '/applications'] as const,
    );
    const allGrantedCombinations = fc.oneof(
      viewerAllowedCombinations,
      developerAllowedCombinations,
      adminOnlyCombinations,
    );

    fc.assert(
      fc.property(allGrantedCombinations, ([method, path]) => {
        expect(hasPermission('admin', method, path)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('viewer read operations on /breaks, /logs, /dashboard are always allowed', () => {
    fc.assert(
      fc.property(viewerReadPaths, (path) => {
        expect(hasPermission('viewer', 'GET', path)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 16: Unauthenticated Access Rejection ───────────────────────────

// Feature: live-airbrake-monitoring-portal, Property 16: Unauthenticated Access Rejection
/**
 * Validates: Requirements 7.1
 */
describe('Property 16: Unauthenticated Access Rejection', () => {
  // Session store that always returns null (no valid session)
  const nullSessionStore: SessionStore = {
    get: async (_token: string) => null,
    set: async () => {},
    delete: async () => {},
  };

  const noopAuditLog: AuditLogRepository = {
    log: async () => {},
  };

  const httpMethods = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS');
  const protectedPaths = fc.constantFrom(
    '/breaks',
    '/logs',
    '/dashboard',
    '/alerts',
    '/filters',
    '/users',
    '/retention',
    '/applications',
  );

  beforeEach(() => {
    // getSession always returns null — simulates no valid session
    (oauthHandler.getSession as jest.Mock).mockResolvedValue(null);
  });

  it('returns 401 and never calls next() for requests with no token', async () => {
    await fc.assert(
      fc.asyncProperty(httpMethods, protectedPaths, async (method, path) => {
        const middleware = createRbacMiddleware(nullSessionStore, noopAuditLog);

        let statusCode: number | undefined;
        let nextCalled = false;

        const req: RbacRequest = {
          headers: {},
          method,
          path,
        };

        const res: RbacResponse = {
          status(code: number) {
            statusCode = code;
            return this;
          },
          json(_body: unknown) {},
        };

        const next: NextFunction = () => {
          nextCalled = true;
        };

        await middleware(req, res, next);

        expect(statusCode).toBe(401);
        expect(nextCalled).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('returns 401 and never calls next() for requests with an invalid/expired token', async () => {
    const arbitraryToken = fc.string({ minLength: 1, maxLength: 128 });

    await fc.assert(
      fc.asyncProperty(httpMethods, protectedPaths, arbitraryToken, async (method, path, token) => {
        const middleware = createRbacMiddleware(nullSessionStore, noopAuditLog);

        let statusCode: number | undefined;
        let nextCalled = false;

        const req: RbacRequest = {
          headers: { authorization: `Bearer ${token}` },
          method,
          path,
        };

        const res: RbacResponse = {
          status(code: number) {
            statusCode = code;
            return this;
          },
          json(_body: unknown) {},
        };

        const next: NextFunction = () => {
          nextCalled = true;
        };

        await middleware(req, res, next);

        expect(statusCode).toBe(401);
        expect(nextCalled).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
