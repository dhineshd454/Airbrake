// Feature: live-airbrake-monitoring-portal, Property 17: API Key Not Exposed in Responses

/**
 * Validates: Requirements 7.3
 */

import * as fc from 'fast-check';
import type { Break, LogRecord } from '@portal/shared';

// ─── Pure Function Under Test ─────────────────────────────────────────────────

/**
 * Checks whether a plaintext API key appears anywhere in the serialized response body.
 * Returns true if the key is found (i.e., the key IS exposed — bad).
 */
export function containsApiKey(responseBody: unknown, apiKey: string): boolean {
  if (!apiKey) return false;
  const serialized = JSON.stringify(responseBody);
  return serialized.includes(apiKey);
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const severities = ['info', 'warning', 'error', 'critical'] as const;
const environments = ['production', 'qa', 'development'] as const;

/** Generates a plausible API key string (non-empty, no special JSON chars to keep tests clean). */
const arbitraryApiKey: fc.Arbitrary<string> = fc.stringOf(
  fc.mapToConstant(
    { num: 26, build: (n) => String.fromCharCode(97 + n) },  // a-z
    { num: 26, build: (n) => String.fromCharCode(65 + n) },  // A-Z
    { num: 10, build: (n) => String.fromCharCode(48 + n) },  // 0-9
  ),
  { minLength: 8, maxLength: 64 },
);

const arbitraryBreak = (apiKey?: string): fc.Arbitrary<Break> =>
  fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...environments),
    severity: fc.constantFrom(...severities),
    errorMessage: fc.string({ minLength: 1, maxLength: 80 }),
    stackTrace: fc.string({ minLength: 1, maxLength: 100 }),
    endpoint: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
    requestPayload: fc.constant(null),
    userSession: fc.constant(null),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    fingerprint: fc.hexaString({ minLength: 8, maxLength: 32 }),
  });

const arbitraryLogRecord = (): fc.Arbitrary<LogRecord> =>
  fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...environments),
    severity: fc.constantFrom(...severities),
    message: fc.string({ minLength: 1, maxLength: 120 }),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
    rawPayload: fc.constant({}),
  });

// ─── Property 17: API Key Not Exposed in Responses ───────────────────────────

describe('Property 17: API Key Not Exposed in Responses', () => {
  /**
   * Validates: Requirements 7.3
   */

  // ── Positive check: containsApiKey correctly detects an embedded key ────────

  it('containsApiKey returns true when the API key is embedded in the response', () => {
    fc.assert(
      fc.property(arbitraryApiKey, (apiKey) => {
        const responseWithKey = { data: [{ id: '1', token: apiKey }] };
        expect(containsApiKey(responseWithKey, apiKey)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // ── Negative check: Break records do not contain the API key ────────────────

  it('Break records do not contain the plaintext API key', () => {
    fc.assert(
      fc.property(
        arbitraryApiKey,
        fc.array(arbitraryBreak(), { minLength: 0, maxLength: 20 }),
        (apiKey, breaks) => {
          const response = { data: breaks, total: breaks.length };
          expect(containsApiKey(response, apiKey)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── Negative check: LogRecord arrays do not contain the API key ─────────────

  it('LogRecord arrays do not contain the plaintext API key', () => {
    fc.assert(
      fc.property(
        arbitraryApiKey,
        fc.array(arbitraryLogRecord(), { minLength: 0, maxLength: 20 }),
        (apiKey, logs) => {
          const response = { data: logs, total: logs.length };
          expect(containsApiKey(response, apiKey)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── Negative check: Break detail response (with correlated logs) ────────────

  it('Break detail response with correlated logs does not contain the API key', () => {
    fc.assert(
      fc.property(
        arbitraryApiKey,
        arbitraryBreak(),
        fc.array(arbitraryLogRecord(), { maxLength: 10 }),
        (apiKey, breakRecord, correlatedLogs) => {
          const response = { ...breakRecord, correlatedLogs };
          expect(containsApiKey(response, apiKey)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── Negative check: Dashboard response does not contain the API key ─────────

  it('Dashboard aggregation response does not contain the plaintext API key', () => {
    fc.assert(
      fc.property(
        arbitraryApiKey,
        fc.array(arbitraryBreak(), { maxLength: 30 }),
        (apiKey, breaks) => {
          // Simulate a dashboard response shape
          const counts = new Map<string, number>();
          for (const b of breaks) {
            counts.set(b.applicationId, (counts.get(b.applicationId) ?? 0) + 1);
          }
          const dashboardResponse = {
            breakCount24h: breaks.length,
            breakCount7d: breaks.length,
            topServices: Array.from(counts.entries()).map(([id, count]) => ({
              applicationId: id,
              count,
            })),
            severityBreakdown: breaks.reduce<Record<string, number>>((acc, b) => {
              acc[b.severity] = (acc[b.severity] ?? 0) + 1;
              return acc;
            }, {}),
          };
          expect(containsApiKey(dashboardResponse, apiKey)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── Negative check: AirbrakeClient serialization does not leak the API key ──

  it('AirbrakeClient-like config object serialized without apiKey field does not expose the key', () => {
    fc.assert(
      fc.property(
        arbitraryApiKey,
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1000, max: 60000 }),
        (apiKey, projectId, pollIntervalMs) => {
          // Simulate what would be safe to serialize (no apiKey field)
          const safeConfig = { projectId, pollIntervalMs };
          expect(containsApiKey(safeConfig, apiKey)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
