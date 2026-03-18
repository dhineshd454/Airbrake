import { LogRecord } from '@portal/shared';

// ─── Result Types ─────────────────────────────────────────────────────────────

export type ParseResult<T> =
  | { success: true; record: T }
  | { success: false; error: string; rawPayload: unknown };

// ─── Parse Error Writer (stub — wired to DB in Task 6) ────────────────────────

export interface ParseErrorWriter {
  write(rawPayload: unknown, errorMessage: string): Promise<void>;
}

/** No-op stub used until the real DB connection is wired in Task 6. */
export const noopParseErrorWriter: ParseErrorWriter = {
  write: async (_rawPayload, _errorMessage) => {
    // intentionally empty — replaced by real writer in Task 6
  },
};

// ─── Validation Helpers ───────────────────────────────────────────────────────

const VALID_ENVIRONMENTS = new Set(['production', 'qa', 'development']);
const VALID_SEVERITIES = new Set(['info', 'warning', 'error', 'critical']);

function isValidEnvironment(v: unknown): v is LogRecord['environment'] {
  return typeof v === 'string' && VALID_ENVIRONMENTS.has(v);
}

function isValidSeverity(v: unknown): v is LogRecord['severity'] {
  return typeof v === 'string' && VALID_SEVERITIES.has(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === 'string');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ─── parseLogRecord ───────────────────────────────────────────────────────────

/**
 * Parses a raw Airbrake/pipeline payload into a normalized LogRecord.
 *
 * Returns { success: true, record } on success.
 * Returns { success: false, error, rawPayload } on malformed input and
 * writes the error to the parse_errors table via the provided writer.
 *
 * Never throws.
 */
export async function parseLogRecord(
  raw: unknown,
  errorWriter: ParseErrorWriter = noopParseErrorWriter,
): Promise<ParseResult<LogRecord>> {
  try {
    if (!isRecord(raw)) {
      const msg = 'Payload must be a non-null object';
      await errorWriter.write(raw, msg);
      return { success: false, error: msg, rawPayload: raw };
    }

    const missing: string[] = [];

    if (typeof raw.id !== 'string' || raw.id.trim() === '') missing.push('id');
    if (typeof raw.applicationId !== 'string' || raw.applicationId.trim() === '') missing.push('applicationId');
    if (!isValidEnvironment(raw.environment)) missing.push('environment');
    if (!isValidSeverity(raw.severity)) missing.push('severity');
    if (typeof raw.message !== 'string') missing.push('message');
    if (raw.timestamp === undefined || raw.timestamp === null) missing.push('timestamp');

    const timestamp = raw.timestamp instanceof Date
      ? raw.timestamp
      : new Date(raw.timestamp as string | number);

    if (isNaN(timestamp.getTime())) missing.push('timestamp (invalid date)');

    if (missing.length > 0) {
      const msg = `Missing or invalid required fields: ${missing.join(', ')}`;
      await errorWriter.write(raw, msg);
      return { success: false, error: msg, rawPayload: raw };
    }

    const tags = isStringArray(raw.tags) ? raw.tags : [];
    const rawPayload = isRecord(raw.rawPayload) ? raw.rawPayload : (raw as Record<string, unknown>);

    const record: LogRecord = {
      id: (raw.id as string).trim(),
      applicationId: (raw.applicationId as string).trim(),
      environment: raw.environment as LogRecord['environment'],
      severity: raw.severity as LogRecord['severity'],
      message: raw.message as string,
      timestamp,
      tags,
      rawPayload,
    };

    return { success: true, record };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      await errorWriter.write(raw, msg);
    } catch {
      // swallow writer errors — pipeline must not crash
    }
    return { success: false, error: msg, rawPayload: raw };
  }
}

// ─── serializeLogRecord ───────────────────────────────────────────────────────

/**
 * Serializes a normalized LogRecord to a JSON string.
 * The timestamp is serialized as an ISO 8601 string.
 */
export function serializeLogRecord(record: LogRecord): string {
  return JSON.stringify({
    ...record,
    timestamp: record.timestamp.toISOString(),
  });
}
