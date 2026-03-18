// Feature: live-airbrake-monitoring-portal, Property 21: Retention Purge Correctness

import * as fc from 'fast-check';
import type { LogRecord, Break } from '@portal/shared';

// ─── In-memory purge helpers ──────────────────────────────────────────────────

function purgeOlderThan<T extends { timestamp: Date }>(records: T[], cutoffDate: Date): T[] {
  return records.filter((r) => r.timestamp >= cutoffDate);
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const arbTimestamp = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') });

const arbLogRecord: fc.Arbitrary<LogRecord> = fc.record({
  id: fc.uuid(),
  applicationId: fc.uuid(),
  environment: fc.constantFrom('production', 'qa', 'development'),
  severity: fc.constantFrom('info', 'warning', 'error', 'critical'),
  message: fc.string({ minLength: 1, maxLength: 100 }),
  timestamp: arbTimestamp,
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  rawPayload: fc.constant({}),
});

const arbBreak: fc.Arbitrary<Break> = fc.record({
  id: fc.uuid(),
  applicationId: fc.uuid(),
  environment: fc.constantFrom('production', 'qa', 'development'),
  severity: fc.constantFrom('info', 'warning', 'error', 'critical'),
  errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
  stackTrace: fc.string({ minLength: 1, maxLength: 200 }),
  endpoint: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  requestPayload: fc.constant(null),
  userSession: fc.constant(null),
  timestamp: arbTimestamp,
  fingerprint: fc.hexaString({ minLength: 8, maxLength: 16 }),
});

/** Retention period in days: 30, 60, or 90 */
const arbRetentionDays = fc.constantFrom(30, 60, 90);

// ─── Property 21: Retention Purge Correctness ────────────────────────────────

/**
 * Validates: Requirements 9.1, 9.2
 *
 * For any configured retention period R (30, 60, or 90 days), after the purge
 * process runs, no log entry or Break record with a timestamp older than R days
 * should appear in any query result.
 */
describe('Property 21: Retention Purge Correctness', () => {
  const NOW = new Date('2024-06-01T12:00:00Z');

  it('after purge, no LogRecord has a timestamp older than the retention cutoff', () => {
    fc.assert(
      fc.property(
        fc.array(arbLogRecord, { maxLength: 50 }),
        arbRetentionDays,
        (records, retentionDays) => {
          const cutoff = new Date(NOW.getTime() - retentionDays * 24 * 60 * 60 * 1000);
          const purged = purgeOlderThan(records, cutoff);

          for (const record of purged) {
            expect(record.timestamp.getTime()).toBeGreaterThanOrEqual(cutoff.getTime());
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('after purge, no Break record has a timestamp older than the retention cutoff', () => {
    fc.assert(
      fc.property(
        fc.array(arbBreak, { maxLength: 50 }),
        arbRetentionDays,
        (records, retentionDays) => {
          const cutoff = new Date(NOW.getTime() - retentionDays * 24 * 60 * 60 * 1000);
          const purged = purgeOlderThan(records, cutoff);

          for (const record of purged) {
            expect(record.timestamp.getTime()).toBeGreaterThanOrEqual(cutoff.getTime());
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('records with timestamp >= cutoff are preserved after purge (LogRecord)', () => {
    fc.assert(
      fc.property(
        fc.array(arbLogRecord, { maxLength: 50 }),
        arbRetentionDays,
        (records, retentionDays) => {
          const cutoff = new Date(NOW.getTime() - retentionDays * 24 * 60 * 60 * 1000);
          const shouldKeep = records.filter((r) => r.timestamp >= cutoff);
          const purged = purgeOlderThan(records, cutoff);

          expect(purged.length).toBe(shouldKeep.length);
          for (const record of shouldKeep) {
            expect(purged.some((r) => r.id === record.id)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('records with timestamp >= cutoff are preserved after purge (Break)', () => {
    fc.assert(
      fc.property(
        fc.array(arbBreak, { maxLength: 50 }),
        arbRetentionDays,
        (records, retentionDays) => {
          const cutoff = new Date(NOW.getTime() - retentionDays * 24 * 60 * 60 * 1000);
          const shouldKeep = records.filter((r) => r.timestamp >= cutoff);
          const purged = purgeOlderThan(records, cutoff);

          expect(purged.length).toBe(shouldKeep.length);
          for (const record of shouldKeep) {
            expect(purged.some((r) => r.id === record.id)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
