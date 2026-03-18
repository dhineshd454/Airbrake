/**
 * Backend entry point — wires all services together with Express REST API.
 * Requirements: 1.1, 2.6, 5.1, 9.2
 */

import { AirbrakeClient } from './airbrake/airbrakeClient';
import { AlertEngine } from './alerts/alertEngine';
import { createLogPipeline } from './pipeline/logPipeline';
import { PurgeJob } from './retention/purgeJob';
import { WebSocketServer } from './websocket/wsServer';

// ─── Stub adapters ────────────────────────────────────────────────────────────

const redisPublisher = {
  publish: async (channel: string, message: string) => {
    console.log(`[Redis] publish ${channel}: ${message.slice(0, 80)}…`);
  },
};

const redisPubSub = {
  subscribe: (channel: string, _handler: (msg: string) => void) => {
    console.log(`[Redis] subscribed to ${channel}`);
  },
  unsubscribe: (channel: string) => {
    console.log(`[Redis] unsubscribed from ${channel}`);
  },
};

const replayStore = {
  store: async (_channel: string, _message: string, _ts: Date) => {},
  getRecent: async (_channel: string, _since: Date): Promise<string[]> => [],
};

const logRecordRepository = {
  save: async (record: unknown) => {
    console.log('[PG] save log record', (record as { id: string }).id);
  },
};

const logSearchIndexer = {
  indexLogRecord: async (record: unknown) => {
    console.log('[ES] index log record', (record as { id: string }).id);
  },
};

const parseErrorRepository = {
  save: async (_rawPayload: unknown, errorMessage: string) => {
    console.error('[PG] parse error:', errorMessage);
  },
};

const breakCountRepository = {
  countBreaksInWindow: async (_windowSeconds: number): Promise<number> => 0,
};

const notificationDispatcher = {
  send: async (channel: unknown, event: unknown) => {
    console.log('[Alert] dispatch', channel, event);
  },
};

const alertNotificationRepository = {
  markFailed: async (ruleId: string, event: unknown) => {
    console.error('[Alert] notification failed for rule', ruleId, event);
  },
};

const purgeRepository = {
  deleteLogsBefore: async (_cutoff: Date): Promise<number> => 0,
  deleteBreaksBefore: async (_cutoff: Date): Promise<number> => 0,
};

const retentionPolicyReader = {
  findAll: async () => [],
};

const httpClient = {
  get: async (_url: string, _headers: Record<string, string>): Promise<unknown> => ({ groups: [] }),
};

// ─── Service instantiation ────────────────────────────────────────────────────

const logPipeline = createLogPipeline(
  logRecordRepository,
  logSearchIndexer,
  redisPublisher,
  parseErrorRepository,
);

const airbrakeClient = new AirbrakeClient(
  {
    apiKey: process.env.AIRBRAKE_API_KEY ?? 'placeholder',
    projectId: process.env.AIRBRAKE_PROJECT_ID ?? 'placeholder',
    pollIntervalMs: parseInt(process.env.AIRBRAKE_POLL_INTERVAL ?? '30000', 10),
  },
  httpClient,
  redisPublisher,
);

const alertEngine = new AlertEngine(
  breakCountRepository,
  notificationDispatcher,
  alertNotificationRepository,
);

const purgeJob = new PurgeJob(purgeRepository, retentionPolicyReader);
const wsServer = new WebSocketServer(redisPubSub, replayStore);

// ─── Express app ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');
const app = express();
app.use(express.json());

// CORS for local dev
app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
  (res as any).setHeader('Access-Control-Allow-Origin', '*');
  (res as any).setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Health check
app.get('/api/health', (_req: unknown, res: any) => res.json({ status: 'ok' }));

// Dashboard aggregation — returns mock data until real DB is wired
app.get('/api/dashboard', (_req: unknown, res: any) => {
  const now = Date.now();
  res.json({
    breakCounts: { last24h: 42, last7d: 318 },
    errorRateTrend: Array.from({ length: 6 }, (_, i) => ({
      timestamp: new Date(now - (5 - i) * 3600_000).toISOString(),
      count: Math.floor(Math.random() * 20) + 1,
    })),
    topServices: [
      { service: 'api-gateway', count: 87 },
      { service: 'auth-service', count: 54 },
      { service: 'payment-service', count: 31 },
      { service: 'notification-service', count: 18 },
    ],
    timeSeries: Array.from({ length: 12 }, (_, i) => ({
      timestamp: new Date(now - (11 - i) * 3600_000).toISOString(),
      count: Math.floor(Math.random() * 15) + 1,
    })),
    severityBreakdown: [
      { severity: 'critical', count: 7 },
      { severity: 'error', count: 35 },
      { severity: 'warning', count: 89 },
      { severity: 'info', count: 187 },
    ],
    deploymentEvents: [
      { timestamp: new Date(now - 4 * 3600_000).toISOString(), version: 'v2.4.1', service: 'api-gateway' },
    ],
    airbrakeUnreachable: false,
  });
});

