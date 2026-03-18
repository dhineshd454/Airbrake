/**
 * Alert Rules REST API Router
 * Requirements: 5.5
 */

import type { AlertRule, Role } from '@portal/shared';
import { createRbacMiddleware, AuditLogRepository, RbacMiddleware } from '../auth/rbac';
import { SessionStore } from '../auth/oauthHandler';

// ─── Repository Interface ─────────────────────────────────────────────────────

export interface AlertRuleRepository {
  create(rule: Omit<AlertRule, 'id'>): Promise<AlertRule>;
  findAll(): Promise<AlertRule[]>;
  findById(id: string): Promise<AlertRule | null>;
  update(id: string, rule: Partial<Omit<AlertRule, 'id'>>): Promise<AlertRule | null>;
  delete(id: string): Promise<boolean>;
}

// ─── Minimal request/response types (Express-compatible) ─────────────────────

export interface AlertsRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  ip?: string;
  query: Record<string, string | undefined>;
  params: Record<string, string>;
  body?: unknown;
  session?: { userId: string; role: Role };
}

export interface AlertsResponse {
  statusCode: number;
  status(code: number): AlertsResponse;
  json(body: unknown): void;
  send(): void;
}

export type NextFn = () => void;

export type AlertsHandler = (
  req: AlertsRequest,
  res: AlertsResponse,
  next: NextFn,
) => Promise<void>;

// ─── Handler Factories ────────────────────────────────────────────────────────

/**
 * POST /alerts — create an alert rule (Admin/Developer only).
 * Requirements: 5.5
 */
export function createAlertRuleHandler(repo: AlertRuleRepository): AlertsHandler {
  return async (req, res) => {
    const body = req.body as Omit<AlertRule, 'id'>;
    const created = await repo.create(body);
    res.status(201).json(created);
  };
}

/**
 * GET /alerts — list all alert rules (Viewer+).
 * Requirements: 5.5
 */
export function listAlertRulesHandler(repo: AlertRuleRepository): AlertsHandler {
  return async (_req, res) => {
    const rules = await repo.findAll();
    res.status(200).json(rules);
  };
}

/**
 * PUT /alerts/:id — update an alert rule (Admin/Developer only).
 * Requirements: 5.5
 */
export function updateAlertRuleHandler(repo: AlertRuleRepository): AlertsHandler {
  return async (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<Omit<AlertRule, 'id'>>;
    const updated = await repo.update(id, body);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Alert rule not found.' });
      return;
    }
    res.status(200).json(updated);
  };
}

/**
 * DELETE /alerts/:id — delete an alert rule (Admin/Developer only).
 * Requirements: 5.5
 */
export function deleteAlertRuleHandler(repo: AlertRuleRepository): AlertsHandler {
  return async (req, res) => {
    const { id } = req.params;
    const deleted = await repo.delete(id);
    if (!deleted) {
      res.status(404).json({ error: 'Not Found', message: 'Alert rule not found.' });
      return;
    }
    res.status(204).send();
  };
}

// ─── Router Factory ───────────────────────────────────────────────────────────

export function createAlertsRouterSync(
  alertRepo: AlertRuleRepository,
  sessionStore: SessionStore,
  auditLogRepo: AuditLogRepository,
  rbacMiddleware?: RbacMiddleware,
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  const router = express.Router();
  const rbac = rbacMiddleware ?? (createRbacMiddleware(sessionStore, auditLogRepo) as any);

  router.use(rbac);
  router.post('/', createAlertRuleHandler(alertRepo) as any);
  router.get('/', listAlertRulesHandler(alertRepo) as any);
  router.put('/:id', updateAlertRuleHandler(alertRepo) as any);
  router.delete('/:id', deleteAlertRuleHandler(alertRepo) as any);

  return router;
}
