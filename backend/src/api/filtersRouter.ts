/**
 * Saved Filters REST API Router
 * Requirements: 8.3, 8.4
 */

import type { SavedFilter, Role } from '@portal/shared';
import { createRbacMiddleware, AuditLogRepository, RbacMiddleware } from '../auth/rbac';
import { SessionStore } from '../auth/oauthHandler';

// ─── Repository Interface ─────────────────────────────────────────────────────

export interface SavedFilterRepository {
  create(filter: Omit<SavedFilter, 'id'>): Promise<SavedFilter>;
  findById(id: string): Promise<SavedFilter | null>;
  update(id: string, filter: Partial<Omit<SavedFilter, 'id'>>): Promise<SavedFilter | null>;
  delete(id: string): Promise<boolean>;
}

// ─── Minimal request/response types (Express-compatible) ─────────────────────

export interface FiltersRequest {
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

export interface FiltersResponse {
  statusCode: number;
  status(code: number): FiltersResponse;
  json(body: unknown): void;
  send(): void;
}

export type NextFn = () => void;

export type FiltersHandler = (
  req: FiltersRequest,
  res: FiltersResponse,
  next: NextFn,
) => Promise<void>;

// ─── Handler Factories ────────────────────────────────────────────────────────

/**
 * POST /filters — create a saved filter (Developer+ only).
 * Requirements: 8.3, 8.4
 */
export function createSavedFilterHandler(repo: SavedFilterRepository): FiltersHandler {
  return async (req, res) => {
    const body = req.body as Omit<SavedFilter, 'id'>;
    const created = await repo.create(body);
    res.status(201).json(created);
  };
}

/**
 * GET /filters/:id — get a saved filter by id (Viewer+).
 * Requirements: 8.3
 */
export function getFilterHandler(repo: SavedFilterRepository): FiltersHandler {
  return async (req, res) => {
    const { id } = req.params;
    const filter = await repo.findById(id);
    if (!filter) {
      res.status(404).json({ error: 'Not Found', message: 'Filter not found.' });
      return;
    }
    res.status(200).json(filter);
  };
}

/**
 * PUT /filters/:id — update a saved filter (Developer+ only).
 * Requirements: 8.3, 8.4
 */
export function updateFilterHandler(repo: SavedFilterRepository): FiltersHandler {
  return async (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<Omit<SavedFilter, 'id'>>;
    const updated = await repo.update(id, body);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'Filter not found.' });
      return;
    }
    res.status(200).json(updated);
  };
}

/**
 * DELETE /filters/:id — delete a saved filter (Developer+ only).
 * Requirements: 8.3, 8.4
 */
export function deleteFilterHandler(repo: SavedFilterRepository): FiltersHandler {
  return async (req, res) => {
    const { id } = req.params;
    const deleted = await repo.delete(id);
    if (!deleted) {
      res.status(404).json({ error: 'Not Found', message: 'Filter not found.' });
      return;
    }
    res.status(204).send();
  };
}

// ─── Router Factory ───────────────────────────────────────────────────────────

export function createFiltersRouterSync(
  filterRepo: SavedFilterRepository,
  sessionStore: SessionStore,
  auditLogRepo: AuditLogRepository,
  rbacMiddleware?: RbacMiddleware,
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  const router = express.Router();
  const rbac = rbacMiddleware ?? (createRbacMiddleware(sessionStore, auditLogRepo) as any);

  router.use(rbac);
  router.post('/', createSavedFilterHandler(filterRepo) as any);
  router.get('/:id', getFilterHandler(filterRepo) as any);
  router.put('/:id', updateFilterHandler(filterRepo) as any);
  router.delete('/:id', deleteFilterHandler(filterRepo) as any);

  return router;
}
