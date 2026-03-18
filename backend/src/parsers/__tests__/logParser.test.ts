import { parseLogRecord, serializeLogRecord, ParseErrorWriter } from '../logParser';
import { LogRecord } from '@portal/shared';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWriter(): { writer: ParseErrorWriter; calls: Array<{ raw: unknown; msg: string }> } {
  const calls: Array<{ raw: unknown; msg: string }> = [];
  const writer: ParseErrorWriter = {
    write: async (raw, msg) => { calls.push({ raw, msg }); },
  };
  return { writer, calls };
}

const validPayload = {
  id: 'log-1',
  applicationId: 'app-a',
  environment: 'production',
  severity: 'info',
  message: 'Hello world',
  timestamp: '2024-01-15T10:00:00.000Z',
  tags: ['tag1', 'tag2'],
  rawPayload: { source: 'airbrake' },
};

// ─── parseLogRecord — happy path ──────────────────────────────────────────────

describe('parseLogRecord — valid payloads', () => {
  it('parses a complete valid payload', async () => {
    const result = await parseLogRecord(validPayload);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.record.id).toBe('log-1');
    expect(result.record.applicationId).toBe('app-a');
    expect(result.record.environment).toBe('production');
    expect(result.record.severity).toBe('info');
    expect(result.record.message).toBe('Hello world');
    expect(result.record.timestamp).toBeInstanceOf(Date);
    expect(result.record.timestamp.toISOString()).toBe('2024-01-15T10:00:00.000Z');
    expect(result.record.tags).toEqual(['tag1', 'tag2']);
  });

  it('accepts a Date object as timestamp', async () => {
    const ts = new Date('2024-06-01T00:00:00.000Z');
    const result = await parseLogRecord({ ...validPayload, timestamp: ts });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.record.timestamp).toEqual(ts);
  });

  it('accepts a numeric timestamp (epoch ms)', async () => {
    const ts = new Date('2024-06-01T00:00:00.000Z');
    const result = await parseLogRecord({ ...validPayload, timestamp: ts.getTime() });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.record.timestamp.getTime()).toBe(ts.getTime());
  });

  it('defaults tags to [] when missing', async () => {
    const { tags: _tags, ...noTags } = validPayload;
    const result = await parseLogRecord(noTags);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.record.tags).toEqual([]);
  });

  it('defaults tags to [] when tags is not a string array', async () => {
    const result = await parseLogRecord({ ...validPayload, tags: [1, 2, 3] });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.record.tags).toEqual([]);
  });

  it('accepts all valid environments', async () => {
    for (const env of ['production', 'qa', 'development'] as const) {
      const result = await parseLogRecord({ ...validPayload, environment: env });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid severities', async () => {
    for (const sev of ['info', 'warning', 'error', 'critical'] as const) {
      const result = await parseLogRecord({ ...validPayload, severity: sev });
      expect(result.success).toBe(true);
    }
  });
});

// ─── parseLogRecord — malformed payloads ──────────────────────────────────────

describe('parseLogRecord — malformed payloads', () => {
  it('returns error for null payload', async () => {
    const { writer, calls } = makeWriter();
    const result = await parseLogRecord(null, writer);
    expect(result.success).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('returns error for non-object payload', async () => {
    const { writer, calls } = makeWriter();
    const result = await parseLogRecord('not an object', writer);
    expect(result.success).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('returns error for array payload', async () => {
    const { writer, calls } = makeWriter();
    const result = await parseLogRecord([], writer);
    expect(result.success).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('returns error when id is missing', async () => {
    const { id: _id, ...noId } = validPayload;
    const { writer, calls } = makeWriter();
    const result = await parseLogRecord(noId, writer);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('id');
    expect(calls).toHaveLength(1);
  });

  it('returns error when applicationId is missing', async () => {
    const { applicationId: _a, ...noApp } = validPayload;
    const { writer, calls } = makeWriter();
    const result = await parseLogRecord(noApp, writer);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('applicationId');
    expect(calls).toHaveLength(1);
  });

  it('returns error for invalid environment', async () => {
    const { writer, calls } = makeWriter();
    const result = await parseLogRecord({ ...validPayload, environment: 'staging' }, writer);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('environment');
    expect(calls).toHaveLength(1);
  });

  it('returns error for invalid severity', async () => {
    const { writer, calls } = makeWriter();
    const result = await parseLogRecord({ ...validPayload, severity: 'debug' }, writer);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('severity');
    expect(calls).toHaveLength(1);
  });

  it('returns error for invalid timestamp string', async () => {
    const { writer, calls } = makeWriter();
    const result = await parseLogRecord({ ...validPayload, timestamp: 'not-a-date' }, writer);
    expect(result.success).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('returns error when message is missing', async () => {
    const { message: _m, ...noMsg } = validPayload;
    const { writer, calls } = makeWriter();
    const result = await parseLogRecord(noMsg, writer);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('message');
    expect(calls).toHaveLength(1);
  });

  it('does not throw on empty object', async () => {
    const { writer } = makeWriter();
    await expect(parseLogRecord({}, writer)).resolves.toMatchObject({ success: false });
  });
});

// ─── serializeLogRecord ───────────────────────────────────────────────────────

describe('serializeLogRecord', () => {
  it('serializes a LogRecord to JSON with ISO timestamp', () => {
    const record: LogRecord = {
      id: 'log-1',
      applicationId: 'app-a',
      environment: 'production',
      severity: 'info',
      message: 'Hello',
      timestamp: new Date('2024-01-15T10:00:00.000Z'),
      tags: ['t1'],
      rawPayload: { k: 'v' },
    };
    const json = serializeLogRecord(record);
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe('log-1');
    expect(parsed.timestamp).toBe('2024-01-15T10:00:00.000Z');
    expect(parsed.tags).toEqual(['t1']);
  });

  it('produces valid JSON', () => {
    const record: LogRecord = {
      id: 'x',
      applicationId: 'y',
      environment: 'qa',
      severity: 'warning',
      message: 'test',
      timestamp: new Date(),
      tags: [],
      rawPayload: {},
    };
    expect(() => JSON.parse(serializeLogRecord(record))).not.toThrow();
  });
});

// ─── round-trip ───────────────────────────────────────────────────────────────

describe('parse → serialize → parse round-trip', () => {
  it('produces an equivalent record', async () => {
    const result1 = await parseLogRecord(validPayload);
    expect(result1.success).toBe(true);
    if (!result1.success) return;

    const json = serializeLogRecord(result1.record);
    const result2 = await parseLogRecord(JSON.parse(json));
    expect(result2.success).toBe(true);
    if (!result2.success) return;

    expect(result2.record).toEqual(result1.record);
  });
});
