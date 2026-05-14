-- NeuroGrid Protocol — Initial Schema (Epoch 0)
-- 6 core tables with RLS, constraints, and indexes.

-- ============================================================
-- Enums
-- ============================================================

CREATE TYPE node_lifecycle_status AS ENUM ('IDLE', 'LOCKED', 'OFFLINE_VIOLATION', 'VIOLATED');
CREATE TYPE rental_phase AS ENUM ('ACTIVE', 'RECLAIMING', 'DISPUTED', 'COMPLETED');

-- ============================================================
-- 1. nodes — canonical node registry
-- ============================================================

CREATE TABLE nodes (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  gpu              TEXT NOT NULL,
  vram             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'STANDBY',
  lifecycle_status node_lifecycle_status NOT NULL DEFAULT 'IDLE',
  owner_wallet     TEXT NOT NULL,
  is_genesis       BOOLEAN NOT NULL DEFAULT FALSE,
  price_per_hour   NUMERIC(12, 6) NOT NULL CHECK (price_per_hour > 0),
  pending_price    NUMERIC(12, 6),
  utilization      NUMERIC(5, 2) NOT NULL DEFAULT 0,
  bandwidth        TEXT,
  latency_ms       INTEGER,
  rented_by        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nodes_owner ON nodes (owner_wallet);
CREATE INDEX idx_nodes_lifecycle ON nodes (lifecycle_status);
CREATE INDEX idx_nodes_rented ON nodes (rented_by) WHERE rented_by IS NOT NULL;

-- ============================================================
-- 2. miners — registered miner profiles
-- ============================================================

CREATE TABLE miners (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address   TEXT NOT NULL,
  node_id          TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  gpu_model        TEXT NOT NULL,
  vram             TEXT NOT NULL,
  bandwidth        TEXT,
  price_per_hour   NUMERIC(12, 6) NOT NULL CHECK (price_per_hour > 0),
  tunnel_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  registered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (wallet_address, node_id)
);

CREATE INDEX idx_miners_wallet ON miners (wallet_address);

-- ============================================================
-- 3. rental_sessions — active and historical rental records
-- ============================================================

CREATE TABLE rental_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id          TEXT NOT NULL REFERENCES nodes(id),
  tenant_wallet    TEXT NOT NULL,
  miner_wallet     TEXT NOT NULL,
  expected_hours   INTEGER NOT NULL CHECK (expected_hours >= 1),
  hourly_price_usd NUMERIC(12, 6) NOT NULL CHECK (hourly_price_usd > 0),
  escrow_usd       NUMERIC(14, 6) NOT NULL CHECK (escrow_usd >= 0),
  platform_fee_usd NUMERIC(14, 6) NOT NULL CHECK (platform_fee_usd >= 0),
  phase            rental_phase NOT NULL DEFAULT 'ACTIVE',
  hours_settled    INTEGER NOT NULL DEFAULT 0,
  tx_signature     TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rentals_node_active ON rental_sessions (node_id) WHERE phase = 'ACTIVE';
CREATE INDEX idx_rentals_tenant ON rental_sessions (tenant_wallet);
CREATE INDEX idx_rentals_miner ON rental_sessions (miner_wallet);
CREATE INDEX idx_rentals_expires ON rental_sessions (expires_at) WHERE phase = 'ACTIVE';

-- ============================================================
-- 4. settlement_logs — hourly settlement records (idempotent)
-- ============================================================

CREATE TABLE settlement_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES rental_sessions(id) ON DELETE CASCADE,
  hour_index            INTEGER NOT NULL CHECK (hour_index >= 0),
  amount_usd            NUMERIC(14, 6) NOT NULL CHECK (amount_usd >= 0),
  free_allocation_usd   NUMERIC(14, 6) NOT NULL CHECK (free_allocation_usd >= 0),
  buffer_allocation_usd NUMERIC(14, 6) NOT NULL CHECK (buffer_allocation_usd >= 0),
  settled_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Idempotency: one settlement per hour per session (fixes C-API-02)
  UNIQUE (session_id, hour_index)
);

