// Feature: live-airbrake-monitoring-portal, Property 1: Filter Correctness

/**
 * Validates: Requirements 1.4, 1.6
 *
 * Property 1: Filter Correctness
 * For any set of log entries and any combination of filter criteria
 * (application, environment, severity, timestamp range), the filtered result
 * set should contain only entries that satisfy every active filter criterion
 * simultaneously, and no entry that fails any criterion should appear in the
 * result (soundness + completeness).
 */

import * as fc from 'fast-check';
import type { LogRecord } from '@portal/shared';
import type { LogSearchFilters } from '../logsRouter';

// ─── Pure in-memory filter function ──────────────────────────────────────────

/**
 * Mirrors the filtering logic that the repository layer would apply.
 * Only filters on the fields relevant to Property 1 (application, environment,
 * severity, timestamp range). Keyword/tags filtering is out of scope here.
 */
export function applyLogFilters(
  records: LogRecord[],
  filters: Partial<Pick<LogSearchFilters, 'applicationId' | 'environment' | 'severity' | 'from' | 'to'>>,
): LogRecord[] {
  return records.filter((r) => {
    if (filters.applicationId !== undefined && r.applicationId !== filters.applicationId) {
      return false;
    }
    if (filters.environment !== undefined && r.environment !== filters.environment) {
      return false;
    }
    if (filters.severity !== undefined && r.severity !== filters.severity) {
      return false;
    }
    if (filters.from !== undefined && new Date(r.timestamp) < filters.from) {
      return false;
    }
    if (filters.to !== undefined && new Date(r.timestamp) > filters.to) {
      return false;
    }
    return true;
  });
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const severities = ['info', 'warning', 'error', 'critical'] as const;
const environments = ['production', 'qa', 'development'] as const;

const arbitraryLogRecord = (): fc.Arbitrary<LogRecord> =>
  fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...environments),
    severity: fc.constantFrom(...severities),
    message: fc.string({ minLength: 1, maxLength: 200 }),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
    rawPayload: fc.constant({}),
  });

/** Generates an optional string filter value — either undefined or one of the given choices. */
const optionalFrom = <T extends string>(choices: readonly T[]): fc.Arbitrary<T | undefined> =>
  fc.option(fc.constantFrom(...choices), { nil: undefined });

const arbitraryFilters = (): fc.Arbitrary<
  Partial<Pick<LogSearchFilters, 'applicationId' | 'environment' | 'severity' | 'from' | 'to'>>
> =>
  fc.record({
    applicationId: fc.option(fc.uuid(), { nil: undefined }),
    environment: optionalFrom(environments),
    severity: optionalFrom(severities),
    from: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }), { nil: undefined }),
    to: fc.option(fc.date({ min: new Date('2025-01-02'), max: new Date('2030-01-01') }), { nil: undefined }),
  });

// ─── Helper: does a record satisfy all active filter criteria? ────────────────

function satisfiesAllFilters(
  record: LogRecord,
  filters: Partial<Pick<LogSearchFilters, 'applicationId' | 'environment' | 'severity' | 'from' | 'to'>>,
): boolean {
  if (filters.applicationId !== undefined && record.applicationId !== filters.applicationId) return false;
  if (filters.environment !== undefined && record.environment !== filters.environment) return false;
  if (filters.severity !== undefined && record.severity !== filters.severity) return false;
  if (filters.from !== undefined && new Date(record.timestamp) < filters.from) return false;
  if (filters.to !== undefined && new Date(record.timestamp) > filters.to) return false;
  return true;
}

// ─── Property 1: Filter Correctness ──────────────────────────────────────────

describe('Property 1: Filter Correctness', () => {
  it('every record in the result satisfies ALL active filter criteria (soundness)', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryLogRecord(), { maxLength: 50 }),
        arbitraryFilters(),
        (records, filters) => {
          const result = applyLogFilters(records, filters);

          for (const record of result) {
            expect(satisfiesAllFilters(record, filters)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('no record excluded from the result would satisfy all active filter criteria (completeness)', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryLogRecord(), { maxLength: 50 }),
        arbitraryFilters(),
        (records, filters) => {
          const result = applyLogFilters(records, filters);
          const resultIds = new Set(result.map((r) => r.id));

          const excluded = records.filter((r) => !resultIds.has(r.id));

          for (const record of excluded) {
            expect(satisfiesAllFilters(record, filters)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('result is a subset of the original records (no phantom records introduced)', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryLogRecord(), { maxLength: 50 }),
        arbitraryFilters(),
        (records, filters) => {
          const result = applyLogFilters(records, filters);
          const originalIds = new Set(records.map((r) => r.id));

          for (const record of result) {
            expect(originalIds.has(record.id)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('empty filter criteria returns all records unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryLogRecord(), { maxLength: 50 }),
        (records) => {
          const result = applyLogFilters(records, {});
          expect(result).toHaveLength(records.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
