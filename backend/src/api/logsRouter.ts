/**
 * Logs REST API Router
 * Requirements: 1.4, 1.5, 1.6, 8.1, 8.2, 8.5, 9.4
 */

import type { Break, LogRecord, Role } from '@portal/shared';
import { createRbacMiddleware, AuditLogRepository, RbacMiddleware } from '../auth/rbac';
import { SessionStore } from '../auth/oauthHandler';

// ─── Repository Interfaces ────────────────────────────────────────────────────

export interface LogSearchFilters {
  keyword?: string;
  tags?: string[];
  severity?: string;
  applicationId?: string;
  environment?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export interface BreakExportFilters {
  severity?: string;
  applicationId?: string;
  from?: Date;
  to?: Date;
}

export interface LogSearchRepository {
  search(filters: LogSearchFilters): Promise<{ data: LogRecord[]; total: number }>;
  searchAll(filters: Omit<LogSearchFilters, 'page' | 'limit'>): Promise<LogRecord[]>;
}

export interface BreakExportRepository {
  exportAll(filters: BreakExportFilters): Promise<Break[]>;
}

// ─── Minimal request/response types (Express-compatible) ─────────────────────

export interface LogsRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  ip?: string;
  query: Record<string, string | undefined>;
  params: Record<string, string>;
  session?: { userId: string; role: Role };
}

export interface LogsResponse {
  statusCode: number;
  status(code: number): LogsResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  send(body: string): void;
}

export type NextFn = () => void;

export type LogsHandler = (
  req: LogsRequest,
  res: LogsResponse,
  next: NextFn,
) => Promise<void>;

// ─── CSV Helper ───────────────────────────────────────────────────────────────

/**
 * Minimal CSV serializer.
 * Produces a header row followed by one row per record.
 */
export function toCsv(records: object[], fields: string[]): string {
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    // Wrap in quotes if the value contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = fields.join(',');
  const rows = records.map((rec) =>
    fields.map((f) => escape((rec as Record<string, unknown>)[f])).join(','),
  );
  return [header, ...rows].join('\n');
}

// ─── Handler Factories ────────────────────────────────────────────────────────

const LOG_CSV_FIELDS = [
  'id', 'applicationId', 'environment', 'severity', 'message', 'timestamp', 'tags',
];

const BREAK_CSV_FIELDS = [
  'id', 'applicationId', 'environment', 'severity', 'errorMessage', 'stackTrace',
  'endpoint', 'timestamp', 'fingerprint',
];

/**
 * GET /logs — paginated, filterable log search.
 * Requirements: 1.4, 1.5, 8.1, 8.2
 */
export function createSearchLogsHandler(logRepo: LogSearchRepository): LogsHandler {
  return async (req, res) => {
    const page = Math.max(1, Number.parseInt(String(req.query['page'] ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query['limit'] ?? '20'), 10) || 20));

    const tagsRaw = req.query['tags'];
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined;

    const filters: LogSearchFilters = {
      page,
      limit,
      keyword: req.query['keyword'],
      tags,
      severity: req.query['severity'],
      applicationId: req.query['applicationId'],
      environment: req.query['environment'],
      from: req.query['from'] ? new Date(req.query['from']) : undefined,
      to: req.query['to'] ? new Date(req.query['to']) : undefined,
    };

    const { data, total } = await logRepo.search(filters);
    res.json({ data, total, page, limit });
  };
}

/**
 * GET /logs/export — export all matching logs as CSV or JSON.
 * Requirements: 8.5, 9.4
 */
export function createExportLogsHandler(logRepo: LogSearchRepository): LogsHandler {
  return async (req, res) => {
    const format = req.query['format'] ?? 'json';

    const tagsRaw = req.query['tags'];
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined;

    const filters: Omit<LogSearchFilters, 'page' | 'limit'> = {
      keyword: req.query['keyword'],
      tags,
      severity: req.query['severity'],
      applicationId: req.query['applicationId'],
      environment: req.query['environment'],
      from: req.query['from'] ? new Date(req.query['from']) : undefined,
      to: req.query['to'] ? new Date(req.query['to']) : undefined,
    };

    const records = await logRepo.searchAll(filters);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="logs.csv"');
      res.send(toCsv(records, LOG_CSV_FIELDS));
    } else {
      res.json(records);
    }
  };
}

/**
 * GET /breaks/export — export all matching breaks as CSV or JSON.
 * Requirements: 8.5, 9.4
 */
export function createExportBreaksHandler(breakExportRepo: BreakExportRepository): LogsHandler {
  return async (req, res) => {
    const format = req.query['format'] ?? 'json';

    const filters: BreakExportFilters = {
      severity: req.query['severity'],
      applicationId: req.query['applicationId'],
      from: req.query['from'] ? new Date(req.query['from']) : undefined,
      to: req.query['to'] ? new Date(req.query['to']) : undefined,
    };

    const records = await breakExportRepo.exportAll(filters);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="breaks.csv"');
      res.send(toCsv(records, BREAK_CSV_FIELDS));
    } else {
      res.json(records);
    }
  };
}

// ─── Router Factory (Express wiring) ─────────────────────────────────────────

/**
 * Creates an Express Router for /logs endpoints with RBAC applied.
 */
export async function createLogsRouter(
  logRepo: LogSearchRepository,
  breakExportRepo: BreakExportRepository,
  sessionStore: SessionStore,
  auditLogRepo: AuditLogRepository,
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  const router = express.Router();
  const rbac = createRbacMiddleware(sessionStore, auditLogRepo) as any;

  router.use(rbac);
  router.get('/export', createExportLogsHandler(logRepo) as any);
  router.get('/', createSearchLogsHandler(logRepo) as any);

  return router;
}

/**
 * Synchronous version for use when express is already loaded.
 */
export function createLogsRouterSync(
  logRepo: LogSearchRepository,
  breakExportRepo: BreakExportRepository,
  sessionStore: SessionStore,
  auditLogRepo: AuditLogRepository,
  rbacMiddleware?: RbacMiddleware,
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  const router = express.Router();
  const rbac = rbacMiddleware ?? (createRbacMiddleware(sessionStore, auditLogRepo) as any);

  router.use(rbac);
  router.get('/export', createExportLogsHandler(logRepo) as any);
  router.get('/', createSearchLogsHandler(logRepo) as any);

  return router;
}
