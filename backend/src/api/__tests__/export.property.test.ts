// Feature: live-airbrake-monitoring-portal, Property 20: Export Contains All Records

/**
 * Validates: Requirements 8.5, 9.4
 *
 * Property 20: Export Contains All Records
 * For any set of search results, exporting in CSV format and in JSON format
 * should each produce output that contains exactly the same records as the
 * search result set, with no records omitted or added.
 */

import * as fc from 'fast-check';
import type { Break, LogRecord } from '@portal/shared';
import {
  toCsv,
  createExportLogsHandler,
  createExportBreaksHandler,
  type LogSearchRepository,
  type BreakExportRepository,
  type LogsResponse,
} from '../logsRouter';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const severities = ['info', 'warning', 'error', 'critical'] as const;
const environments = ['production', 'qa', 'development'] as const;

const arbitraryLogRecord = (): fc.Arbitrary<LogRecord> =>
  fc.record({
    id: fc.uuid(),
    applicationId: fc.uuid(),
    environment: fc.constantFrom(...environments),
    severity: fc.constantFrom(...severities),
    message: fc.string({ minLength: 1, maxLength: 100 }),
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
    errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
    stackTrace: fc.string({ minLength: 1, maxLength: 200 }),
    endpoint: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    requestPayload: fc.constant(null),
    userSession: fc.constant(null),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    fingerprint: fc.hexaString({ minLength: 8, maxLength: 32 }),
  });

// ─── Mock response helper ─────────────────────────────────────────────────────

function makeMockResponse(): LogsResponse & { capturedJson: unknown; capturedCsv: string; headers: Record<string, string> } {
  const mock = {
    statusCode: 200,
    capturedJson: undefined as unknown,
    capturedCsv: '',
    headers: {} as Record<string, string>,
    status(code: number) { mock.statusCode = code; return mock; },
    json(body: unknown) { mock.capturedJson = body; },
    setHeader(name: string, value: string) { mock.headers[name] = value; },
    send(body: string) { mock.capturedCsv = body; },
  };
  return mock;
}

function makeMockRequest(format: 'json' | 'csv') {
  return {
    method: 'GET',
    path: '/export',
    headers: {},
    query: { format } as Record<string, string | undefined>,
    params: {},
    session: undefined,
  };
}

// ─── CSV field definitions (mirrors logsRouter internals) ─────────────────────

const LOG_CSV_FIELDS = ['id', 'applicationId', 'environment', 'severity', 'message', 'timestamp', 'tags'];
const BREAK_CSV_FIELDS = ['id', 'applicationId', 'environment', 'severity', 'errorMessage', 'stackTrace', 'endpoint', 'timestamp', 'fingerprint'];

// ─── Property 20: Export Contains All Records ─────────────────────────────────

describe('Property 20: Export Contains All Records', () => {

  // ── LogRecord JSON export ──────────────────────────────────────────────────

  it('JSON export of LogRecords contains exactly the same records as input (no omissions, no additions)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryLogRecord(), { maxLength: 50 }),
        async (records) => {
          const repo: LogSearchRepository = {
            search: async () => ({ data: records, total: records.length }),
            searchAll: async () => records,
          };

          const handler = createExportLogsHandler(repo);
          const req = makeMockRequest('json');
          const res = makeMockResponse();

          await handler(req, res, () => {});

          const exported = res.capturedJson as LogRecord[];
          expect(exported).toHaveLength(records.length);

          const exportedIds = new Set(exported.map((r) => r.id));
          const inputIds = new Set(records.map((r) => r.id));
          expect(exportedIds).toEqual(inputIds);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── LogRecord CSV export ───────────────────────────────────────────────────

  it('CSV export of LogRecords has exactly header + N data rows for N input records', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryLogRecord(), { maxLength: 50 }),
        (records) => {
          const csv = toCsv(records, LOG_CSV_FIELDS);
          const lines = csv.split('\n');
          // header row + one row per record
          expect(lines).toHaveLength(records.length + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── Break JSON export ──────────────────────────────────────────────────────

  it('JSON export of Breaks contains exactly the same records as input (no omissions, no additions)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryBreak(), { maxLength: 50 }),
        async (breaks) => {
          const repo: BreakExportRepository = {
            exportAll: async () => breaks,
          };

          const handler = createExportBreaksHandler(repo);
          const req = makeMockRequest('json');
          const res = makeMockResponse();

          await handler(req, res, () => {});

          const exported = res.capturedJson as Break[];
          expect(exported).toHaveLength(breaks.length);

          const exportedIds = new Set(exported.map((b) => b.id));
          const inputIds = new Set(breaks.map((b) => b.id));
          expect(exportedIds).toEqual(inputIds);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── Break CSV export ───────────────────────────────────────────────────────

  it('CSV export of Breaks has exactly header + N data rows for N input records', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryBreak(), { maxLength: 50 }),
        (breaks) => {
          const csv = toCsv(breaks, BREAK_CSV_FIELDS);
          const lines = csv.split('\n');
          expect(lines).toHaveLength(breaks.length + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── CSV round-trip: parse back and verify record count ────────────────────

  it('CSV round-trip: parsing CSV back yields the same number of records as input', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryLogRecord(), { maxLength: 50 }),
        (records) => {
          const csv = toCsv(records, LOG_CSV_FIELDS);
          const lines = csv.split('\n');
          // First line is header; remaining lines are data rows
          const dataRows = lines.slice(1);
          expect(dataRows).toHaveLength(records.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── Empty input ────────────────────────────────────────────────────────────

  it('empty input produces an empty JSON array', async () => {
    const repo: LogSearchRepository = {
      search: async () => ({ data: [], total: 0 }),
      searchAll: async () => [],
    };

    const handler = createExportLogsHandler(repo);
    const req = makeMockRequest('json');
    const res = makeMockResponse();

    await handler(req, res, () => {});

    expect(res.capturedJson).toEqual([]);
  });

  it('empty input produces a header-only CSV (1 line, no data rows)', () => {
    const csv = toCsv([], LOG_CSV_FIELDS);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(LOG_CSV_FIELDS.join(','));
  });

  it('empty Breaks input produces a header-only CSV', () => {
    const csv = toCsv([], BREAK_CSV_FIELDS);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(BREAK_CSV_FIELDS.join(','));
  });
});
