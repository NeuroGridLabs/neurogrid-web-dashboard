/**
 * NeuroGrid Lifecycle, Pre-Paid Escrow & Dual-Yield types.
 * Backend logic: tenant escrow, streaming settlement, reclamation, miner Pool A/B.
 */

/** Rental phase beyond IDLE/LOCKED: reclamation and kill-switch. */
export type RentalPhase =
  | "ACTIVE"       // tenant active, streaming settlement
  | "RECLAIMING"   // expires_at reached, no renewal; drop tunnel, signal DESTROY_CONTAINER
  | "DISPUTED"     // offline dispute; refund tenant unused, slash miner buffer
  | "COMPLETED"    // normal end or reclaimed

/** Single rental session: pre-paid escrow + streaming. */
export interface RentalSession {
  id: string
  node_id: string
  tenant_address: string
  /** Hours paid upfront (min 1). */
  expected_hours: number
  /** Hourly price at deploy (USDT). */
  hourly_price_usd: number
  /** When the rental started (ISO). */
  started_at: string
  /** When the rental ends if not renewed (ISO). Kill switch triggers here. */
  expires_at: string
  phase: RentalPhase
  /** Hours already settled (unlocked to miner). */
  hours_settled: number
  /** Platform fee (5%) for this session, sent to PendingBatchBuybackPool. */
  platform_fee_usd: number
  /** Total USDT locked in ProtocolEscrow_USDT at deploy. */
  escrow_total_usd: number
}

/** Pre-paid escrow breakdown at deploy (for API response / UI). */
export interface EscrowBreakdown {
  expected_hours: number
  hourly_price_usd: number
  /** Total charge = expected_hours * hourly_price_usd. */
  total_usd: number
  /** 5% -> PendingBatchBuybackPool ($NRG treasury buys). */
  platform_fee_usd: number
  /** 95% -> ProtocolEscrow_USDT. */
  escrow_usd: number
  expires_at: string
}

/** Anti-churn: early cancellation always charges at least this many hours. */
export const ANTI_CHURN_MIN_HOURS = 1

/** Platform fee share (5%). */
export const PLATFORM_FEE_BPS = 500 // 5.00%
export const PLATFORM_FEE_RATE = 0.05

/** Miner share of each order (95% before buffer deduction). */
export const MINER_ORDER_SHARE = 0.95

/** Security buffer: 10% of order until cap. */
export const SECURITY_BUFFER_RATE = 0.1
/** Cap = 100 * hourly_price (per node). */
export const SECURITY_BUFFER_HOURS_MULTIPLIER = 100

/** Withdraw Security Buffer only when node UNREGISTERED + this cooldown (days). */
export const SECURITY_BUFFER_COOLDOWN_DAYS = 7

/** POOL A: Free Balance (profits) — graduated APY (annual). */
export const POOL_A_APY_TIERS = [
  { daysMin: 0, daysMax: 30, apy: 0.003 },
  { daysMin: 31, daysMax: 90, apy: 0.008 },
  { daysMin: 90, daysMax: Infinity, apy: 0.015 },
] as const

/** POOL B: Security Buffer (locked) — graduated APY. */
export const POOL_B_APY_TIERS = [
  { daysMin: 0, daysMax: 30, apy: 0.003 },
  { daysMin: 31, daysMax: 90, apy: 0.01 },
  { daysMin: 90, daysMax: Infinity, apy: 0.03 },
] as const

/** Miner dual-yield state (per node or aggregate). */
export interface MinerDualYield {
  /** POOL A: liquid, withdrawable anytime. */
  free_balance_usd: number
  /** POOL B: locked until UNREGISTERED + 7-day cooldown. */
  security_buffer_usd: number
  /** When buffer was first locked (for APY tier). */
  buffer_locked_since: string | null
  /** If true, miner keeps routing 10% of order profits into buffer for high yield. */
  opt_in_buffer_routing: boolean
  /** Required buffer cap for this node: 100 * hourly_price. */
  buffer_cap_usd: number
  /** Accrued interest (display). */
  accrued_interest_usd: number
}
