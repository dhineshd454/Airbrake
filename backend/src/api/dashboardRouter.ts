/**
 * Dashboard Aggregation REST API Router
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import type { Role } from '@portal/shared';
import { createRbacMiddleware, AuditLogRepository, RbacMiddleware } from '../auth/rbac';
import { SessionStore } from '../auth/oauthHandler';

// ─── Repository Interface ─────────────────────────────────────────────────────

export interface DashboardRepository {
  countBreaks(windowHours: number): Promise<number>;
  getErrorRateTrend(
    windowHours: number,
    bucketHours: number,
  ): Promise<Array<{ timestamp: Date; count: number }>>;
  getTopServices(limit: number): Promise<Array<{ applicationId: string; count: number }>>;
  getTimeSeries(
    granularity: 'hourly' | 'daily',
    from: Date,
    to: Date,
  ): Promise<Array<{ timestamp: Date; count: number }>>;
  getSeverityBreakdown(): Promise<Record<string, number>>;
  getDeploymentEvents?(): Promise<Array<{ timestamp: Date; applicationId: string; version: string }>>;
}

// ─── Request / Response Types ─────────────────────────────────────────────────

export interface DashboardRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  ip?: string;
  query: Record<string, string | undefined>;
  params: Record<string, string>;
  session?: { userId: string; role: Role };
}

export interface DashboardResponse {
  statusCode: number;
  status(code: number): DashboardResponse;
  json(body: unknown): void;
}

export type NextFn = () => void;

export type DashboardHandler = (
  req: DashboardRequest,
  res: DashboardResponse,
  next: NextFn,
) => Promise<void>;

// ─── Handler Factory ──────────────────────────────────────────────────────────

/**
 * GET /dashboard — returns aggregated metrics.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export function createGetDashboardHandler(repo: DashboardRepository): DashboardHandler {
  return async (req, res) => {
    const granularity =
      req.query['granularity'] === 'daily' ? 'daily' : 'hourly';

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const from = req.query['from'] ? new Date(req.query['from']) : defaultFrom;
    const to = req.query['to'] ? new Date(req.query['to']) : now;

    const [
      breakCount24h,
      breakCount7d,
      errorRateTrend,
      topServices,
      timeSeries,
      severityBreakdown,
    ] = await Promise.all([
      repo.countBreaks(24),
      repo.countBreaks(7 * 24),
      repo.getErrorRateTrend(24, 1),
      repo.getTopServices(10),
      repo.getTimeSeries(granularity, from, to),
      repo.getSeverityBreakdown(),
    ]);

    const deploymentEvents =
      typeof repo.getDeploymentEvents === 'function'
        ? await repo.getDeploymentEvents()
        : [];

    res.json({
      breakCount24h,
      breakCount7d,
      errorRateTrend,
      topServices,
      timeSeries,
      severityBreakdown,
      deploymentEvents,
    });
  };
}

// ─── Router Factory ───────────────────────────────────────────────────────────

export async function createDashboardRouter(
  dashboardRepo: DashboardRepository,
  sessionStore: SessionStore,
  auditLogRepo: AuditLogRepository,
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  const router = express.Router();
  const rbac = createRbacMiddleware(sessionStore, auditLogRepo) as any;

  router.use(rbac);
  router.get('/', createGetDashboardHandler(dashboardRepo) as any);

  return router;
}

export function createDashboardRouterSync(
  dashboardRepo: DashboardRepository,
  sessionStore: SessionStore,
  auditLogRepo: AuditLogRepository,
  rbacMiddleware?: RbacMiddleware,
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  const router = express.Router();
  const rbac = rbacMiddleware ?? (createRbacMiddleware(sessionStore, auditLogRepo) as any);

  router.use(rbac);
  router.get('/', createGetDashboardHandler(dashboardRepo) as any);

  return router;
}