CREATE INDEX idx_settlements_session ON settlement_logs (session_id);

-- ============================================================
-- 5. miner_financials — dual-yield pool balances
-- ============================================================

CREATE TABLE miner_financials (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address        TEXT NOT NULL,
  node_id               TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  free_balance_usd      NUMERIC(14, 6) NOT NULL DEFAULT 0 CHECK (free_balance_usd >= 0),
  security_buffer_usd   NUMERIC(14, 6) NOT NULL DEFAULT 0 CHECK (security_buffer_usd >= 0),
  buffer_locked_since   TIMESTAMPTZ,
  opt_in_buffer_routing BOOLEAN NOT NULL DEFAULT FALSE,
  buffer_cap_usd        NUMERIC(14, 6) NOT NULL DEFAULT 0,
  accrued_interest_usd  NUMERIC(14, 6) NOT NULL DEFAULT 0 CHECK (accrued_interest_usd >= 0),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (wallet_address, node_id)
);

CREATE INDEX idx_financials_wallet ON miner_financials (wallet_address);

-- ============================================================
-- 6. disputes — dispute resolution records
-- ============================================================

CREATE TABLE disputes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES rental_sessions(id) ON DELETE CASCADE,
  filed_by          TEXT NOT NULL,
  hours_used        INTEGER NOT NULL CHECK (hours_used >= 0),
  refund_tenant_usd NUMERIC(14, 6) NOT NULL CHECK (refund_tenant_usd >= 0),
  slash_miner_usd   NUMERIC(14, 6) NOT NULL CHECK (slash_miner_usd >= 0),
  resolved_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One dispute per session
  UNIQUE (session_id)
);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nodes_updated_at
  BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_miners_updated_at
  BEFORE UPDATE ON miners FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_financials_updated_at
  BEFORE UPDATE ON miner_financials FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE miners ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE miner_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Nodes: everyone can read, only owner can modify
CREATE POLICY nodes_select ON nodes FOR SELECT USING (true);
CREATE POLICY nodes_insert ON nodes FOR INSERT WITH CHECK (true);
CREATE POLICY nodes_update ON nodes FOR UPDATE USING (true);

-- Miners: everyone can read, insert requires matching wallet (enforced at API)
CREATE POLICY miners_select ON miners FOR SELECT USING (true);
CREATE POLICY miners_insert ON miners FOR INSERT WITH CHECK (true);
CREATE POLICY miners_update ON miners FOR UPDATE USING (true);
CREATE POLICY miners_delete ON miners FOR DELETE USING (true);

-- Rental sessions: public read, create/update via API (service role)
CREATE POLICY rentals_select ON rental_sessions FOR SELECT USING (true);
CREATE POLICY rentals_insert ON rental_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY rentals_update ON rental_sessions FOR UPDATE USING (true);

-- Settlement logs: public read, insert via service role
CREATE POLICY settlements_select ON settlement_logs FOR SELECT USING (true);
CREATE POLICY settlements_insert ON settlement_logs FOR INSERT WITH CHECK (true);

-- Miner financials: public read, modify via service role
CREATE POLICY financials_select ON miner_financials FOR SELECT USING (true);
CREATE POLICY financials_insert ON miner_financials FOR INSERT WITH CHECK (true);
CREATE POLICY financials_update ON miner_financials FOR UPDATE USING (true);

-- Disputes: public read, insert via service role
CREATE POLICY disputes_select ON disputes FOR SELECT USING (true);
CREATE POLICY disputes_insert ON disputes FOR INSERT WITH CHECK (true);

-- ============================================================
-- Seed: Alpha-01 Foundation Genesis Node
-- ============================================================

INSERT INTO nodes (id, name, gpu, vram, status, lifecycle_status, owner_wallet, is_genesis, price_per_hour)
VALUES (
  'alpha-01',
  'Alpha-01',
  '1x RTX 4090',
  '24GB',
  'STANDBY',
  'IDLE',
  '8KRqwem4WFs1JtTK7oQSDvEKqB8e1DkqygSLbb9StBva',
  TRUE,
  0.59
)
ON CONFLICT (id) DO NOTHING;
