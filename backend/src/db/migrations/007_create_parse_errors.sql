-- Migration 007: Create parse_errors table
-- Requirements: 10.3

CREATE TABLE IF NOT EXISTS parse_errors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_payload  JSONB,
  error_message TEXT NOT NULL,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parse_errors_occurred_at ON parse_errors (occurred_at DESC);
