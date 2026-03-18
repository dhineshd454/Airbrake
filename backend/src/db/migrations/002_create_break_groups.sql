-- Migration 002: Create break_groups table
-- Requirements: 2.2, 2.3, 2.4

CREATE TABLE IF NOT EXISTS break_groups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint      TEXT NOT NULL UNIQUE,
  application_id   TEXT NOT NULL,
  first_occurrence TIMESTAMPTZ NOT NULL,
  last_occurrence  TIMESTAMPTZ NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'regression')),
  severity         TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  error_message    TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_break_groups_fingerprint    ON break_groups (fingerprint);
CREATE INDEX IF NOT EXISTS idx_break_groups_application_id ON break_groups (application_id);
CREATE INDEX IF NOT EXISTS idx_break_groups_status         ON break_groups (status);
CREATE INDEX IF NOT EXISTS idx_break_groups_last_occurrence ON break_groups (last_occurrence DESC);
