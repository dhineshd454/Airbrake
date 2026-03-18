/**
 * Breaks REST API Router
 * Requirements: 2.1, 4.1, 4.2, 4.3, 4.4
 */

import type { Break, LogRecord, Role } from '@portal/shared';
import { createRbacMiddleware, AuditLogRepository, RbacMiddleware } from '../auth/rbac';
import { SessionStore } from '../auth/oauthHandler';
import { BreakExportRepository, createExportBreaksHandler } from './logsRouter';

// ─── Repository Interfaces ────────────────────────────────────────────────────

export interface BreakFilters {
  status?: string;
  severity?: string;
  applicationId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export interface BreakRepository {
  findAll(filters: BreakFilters): Promise<{ data: Break[]; total: number }>;
  findById(id: string): Promise<Break | null>;
}

export interface LogRepository {
  findCorrelated(applicationId: string, from: Date, to: Date): Promise<LogRecord[]>;
}

// ─── Minimal request/response types (Express-compatible) ─────────────────────

export interface BreaksRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  ip?: string;
  query: Record<string, string | undefined>;
  params: Record<string, string>;
  session?: { userId: string; role: Role };
}

export interface BreaksResponse {
  statusCode: number;
  status(code: number): BreaksResponse;
  json(body: unknown): void;
}

export type NextFn = () => void;

export type BreaksHandler = (
  req: BreaksRequest,
  res: BreaksResponse,
  next: NextFn,
) => Promise<void>;

// ─── Handler Factories ────────────────────────────────────────────────────────

/**
 * GET /breaks — paginated, filterable list.
 * Requirements: 2.1, 4.3
 */
export function createListBreaksHandler(breakRepo: BreakRepository): BreaksHandler {
  return async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10) || 20));

    const filters: BreakFilters = {
      page,
      limit,
      status: req.query['status'],
      severity: req.query['severity'],
      applicationId: req.query['applicationId'],
      from: req.query['from'] ? new Date(req.query['from']) : undefined,
      to: req.query['to'] ? new Date(req.query['to']) : undefined,
    };

    const { data, total } = await breakRepo.findAll(filters);
    res.json({ data, total, page, limit });
  };
}

/**
 * GET /breaks/:id — detail with correlated logs.
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export function createGetBreakHandler(
  breakRepo: BreakRepository,
  logRepo: LogRepository,
): BreaksHandler {
  return async (req, res) => {
    const { id } = req.params;

    const breakRecord = await breakRepo.findById(id);

    if (!breakRecord) {
      res.status(404).json({ error: 'Not Found', message: 'Break not found.' });
      return;
    }

    // Correlated logs: same applicationId, timestamp within ±5 minutes (Requirement 4.2)
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const breakTime = new Date(breakRecord.timestamp).getTime();
    const from = new Date(breakTime - FIVE_MINUTES_MS);
    const to = new Date(breakTime + FIVE_MINUTES_MS);

    const correlatedLogs = await logRepo.findCorrelated(breakRecord.applicationId, from, to);

    res.json({ ...breakRecord, correlatedLogs });
  };
}

// ─── Router Factory (Express wiring) ─────────────────────────────────────────

/**
 * Creates an Express Router with RBAC applied to all breaks endpoints.
 * Lazily imports express so the module can be tested without express installed.
 */
export async function createBreaksRouter(
  breakRepo: BreakRepository,
  logRepo: LogRepository,
  sessionStore: SessionStore,
  auditLogRepo: AuditLogRepository,
  breakExportRepo?: BreakExportRepository,
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  const router = express.Router();
  const rbac = createRbacMiddleware(sessionStore, auditLogRepo) as any;

  router.use(rbac);
  if (breakExportRepo) {
    router.get('/export', createExportBreaksHandler(breakExportRepo) as any);
  }
  router.get('/', createListBreaksHandler(breakRepo) as any);
  router.get('/:id', createGetBreakHandler(breakRepo, logRepo) as any);

  return router;
}

/**
 * Synchronous version for use when express is already loaded.
 */
export function createBreaksRouterSync(
  breakRepo: BreakRepository,
  logRepo: LogRepository,
  sessionStore: SessionStore,
  auditLogRepo: AuditLogRepository,
  rbacMiddleware?: RbacMiddleware,
  breakExportRepo?: BreakExportRepository,
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  const router = express.Router();
  const rbac = rbacMiddleware ?? (createRbacMiddleware(sessionStore, auditLogRepo) as any);

  router.use(rbac);
  if (breakExportRepo) {
    router.get('/export', createExportBreaksHandler(breakExportRepo) as any);
  }
  router.get('/', createListBreaksHandler(breakRepo) as any);
  router.get('/:id', createGetBreakHandler(breakRepo, logRepo) as any);

  return router;
}
