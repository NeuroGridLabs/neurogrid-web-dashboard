-- NeuroGrid — RLS Policy Test Suite (B-003)
--
-- Run via: psql "$SUPABASE_DB_URL" -f supabase/tests/rls.sql
--   or:    supabase db execute -f supabase/tests/rls.sql
--
-- Tests current Epoch 0 RLS posture:
--   - All 6 core tables have RLS ENABLED (defense in depth).
--   - SELECT policies are permissive (data is public).
--   - INSERT/UPDATE policies are permissive — actual auth happens at the API layer
--     (JWT + CSRF + service_role key for writes). The RLS layer is here so that
--     when we later move some writes to anon role (Epoch 1), we can tighten policies
--     without re-engineering the storage path.
--   - rate_limit_log has NO policies → service_role only (00002 migration).
--
-- A passing run prints "ALL RLS TESTS PASSED" at the end.
-- A failing test raises an exception with the table + role + operation that broke.

\set ON_ERROR_STOP on

BEGIN;

-- ============================================================
-- Helpers
-- ============================================================

CREATE OR REPLACE FUNCTION pg_temp.assert_rls_enabled(p_table TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO v_enabled
  FROM pg_class
  WHERE oid = ('public.' || p_table)::regclass;

  IF NOT v_enabled THEN
    RAISE EXCEPTION 'RLS NOT ENABLED on %', p_table;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_policy_exists(p_table TEXT, p_policy TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = p_table AND policyname = p_policy;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'POLICY MISSING: %.%', p_table, p_policy;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_no_policies(p_table TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = p_table;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'TABLE % SHOULD HAVE NO POLICIES (had %)', p_table, v_count;
  END IF;
END;
$$;

-- ============================================================
-- Test 1: RLS is enabled on all 7 tables
-- ============================================================

SELECT pg_temp.assert_rls_enabled('nodes');
SELECT pg_temp.assert_rls_enabled('miners');
SELECT pg_temp.assert_rls_enabled('rental_sessions');
SELECT pg_temp.assert_rls_enabled('settlement_logs');
SELECT pg_temp.assert_rls_enabled('miner_financials');
SELECT pg_temp.assert_rls_enabled('disputes');
SELECT pg_temp.assert_rls_enabled('rate_limit_log');

\echo '[OK] RLS enabled on all 7 tables'

-- ============================================================
-- Test 2: Expected policies exist on the 6 public tables
-- ============================================================

-- nodes: SELECT/INSERT/UPDATE
SELECT pg_temp.assert_policy_exists('nodes', 'nodes_select');
SELECT pg_temp.assert_policy_exists('nodes', 'nodes_insert');
SELECT pg_temp.assert_policy_exists('nodes', 'nodes_update');

-- miners: SELECT/INSERT/UPDATE/DELETE
SELECT pg_temp.assert_policy_exists('miners', 'miners_select');
SELECT pg_temp.assert_policy_exists('miners', 'miners_insert');
SELECT pg_temp.assert_policy_exists('miners', 'miners_update');
SELECT pg_temp.assert_policy_exists('miners', 'miners_delete');

-- rental_sessions: SELECT/INSERT/UPDATE
SELECT pg_temp.assert_policy_exists('rental_sessions', 'rentals_select');
SELECT pg_temp.assert_policy_exists('rental_sessions', 'rentals_insert');
SELECT pg_temp.assert_policy_exists('rental_sessions', 'rentals_update');

-- settlement_logs: SELECT/INSERT
SELECT pg_temp.assert_policy_exists('settlement_logs', 'settlements_select');
SELECT pg_temp.assert_policy_exists('settlement_logs', 'settlements_insert');

-- miner_financials: SELECT/INSERT/UPDATE
SELECT pg_temp.assert_policy_exists('miner_financials', 'financials_select');
SELECT pg_temp.assert_policy_exists('miner_financials', 'financials_insert');
SELECT pg_temp.assert_policy_exists('miner_financials', 'financials_update');

-- disputes: SELECT/INSERT
SELECT pg_temp.assert_policy_exists('disputes', 'disputes_select');
SELECT pg_temp.assert_policy_exists('disputes', 'disputes_insert');

\echo '[OK] All expected policies exist'

-- ============================================================
-- Test 3: rate_limit_log has zero policies (service_role only)
-- ============================================================

SELECT pg_temp.assert_no_policies('rate_limit_log');

\echo '[OK] rate_limit_log is service_role-only (no policies)'

-- ============================================================
-- Test 4: anon role behaviour (current permissive policies)
-- ============================================================

-- Use an isolated test wallet so we don't pollute real data.
-- All inserts done in this test will be rolled back by COMMIT/ROLLBACK below.

SET LOCAL ROLE anon;

-- 4.1 anon CAN SELECT all 6 public tables
DO $$
BEGIN
  PERFORM 1 FROM nodes LIMIT 1;
  PERFORM 1 FROM miners LIMIT 1;
  PERFORM 1 FROM rental_sessions LIMIT 1;
  PERFORM 1 FROM settlement_logs LIMIT 1;
  PERFORM 1 FROM miner_financials LIMIT 1;
  PERFORM 1 FROM disputes LIMIT 1;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE EXCEPTION 'anon SELECT was denied — policies have changed';
END;
$$;

\echo '[OK] anon can SELECT all 6 public tables'

-- 4.2 anon CANNOT touch rate_limit_log (no policies)
DO $$
DECLARE
  v_failed BOOLEAN := FALSE;
BEGIN
  BEGIN
    PERFORM 1 FROM rate_limit_log LIMIT 1;
    v_failed := TRUE;  -- should not reach here
  EXCEPTION WHEN insufficient_privilege THEN
    -- expected
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'anon SELECT on rate_limit_log was ALLOWED — security regression';
  END IF;
END;
$$;

\echo '[OK] anon cannot SELECT rate_limit_log'

RESET ROLE;

-- ============================================================
-- Test 5: service_role bypasses RLS (sanity)
-- ============================================================

SET LOCAL ROLE service_role;

DO $$
BEGIN
  PERFORM 1 FROM nodes LIMIT 1;
  PERFORM 1 FROM rate_limit_log LIMIT 1;  -- service_role can touch even no-policy tables
EXCEPTION WHEN insufficient_privilege THEN
  RAISE EXCEPTION 'service_role was denied — role config broken';
END;
$$;

\echo '[OK] service_role bypasses RLS'

RESET ROLE;

-- ============================================================
-- Test 6: check_rate_limit RPC works end-to-end
-- ============================================================

SET LOCAL ROLE service_role;

DO $$
DECLARE
  r RECORD;
  v_test_key TEXT := 'rls_test:' || gen_random_uuid()::TEXT;
BEGIN
  -- First call: allowed = true, remaining = 1 (max=2)
  SELECT * INTO r FROM check_rate_limit(v_test_key, 2, 60000);
  IF NOT r.allowed THEN RAISE EXCEPTION 'first call should be allowed'; END IF;
  IF r.remaining <> 1 THEN RAISE EXCEPTION 'expected remaining=1, got %', r.remaining; END IF;

  -- Second call: allowed = true, remaining = 0
  SELECT * INTO r FROM check_rate_limit(v_test_key, 2, 60000);
  IF NOT r.allowed THEN RAISE EXCEPTION 'second call should be allowed'; END IF;
  IF r.remaining <> 0 THEN RAISE EXCEPTION 'expected remaining=0, got %', r.remaining; END IF;

  -- Third call: allowed = false (limit exceeded)
  SELECT * INTO r FROM check_rate_limit(v_test_key, 2, 60000);
  IF r.allowed THEN RAISE EXCEPTION 'third call should be DENIED'; END IF;

  -- Cleanup
  DELETE FROM rate_limit_log WHERE key = v_test_key;
END;
$$;

\echo '[OK] check_rate_limit RPC enforces window correctly'

RESET ROLE;

-- ============================================================
-- Done
-- ============================================================

ROLLBACK;

\echo ''
\echo '======================================'
\echo '  ALL RLS TESTS PASSED'
\echo '======================================'
