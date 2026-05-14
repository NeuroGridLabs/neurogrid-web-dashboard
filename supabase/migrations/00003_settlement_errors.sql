-- NeuroGrid — Settlement & operational error log (B-009)
-- Persists errors from /api/cron/settle so failures don't vanish with the HTTP response.

CREATE TABLE settlement_errors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  operation     TEXT NOT NULL,          -- 'settle' | 'reclaim' | 'load_sessions' | other
  session_id    UUID,                    -- nullable when error is system-level (no session in scope)
  hour_index    INTEGER,                 -- only set for settle operations
  error_message TEXT NOT NULL,
  resolved      BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at   TIMESTAMPTZ,
  notes         TEXT
);

-- Recent-errors queries (admin panel) want time-descending scan
CREATE INDEX idx_settlement_errors_occurred_at ON settlement_errors (occurred_at DESC);
-- Per-session lookup
CREATE INDEX idx_settlement_errors_session_id ON settlement_errors (session_id) WHERE session_id IS NOT NULL;
-- Filter unresolved (default view)
CREATE INDEX idx_settlement_errors_unresolved ON settlement_errors (occurred_at DESC) WHERE resolved = FALSE;

-- Service-role only: any read/write goes through API layer with admin auth.
ALTER TABLE settlement_errors ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies → anon/authenticated cannot touch this table.