// Breaks list
app.get('/api/breaks', (_req: unknown, res: any) => {
  res.json({
    data: [
      { id: 'b1', applicationId: 'api-gateway', environment: 'production', severity: 'critical', errorMessage: 'NullPointerException in UserController', stackTrace: 'at UserController.getUser (UserController.ts:42)', endpoint: '/api/users/123', requestPayload: null, userSession: null, timestamp: new Date().toISOString(), fingerprint: 'fp1', status: 'new', firstOccurrence: new Date(Date.now() - 3600_000).toISOString(), lastOccurrence: new Date().toISOString(), occurrenceCount: 12, correlatedLogs: [] },
      { id: 'b2', applicationId: 'auth-service', environment: 'production', severity: 'error', errorMessage: 'JWT verification failed: token expired', stackTrace: 'at AuthMiddleware.verify (auth.ts:88)', endpoint: '/api/auth/verify', requestPayload: { token: '[redacted]' }, userSession: null, timestamp: new Date(Date.now() - 1800_000).toISOString(), fingerprint: 'fp2', status: 'regression', firstOccurrence: new Date(Date.now() - 86400_000).toISOString(), lastOccurrence: new Date().toISOString(), occurrenceCount: 5, correlatedLogs: [] },
      { id: 'b3', applicationId: 'payment-service', environment: 'production', severity: 'error', errorMessage: 'Stripe API timeout after 30s', stackTrace: 'at PaymentService.charge (payment.ts:156)', endpoint: '/api/payments/charge', requestPayload: null, userSession: null, timestamp: new Date(Date.now() - 7200_000).toISOString(), fingerprint: 'fp3', status: 'existing', firstOccurrence: new Date(Date.now() - 172800_000).toISOString(), lastOccurrence: new Date().toISOString(), occurrenceCount: 3, correlatedLogs: [] },
    ],
    total: 3,
    page: 1,
    limit: 20,
  });
});

// Break detail
app.get('/api/breaks/:id', (req: any, res: any) => {
  const breaks: Record<string, unknown> = {
    b1: { id: 'b1', applicationId: 'api-gateway', environment: 'production', severity: 'critical', errorMessage: 'NullPointerException in UserController', stackTrace: 'at UserController.getUser (UserController.ts:42)\nat Router.handle (router.ts:12)\nat Server.emit (server.ts:88)', endpoint: '/api/users/123', requestPayload: null, userSession: null, timestamp: new Date().toISOString(), fingerprint: 'fp1', status: 'new', firstOccurrence: new Date(Date.now() - 3600_000).toISOString(), lastOccurrence: new Date().toISOString(), occurrenceCount: 12, correlatedLogs: [] },
  };
  const b = breaks[req.params.id];
  if (!b) return res.status(404).json({ error: 'Not Found' });
  res.json(b);
});

// Alerts
app.get('/api/alerts', (_req: unknown, res: any) => res.json([]));

// Users
app.get('/api/users', (_req: unknown, res: any) => res.json([]));

// Retention
app.get('/api/retention', (_req: unknown, res: any) => res.json({ applicationId: 'default', retentionDays: 30 }));

// Logs
app.get('/api/logs', (_req: unknown, res: any) => res.json({ data: [], total: 0 }));

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const server = app.listen(PORT, () => {
  console.log(`[Server] listening on port ${PORT}`);
  airbrakeClient.start();
  purgeJob.schedule(24 * 60 * 60 * 1000);
  setInterval(() => {
    alertEngine.evaluate([]).catch((err: unknown) => console.error('[AlertEngine] error:', err));
  }, 60_000);
  console.log('[Services] started');
});

export { airbrakeClient, alertEngine, logPipeline, purgeJob, server, wsServer };
