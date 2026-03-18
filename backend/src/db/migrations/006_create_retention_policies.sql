-- Migration 006: Create retention_policies table
-- Requirements: 9.1, 9.2

CREATE TABLE IF NOT EXISTS retention_policies (
  application_id TEXT PRIMARY KEY,
  retention_days INTEGER NOT NULL CHECK (retention_days IN (30, 60, 90)),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
