// Feature: live-airbrake-monitoring-portal, Property 2: Search Result Correctness

/**
 * Validates: Requirements 1.5, 8.1
 *
 * Property 2: Search Result Correctness
 * For any keyword, tag, or error code query and any set of log entries or
 * Breaks, every result returned by the search should contain the query term,
 * and no result should be returned that does not match the query (soundness +
 * completeness).
 */

import * as fc from 'fast-check';
import type { Break, LogRecord } from '@portal/shared';

// ─── Pure in-memory search functions ─────────────────────────────────────────

/** Case-insensitive substring match on the `message` field. */
export function applyKeywordSearch(records: LogRecord[], keyword: string): LogRecord[] {
  if (keyword === '') return records;
  const lower = keyword.toLowerCase();
  return records.filter((r) => r.message.toLowerCase().includes(lower));
}

/** Exact membership match: record must have the given tag in its `tags` array. */
export function applyTagSearch(records: LogRecord[], tag: string): LogRecord[] {
  return records.filter((r) => r.tags.includes(tag));
}

/** Case-insensitive substring match on the `errorMessage` field. */
export function applyBreakKeywordSearch(breaks: Break[], keyword: string): Break[] {
  if (keyword === '') return breaks;
  const lower = keyword.toLowerCase();
  return breaks.filter((b) => b.errorMessage.toLowerCase().includes(lower));
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
    message: fc.string({ minLength: 0, maxLength: 200 }),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
    rawPayload: fc.constant({}),
  });

const arbitraryBreak = (): fc.Arbitrary<Break> =>
  fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...environments),
    severity: fc.constantFrom(...severities),
    errorMessage: fc.string({ minLength: 0, maxLength: 200 }),
    stackTrace: fc.string({ minLength: 0, maxLength: 500 }),
    endpoint: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    requestPayload: fc.constant(null),
    userSession: fc.constant(null),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    fingerprint: fc.hexaString({ minLength: 8, maxLength: 64 }),
  });

// ─── Property 2: Search Result Correctness ────────────────────────────────────

describe('Property 2: Search Result Correctness', () => {
  // ── Keyword search on LogRecord.message ──────────────────────────────────

  it('every result from keyword search contains the keyword in its message (soundness)', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryLogRecord(), { maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        (records, keyword) => {
          const result = applyKeywordSearch(records, keyword);
          for (const record of result) {
            expect(record.message.toLowerCase()).toContain(keyword.toLowerCase());
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('no record excluded from keyword search results contains the keyword (completeness)', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryLogRecord(), { maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        (records, keyword) => {
          const result = applyKeywordSearch(records, keyword);
          const resultIds = new Set(result.map((r) => r.id));
          const excluded = records.filter((r) => !resultIds.has(r.id));

          for (const record of excluded) {
            expect(record.message.toLowerCase()).not.toContain(keyword.toLowerCase());
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('empty keyword returns all records', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryLogRecord(), { maxLength: 50 }),
        (records) => {
          const result = applyKeywordSearch(records, '');
          expect(result).toHaveLength(records.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('keyword that matches no records returns empty array', () => {
    // Use a keyword that is guaranteed not to appear in any message by
    // constructing records whose messages are all empty strings.
    fc.assert(
      fc.property(
        fc.array(
          fc.record<LogRecord>({
            id: fc.uuid(),
            applicationId: fc.uuid(),
            environment: fc.constantFrom(...environments),
            severity: fc.constantFrom(...severities),
            message: fc.constant(''),
            timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
            tags: fc.constant([]),
            rawPayload: fc.constant({}),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        fc.string({ minLength: 1, maxLength: 30 }),
        (records, keyword) => {
          // All messages are empty, so no record can contain a non-empty keyword.
          const result = applyKeywordSearch(records, keyword);
          expect(result).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── Tag search on LogRecord.tags ──────────────────────────────────────────

  it('every result from tag search has the tag in its tags array (soundness)', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryLogRecord(), { maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (records, tag) => {
          const result = applyTagSearch(records, tag);
          for (const record of result) {
            expect(record.tags).toContain(tag);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('no record excluded from tag search has the tag in its tags array (completeness)', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryLogRecord(), { maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (records, tag) => {
          const result = applyTagSearch(records, tag);
          const resultIds = new Set(result.map((r) => r.id));
          const excluded = records.filter((r) => !resultIds.has(r.id));

          for (const record of excluded) {
            expect(record.tags).not.toContain(tag);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── Keyword search on Break.errorMessage ─────────────────────────────────

  it('every result from break keyword search contains the keyword in errorMessage (soundness)', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryBreak(), { maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        (breaks, keyword) => {
          const result = applyBreakKeywordSearch(breaks, keyword);
          for (const b of result) {
            expect(b.errorMessage.toLowerCase()).toContain(keyword.toLowerCase());
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('no break excluded from break keyword search contains the keyword in errorMessage (completeness)', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryBreak(), { maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        (breaks, keyword) => {
          const result = applyBreakKeywordSearch(breaks, keyword);
          const resultIds = new Set(result.map((b) => b.id));
          const excluded = breaks.filter((b) => !resultIds.has(b.id));

          for (const b of excluded) {
            expect(b.errorMessage.toLowerCase()).not.toContain(keyword.toLowerCase());
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
