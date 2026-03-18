-- Migration 003: Create breaks table
-- Requirements: 2.1, 2.2, 10.2

CREATE TABLE IF NOT EXISTS breaks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  TEXT NOT NULL,
  environment     TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  error_message   TEXT NOT NULL,
  stack_trace     TEXT NOT NULL,
  endpoint        TEXT,
  request_payload JSONB,
  user_session    JSONB,
  timestamp       TIMESTAMPTZ NOT NULL,
  fingerprint     TEXT NOT NULL,
  group_id        UUID REFERENCES break_groups (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_breaks_application_id ON breaks (application_id);
CREATE INDEX IF NOT EXISTS idx_breaks_fingerprint    ON breaks (fingerprint);
CREATE INDEX IF NOT EXISTS idx_breaks_timestamp      ON breaks (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_breaks_severity       ON breaks (severity);
CREATE INDEX IF NOT EXISTS idx_breaks_group_id       ON breaks (group_id);
