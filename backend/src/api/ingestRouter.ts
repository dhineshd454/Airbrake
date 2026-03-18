/**
 * Ingest API — POST endpoints for reporting logs and errors (breaks) into the system.
 *
 * POST /api/ingest/logs   — report a single log entry
 * POST /api/ingest/errors — report an error/break
 *
 * Both endpoints are unauthenticated (API-key protected) so external services
 * can push data without an OAuth session.
 */

import { randomUUID } from 'node:crypto';
import { parseLogRecord } from '../parsers/logParser';
import { parseBreak } from '../parsers/breakParser';
import { computeFingerprint } from '../aggregator/fingerprint';
import type { LogPipeline } from '../pipeline/logPipeline';
import type { ErrorAggregator } from '../aggregator/errorAggregator';
import type { ParseErrorWriter } from '../parsers/logParser';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IngestRequest {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

export interface IngestResponse {
  statusCode: number;
  status(code: number): IngestResponse;
  json(body: unknown): void;
}

export type IngestHandler = (req: IngestRequest, res: IngestResponse) => Promise<void>;

// ─── API-key guard ────────────────────────────────────────────────────────────

/**
 * Validates the X-API-Key header against the configured secret.
 * Returns true if the key is valid or if no key is configured (dev mode).
 */
function isAuthorized(req: IngestRequest, apiKey: string | undefined): boolean {
  if (!apiKey) return true; // no key configured → open in dev
  const provided = req.headers['x-api-key'];
  return provided === apiKey;
}

// ─── Handler factories ────────────────────────────────────────────────────────

/**
 * POST /api/ingest/logs
 *
 * Body (JSON):
 * {
 *   "applicationId": "my-service",       // required
 *   "environment":   "production",        // required: production | qa | development
 *   "severity":      "error",             // required: info | warning | error | critical
 *   "message":       "Something failed",  // required
 *   "timestamp":     "2026-03-18T...",    // optional — defaults to now
 *   "tags":          ["db", "timeout"],   // optional
 *   "id":            "uuid",              // optional — auto-generated if omitted
 * }
 *
 * Response 202: { "id": "<uuid>", "status": "accepted" }
 * Response 400: { "error": "Bad Request", "message": "..." }
 */
export function createIngestLogHandler(
  pipeline: LogPipeline,
  parseErrorWriter: ParseErrorWriter,
  apiKey?: string,
): IngestHandler {
  return async (req, res) => {
    if (!isAuthorized(req, apiKey)) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing X-API-Key header.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const id = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : randomUUID();
    const timestamp = body?.timestamp ?? new Date().toISOString();

    const raw = { ...body, id, timestamp };

    const result = await parseLogRecord(raw, parseErrorWriter);

    if (!result.success) {
      res.status(400).json({ error: 'Bad Request', message: result.error });
      return;
    }

    await pipeline.ingest(raw);

    res.status(202).json({ id, status: 'accepted' });
  };
}

/**
 * POST /api/ingest/errors
 *
 * Body (JSON):
 * {
 *   "applicationId":  "my-service",           // required
 *   "environment":    "production",            // required
 *   "severity":       "error",                 // required: info | warning | error | critical
 *   "errorMessage":   "TypeError: ...",        // required
 *   "stackTrace":     "at foo (bar.ts:12)",    // required
 *   "endpoint":       "/api/users",            // optional
 *   "requestPayload": { ... },                 // optional
 *   "userSession":    { "userId": "..." },     // optional
 *   "timestamp":      "2026-03-18T...",        // optional — defaults to now
 *   "id":             "uuid",                  // optional — auto-generated if omitted
 * }
 *
 * Response 202: { "id": "<uuid>", "groupId": "<uuid>", "status": "new|existing|regression" }
 * Response 400: { "error": "Bad Request", "message": "..." }
 */
export function createIngestErrorHandler(
  aggregator: ErrorAggregator,
  parseErrorWriter: ParseErrorWriter,
  apiKey?: string,
): IngestHandler {
  return async (req, res) => {
    if (!isAuthorized(req, apiKey)) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing X-API-Key header.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const id = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : randomUUID();
    const timestamp = body?.timestamp ?? new Date().toISOString();

    // Compute fingerprint server-side so callers don't need to supply it
    const appId = typeof body?.applicationId === 'string' ? body.applicationId : '';
    const errMsg = typeof body?.errorMessage === 'string' ? body.errorMessage : '';
    const stack = typeof body?.stackTrace === 'string' ? body.stackTrace : '';
    const fingerprint = computeFingerprint({ applicationId: appId, errorMessage: errMsg, stackTrace: stack });

    const raw = { ...body, id, timestamp, fingerprint };

    const result = await parseBreak(raw, parseErrorWriter);

    if (!result.success) {
      res.status(400).json({ error: 'Bad Request', message: result.error });
      return;
    }

    const { group, status } = await aggregator.aggregate(result.record);

    res.status(202).json({ id, groupId: group.id, status });
  };
}

// ─── Router factory ───────────────────────────────────────────────────────────

export function createIngestRouter(
  pipeline: LogPipeline,
  aggregator: ErrorAggregator,
  parseErrorWriter: ParseErrorWriter,
  apiKey?: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  const router = express.Router();

  router.post('/logs', createIngestLogHandler(pipeline, parseErrorWriter, apiKey) as any);
  router.post('/errors', createIngestErrorHandler(aggregator, parseErrorWriter, apiKey) as any);

  return router;
}
