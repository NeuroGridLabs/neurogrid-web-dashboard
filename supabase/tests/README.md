# Supabase Tests

## RLS test suite (`rls.sql`)

Run against any environment that has both `00001_initial_schema.sql` and
`00002_rate_limit.sql` applied.

### Local (Supabase CLI)

```bash
supabase db reset                       # apply migrations
psql "$(supabase status --output json | jq -r .DB_URL)" -f supabase/tests/rls.sql
```

### Hosted

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/rls.sql
```

A passing run prints `ALL RLS TESTS PASSED`. Any failure raises a Postgres
exception naming the table + role + operation that broke.

### What the suite covers

| # | Check |
|---|-------|
| 1 | RLS is `ENABLED` on all 7 tables (6 public + `rate_limit_log`) |
| 2 | All expected policies (`*_select`, `*_insert`, `*_update`, `*_delete`) exist |
| 3 | `rate_limit_log` has **zero** policies (service_role-only) |
| 4 | `anon` role can `SELECT` the 6 public tables, cannot touch `rate_limit_log` |
| 5 | `service_role` bypasses RLS (sanity) |
| 6 | `check_rate_limit` RPC enforces sliding window correctly (3 calls, max=2) |

### Epoch 0 RLS posture (intentional)

- All public tables have **permissive** `SELECT/INSERT/UPDATE` policies
  (`USING (true)`, `WITH CHECK (true)`).
- Real authorization happens at the **API layer** (JWT + CSRF + service_role key).
- Frontend uses anon key for **reads only**; writes always go through API routes.
- RLS is enabled here as **defense in depth** — when Epoch 1 moves some writes
  to anon role, we tighten policies without re-engineering storage.

If you tighten a policy, update this suite.
