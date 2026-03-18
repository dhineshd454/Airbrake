import { Break } from '@portal/shared';
import { ParseResult, ParseErrorWriter, noopParseErrorWriter } from './logParser';

// ─── Validation Helpers ───────────────────────────────────────────────────────

const VALID_SEVERITIES = new Set(['info', 'warning', 'error', 'critical']);

function isValidSeverity(v: unknown): v is Break['severity'] {
  return typeof v === 'string' && VALID_SEVERITIES.has(v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNullableRecord(v: unknown): v is Record<string, unknown> | null {
  return v === null || v === undefined || isRecord(v);
}

// ─── parseBreak ───────────────────────────────────────────────────────────────

/**
 * Parses a raw Airbrake error payload into a normalized Break record.
 *
 * Returns { success: true, record } on success.
 * Returns { success: false, error, rawPayload } on malformed input and
 * writes the error to the parse_errors table via the provided writer.
 *
 * Never throws.
 */
export async function parseBreak(
  raw: unknown,
  errorWriter: ParseErrorWriter = noopParseErrorWriter,
): Promise<ParseResult<Break>> {
  try {
    if (!isRecord(raw)) {
      const msg = 'Payload must be a non-null object';
      await errorWriter.write(raw, msg);
      return { success: false, error: msg, rawPayload: raw };
    }

    const missing: string[] = [];

    if (typeof raw.id !== 'string' || raw.id.trim() === '') missing.push('id');
    if (typeof raw.applicationId !== 'string' || raw.applicationId.trim() === '') missing.push('applicationId');
    if (typeof raw.environment !== 'string' || raw.environment.trim() === '') missing.push('environment');
    if (!isValidSeverity(raw.severity)) missing.push('severity');
    if (typeof raw.errorMessage !== 'string') missing.push('errorMessage');
    if (typeof raw.stackTrace !== 'string') missing.push('stackTrace');
    if (typeof raw.fingerprint !== 'string' || raw.fingerprint.trim() === '') missing.push('fingerprint');
    if (raw.timestamp === undefined || raw.timestamp === null) missing.push('timestamp');

    const timestamp = raw.timestamp instanceof Date
      ? raw.timestamp
      : new Date(raw.timestamp as string | number);

    if (raw.timestamp !== undefined && raw.timestamp !== null && isNaN(timestamp.getTime())) {
      missing.push('timestamp (invalid date)');
    }

    if (missing.length > 0) {
      const msg = `Missing or invalid required fields: ${missing.join(', ')}`;
      await errorWriter.write(raw, msg);
      return { success: false, error: msg, rawPayload: raw };
    }

    // Optional fields — null if absent or wrong type
    const endpoint = typeof raw.endpoint === 'string' ? raw.endpoint : null;
    const requestPayload = isRecord(raw.requestPayload) ? raw.requestPayload : null;
    const userSession = isRecord(raw.userSession) ? raw.userSession : null;

    const record: Break = {
      id: (raw.id as string).trim(),
      applicationId: (raw.applicationId as string).trim(),
      environment: (raw.environment as string).trim(),
      severity: raw.severity as Break['severity'],
      errorMessage: raw.errorMessage as string,
      stackTrace: raw.stackTrace as string,
      endpoint,
      requestPayload,
      userSession,
      timestamp,
      fingerprint: (raw.fingerprint as string).trim(),
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

// ─── serializeBreak ───────────────────────────────────────────────────────────

/**
 * Serializes a normalized Break record to a JSON string.
 * The timestamp is serialized as an ISO 8601 string.
 */
export function serializeBreak(record: Break): string {
  return JSON.stringify({
    ...record,
    timestamp: record.timestamp.toISOString(),
  });
}
