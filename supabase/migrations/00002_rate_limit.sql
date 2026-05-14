-- NeuroGrid — Rate limit persistence (B-002)
-- Cross-instance rate limiting for Vercel serverless.
-- Memory L1 still catches bursts within a single instance; this table is L2.

CREATE TABLE rate_limit_log (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 1 CHECK (count >= 0),
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Used by janitor / cleanup queries
CREATE INDEX idx_rate_limit_window_start ON rate_limit_log (window_start);

-- ============================================================
-- check_rate_limit(key, max, window_ms)
-- Atomic upsert that:
--   - resets count to 1 if window has expired
--   - increments count if still in window
--   - returns whether the request is allowed + remaining quota + reset time
-- ============================================================

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key       TEXT,
  p_max       INTEGER,
  p_window_ms INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now          TIMESTAMPTZ := now();
  v_window       INTERVAL    := (p_window_ms || ' milliseconds')::INTERVAL;
  v_count        INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  INSERT INTO rate_limit_log (key, count, window_start)
  VALUES (p_key, 1, v_now)
  ON CONFLICT (key) DO UPDATE
    SET
      count = CASE
        WHEN rate_limit_log.window_start < v_now - v_window THEN 1
        ELSE rate_limit_log.count + 1
      END,
      window_start = CASE
        WHEN rate_limit_log.window_start < v_now - v_window THEN v_now
        ELSE rate_limit_log.window_start
      END
  RETURNING rate_limit_log.count, rate_limit_log.window_start
  INTO v_count, v_window_start;

  RETURN QUERY SELECT
    v_count <= p_max,
    GREATEST(p_max - v_count, 0),
    v_window_start + v_window;
END;
$$;

-- ============================================================
-- cleanup_rate_limit_log()
-- Run periodically (e.g. from cron) to remove expired entries.
-- Conservatively keeps anything within 1 hour for audit/debug.
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_rate_limit_log()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limit_log
  WHERE window_start < now() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- RLS: rate_limit_log is service_role only (no public access).
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies → all anon/authenticated reads/writes denied.
