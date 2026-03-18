/**
 * Admin REST API Router — User Management & Retention Policies
 * Requirements: 6.1, 6.5, 9.1
 */

import type { User, RetentionPolicy, Role } from '@portal/shared';
import { createRbacMiddleware, AuditLogRepository, RbacMiddleware } from '../auth/rbac';
import { SessionStore } from '../auth/oauthHandler';

// ─── Repository Interfaces ────────────────────────────────────────────────────

export interface UserRepository {
  findAll(): Promise<User[]>;
  create(user: Omit<User, 'id' | 'createdAt'>): Promise<User>;
  update(id: string, user: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null>;
  delete(id: string): Promise<boolean>;
}

export interface RetentionPolicyRepository {
  findAll(): Promise<RetentionPolicy[]>;
  upsert(policy: RetentionPolicy): Promise<RetentionPolicy>;
}

// ─── Minimal request/response types (Express-compatible) ─────────────────────

export interface AdminRequest {
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

export interface AdminResponse {
  statusCode: number;
  status(code: number): AdminResponse;
  json(body: unknown): void;
  send(): void;
}

export type NextFn = () => void;

export type AdminHandler = (
  req: AdminRequest,
  res: AdminResponse,
  next: NextFn,
) => Promise<void>;

// ─── User Handler Factories ───────────────────────────────────────────────────

/**
 * GET /users — list all users (Admin only).
 * Requirements: 6.1
 */
export function listUsersHandler(repo: UserRepository): AdminHandler {
  return async (_req, res) => {
    const users = await repo.findAll();
    res.status(200).json(users);
  };
}

/**
 * POST /users — create a user (Admin only).
 * Requirements: 6.1
 */
export function createUserHandler(repo: UserRepository): AdminHandler {
  return async (req, res) => {
    const body = req.body as Omit<User, 'id' | 'createdAt'>;
    const created = await repo.create(body);
    res.status(201).json(created);
  };
}

/**
 * PUT /users/:id — update a user (Admin only).
 * Requirements: 6.1
 */
export function updateUserHandler(repo: UserRepository): AdminHandler {
  return async (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<Omit<User, 'id' | 'createdAt'>>;
    const updated = await repo.update(id, body);
    if (!updated) {
      res.status(404).json({ error: 'Not Found', message: 'User not found.' });
      return;
    }
    res.status(200).json(updated);
  };
}

/**
 * DELETE /users/:id — delete a user (Admin only).
 * Requirements: 6.1
 */
export function deleteUserHandler(repo: UserRepository): AdminHandler {
  return async (req, res) => {
    const { id } = req.params;
    const deleted = await repo.delete(id);
    if (!deleted) {
      res.status(404).json({ error: 'Not Found', message: 'User not found.' });
      return;
    }
    res.status(204).send();
  };
}

// ─── Retention Policy Handler Factories ──────────────────────────────────────

/**
 * GET /retention — list retention policies (Admin only).
 * Requirements: 9.1
 */
export function listRetentionPoliciesHandler(repo: RetentionPolicyRepository): AdminHandler {
  return async (_req, res) => {
    const policies = await repo.findAll();
    res.status(200).json(policies);
  };
}

/**
 * PUT /retention — upsert a retention policy (Admin only).
 * Requirements: 9.1
 */
export function upsertRetentionPolicyHandler(repo: RetentionPolicyRepository): AdminHandler {
  return async (req, res) => {
    const body = req.body as RetentionPolicy;
    const policy = await repo.upsert(body);
    res.status(200).json(policy);
  };
}

// ─── Router Factory ───────────────────────────────────────────────────────────

export function createAdminRouterSync(
  userRepo: UserRepository,
  retentionRepo: RetentionPolicyRepository,
  sessionStore: SessionStore,
  auditLogRepo: AuditLogRepository,
  rbacMiddleware?: RbacMiddleware,
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  const router = express.Router();
  const rbac = rbacMiddleware ?? (createRbacMiddleware(sessionStore, auditLogRepo) as any);

  router.use(rbac);

  // User endpoints
  router.get('/users', listUsersHandler(userRepo) as any);
  router.post('/users', createUserHandler(userRepo) as any);
  router.put('/users/:id', updateUserHandler(userRepo) as any);
  router.delete('/users/:id', deleteUserHandler(userRepo) as any);

  // Retention policy endpoints
  router.get('/retention', listRetentionPoliciesHandler(retentionRepo) as any);
  router.put('/retention', upsertRetentionPolicyHandler(retentionRepo) as any);

  return router;
}
