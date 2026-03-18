import { LogRecord } from '@portal/shared';
import { parseLogRecord, ParseErrorWriter } from '../parsers/logParser';

// ─── Dependency Interfaces ────────────────────────────────────────────────────

export interface LogRecordRepository {
  save(record: LogRecord): Promise<void>;
}

export interface LogSearchIndexer {
  indexLogRecord(record: LogRecord): Promise<void>;
}

export interface LogRedisPublisher {
  publish(channel: string, message: string): Promise<void>;
}

export interface ParseErrorRepository {
  save(rawPayload: unknown, errorMessage: string): Promise<void>;
}

// ─── LogPipeline ──────────────────────────────────────────────────────────────

export interface LogPipeline {
  ingest(raw: unknown): Promise<void>;
}

export function createLogPipeline(
  repository: LogRecordRepository,
  indexer: LogSearchIndexer,
  publisher: LogRedisPublisher,
  parseErrorRepository: ParseErrorRepository,
): LogPipeline {
  // Wire ParseErrorRepository to the ParseErrorWriter interface expected by parseLogRecord
  const parseErrorWriter: ParseErrorWriter = {
    write: (rawPayload, errorMessage) => parseErrorRepository.save(rawPayload, errorMessage),
  };

  return {
    async ingest(raw: unknown): Promise<void> {
      try {
        const result = await parseLogRecord(raw, parseErrorWriter);

        if (!result.success) {
          // Parse error already written to parse_errors by parseLogRecord via parseErrorWriter
          return;
        }

        const record = result.record;

        try {
          await repository.save(record);
        } catch (err) {
          console.error('[LogPipeline] Failed to save record to PostgreSQL:', err);
          return;
        }

        try {
          await indexer.indexLogRecord(record);
        } catch (err) {
          console.error('[LogPipeline] Failed to index record in Elasticsearch:', err);
        }

        try {
          await publisher.publish('logs', JSON.stringify(record));
        } catch (err) {
          console.error('[LogPipeline] Failed to publish record to Redis:', err);
        }
      } catch (err) {
        // Top-level catch — pipeline must never throw
        console.error('[LogPipeline] Unexpected error during ingest:', err);
      }
    },
  };
}
