-- Migration 004: Create alert_rules table
-- Requirements: 5.1, 5.2, 5.5

CREATE TABLE IF NOT EXISTS alert_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  threshold           INTEGER NOT NULL CHECK (threshold > 0),
  window_seconds      INTEGER NOT NULL CHECK (window_seconds > 0),
  trigger_on_new_error BOOLEAN NOT NULL DEFAULT FALSE,
  channels            JSONB NOT NULL DEFAULT '[]',
  created_by          UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled    ON alert_rules (enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_created_by ON alert_rules (created_by);
