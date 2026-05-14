/**
 * Supabase Database type definitions — generated from schema.
 * Keep in sync with supabase/migrations/ SQL.
 *
 * In production, regenerate with:
 *   npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts
 */

export type NodeLifecycleStatus = "IDLE" | "LOCKED" | "OFFLINE_VIOLATION" | "VIOLATED"
export type RentalPhase = "ACTIVE" | "RECLAIMING" | "DISPUTED" | "COMPLETED"

/* ── Row types (full DB row) ─────────────────────────────── */

export interface MinerRow {
  id: string
  wallet_address: string
  node_id: string
  gpu_model: string
  vram: string
  bandwidth: string | null
  price_per_hour: number
  tunnel_verified: boolean
  registered_at: string
  updated_at: string
}

export interface NodeRow {
  id: string
  name: string
  gpu: string
  vram: string
  status: string
  lifecycle_status: NodeLifecycleStatus
  owner_wallet: string
  is_genesis: boolean
  price_per_hour: number
  pending_price: number | null
  utilization: number
  bandwidth: string | null
  latency_ms: number | null
  rented_by: string | null
  created_at: string
  updated_at: string
}

export interface RentalSessionRow {
  id: string
  node_id: string
  tenant_wallet: string
  miner_wallet: string
  expected_hours: number
  hourly_price_usd: number
  escrow_usd: number
  platform_fee_usd: number
  phase: RentalPhase
  hours_settled: number
  tx_signature: string | null
  started_at: string
  expires_at: string
  completed_at: string | null
  created_at: string
}

export interface SettlementLogRow {
  id: string
  session_id: string
  hour_index: number
  amount_usd: number
  free_allocation_usd: number
  buffer_allocation_usd: number
  settled_at: string
}

export interface MinerFinancialsRow {
  id: string
  wallet_address: string
  node_id: string
  free_balance_usd: number
  security_buffer_usd: number
  buffer_locked_since: string | null
  opt_in_buffer_routing: boolean
  buffer_cap_usd: number
  accrued_interest_usd: number
  updated_at: string
}

export interface DisputeRow {
  id: string
  session_id: string
  filed_by: string
  hours_used: number
  refund_tenant_usd: number
  slash_miner_usd: number
  resolved_at: string
}

export interface SettlementErrorRow {
  id: string
  occurred_at: string
  operation: string
  session_id: string | null
  hour_index: number | null
  error_message: string
  resolved: boolean
  resolved_at: string | null
  notes: string | null
}

/* ── Insert types (omit auto-generated fields) ───────────── */

export type MinerInsert = Omit<MinerRow, "id" | "registered_at" | "updated_at">
export type NodeInsert = Omit<NodeRow, "created_at" | "updated_at">
export type RentalSessionInsert = Omit<RentalSessionRow, "id" | "hours_settled" | "completed_at" | "created_at"> & {
  id?: string
}
export type SettlementLogInsert = Omit<SettlementLogRow, "id" | "settled_at">
export type MinerFinancialsInsert = Omit<MinerFinancialsRow, "id" | "updated_at">
export type DisputeInsert = Omit<DisputeRow, "id" | "resolved_at">
export type SettlementErrorInsert = Omit<
  SettlementErrorRow,
  "id" | "occurred_at" | "resolved" | "resolved_at" | "notes"
> & {
  resolved?: boolean
  notes?: string | null
}

/* ── Update types ────────────────────────────────────────── */

export type MinerUpdate = Partial<MinerInsert>
export type NodeUpdate = Partial<NodeInsert>
export type RentalSessionUpdate = Partial<RentalSessionInsert>
export type SettlementLogUpdate = Partial<SettlementLogInsert>
export type MinerFinancialsUpdate = Partial<MinerFinancialsInsert>
export type DisputeUpdate = Partial<DisputeInsert>
export type SettlementErrorUpdate = Partial<SettlementErrorInsert> & {
  resolved?: boolean
  resolved_at?: string | null
  notes?: string | null
}

/* ── Database schema (Supabase client generic) ───────────── */

export interface Database {
  public: {
    Tables: {
      miners: {
        Row: MinerRow
        Insert: MinerInsert
        Update: MinerUpdate
      }
      nodes: {
        Row: NodeRow
        Insert: NodeInsert
        Update: NodeUpdate
      }
      rental_sessions: {
        Row: RentalSessionRow
        Insert: RentalSessionInsert
        Update: RentalSessionUpdate
      }
      settlement_logs: {
        Row: SettlementLogRow
        Insert: SettlementLogInsert
        Update: SettlementLogUpdate
      }
      miner_financials: {
        Row: MinerFinancialsRow
        Insert: MinerFinancialsInsert
        Update: MinerFinancialsUpdate
      }
      disputes: {
        Row: DisputeRow
        Insert: DisputeInsert
        Update: DisputeUpdate
      }
      settlement_errors: {
        Row: SettlementErrorRow
        Insert: SettlementErrorInsert
        Update: SettlementErrorUpdate
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      node_lifecycle_status: NodeLifecycleStatus
      rental_phase: RentalPhase
    }
  }
}
