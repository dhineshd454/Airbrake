// Shared TypeScript interfaces for the Live Airbrake Monitoring Portal

// ─── Log Record ──────────────────────────────────────────────────────────────

export interface LogRecord {
  id: string;
  applicationId: string;
  environment: 'production' | 'qa' | 'development';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  tags: string[];
  rawPayload: Record<string, unknown>;
}

// ─── Break ────────────────────────────────────────────────────────────────────

export interface Break {
  id: string;
  applicationId: string;
  environment: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  errorMessage: string;
  stackTrace: string;
  endpoint: string | null;
  requestPayload: Record<string, unknown> | null;
  userSession: Record<string, unknown> | null;
  timestamp: Date;
  fingerprint: string;
}

// ─── Break Group ──────────────────────────────────────────────────────────────

export interface BreakGroup {
  id: string;
  fingerprint: string;
  applicationId: string;
  firstOccurrence: Date;
  lastOccurrence: Date;
  occurrenceCount: number;
  status: 'open' | 'resolved' | 'regression';
  severity: 'info' | 'warning' | 'error' | 'critical';
  errorMessage: string;
}

// ─── User & RBAC ──────────────────────────────────────────────────────────────

export type Role = 'admin' | 'developer' | 'viewer';

export interface User {
  id: string;
  email: string;
  role: Role;
  oauthProvider: string;
  oauthSubject: string;
  createdAt: Date;
}

// ─── Notification Channels ────────────────────────────────────────────────────

export type NotificationChannel =
  | { type: 'email'; address: string }
  | { type: 'slack'; webhookUrl: string }
  | { type: 'teams'; webhookUrl: string }
  | { type: 'webhook'; url: string };

// ─── Alert Rule ───────────────────────────────────────────────────────────────

export interface AlertRule {
  id: string;
  name: string;
  threshold: number;
  windowSeconds: number;
  triggerOnNewError: boolean;
  channels: NotificationChannel[];
  createdBy: string;
  enabled: boolean;
}

// ─── Saved Filter ─────────────────────────────────────────────────────────────

export interface SavedFilter {
  id: string;
  userId: string;
  name: string;
  criteria: {
    keyword?: string;
    tags?: string[];
    severity?: string[];
    applications?: string[];
    timeRange?: { from: Date; to: Date };
    errorCode?: string;
  };
}

// ─── Retention Policy ─────────────────────────────────────────────────────────

export interface RetentionPolicy {
  applicationId: string;
  retentionDays: 30 | 60 | 90;
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

export type BreakStatus = 'new' | 'existing' | 'regression';

export interface AggregationResult {
  group: BreakGroup;
  status: BreakStatus;
}

// ─── Alert Event ──────────────────────────────────────────────────────────────

export interface AlertEvent {
  ruleId: string;
  triggeredAt: Date;
  breakCount?: number;
  newBreak?: Break;
}

// ─── Parse Error ──────────────────────────────────────────────────────────────

export interface ParseError {
  id: string;
  rawPayload: unknown;
  errorMessage: string;
  occurredAt: Date;
}

// ─── Airbrake Client Config ───────────────────────────────────────────────────

export interface AirbrakeClientConfig {
  apiKey: string;       // encrypted at rest, never exposed
  projectId: string;
  pollIntervalMs: number;
}
