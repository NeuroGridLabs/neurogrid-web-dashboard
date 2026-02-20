import type { BadgeStatus } from "@/components/atoms/status-badge"

/** Lifecycle state for compute lock-in model (Didi/Uber style). */
export type NodeLifecycleStatus = "IDLE" | "LOCKED" | "OFFLINE_VIOLATION" | "VIOLATED"

/** Current vs next-tenant price; when LOCKED, tenant pays locked_price until undeploy. */
export interface PriceConfig {
  current_hourly_usd: number
  /** Set by miner when LOCKED; applied to current_hourly_usd when tenant undeploys. */
  pending_hourly_usd: number | null
}

/** Miner financials (performance bond, yield). Aligned with dual-yield: Pool A = free, Pool B = buffer. */
export interface NodeFinancials {
  earned_nrg: number
  /** POOL B: Security Buffer (locked until UNREGISTERED + 7-day cooldown). */
  security_buffer_usd: number
  accrued_interest: number
  /** POOL A: Free balance (withdrawable anytime). Optional; present when lifecycle backend is used. */
  free_balance_usd?: number
  /** When buffer was first locked (ISO); for APY tier. */
  buffer_locked_since?: string | null
  /** Miner opts to keep routing 10% of order profits into buffer for high yield. */
  opt_in_buffer_routing?: boolean
  /** Buffer cap for this node: 100 * hourly_price. */
  buffer_cap_usd?: number
}

/** Captured at deploy; tenant pays locked_price until undeploy. */
export interface LockMetadata {
  tenant_address: string
  locked_at: string
  locked_price: number
}

/** Production node from backend. All fields from API; no mock defaults. */
export interface Node {
  id: string
  name: string
  gpus: string
  vram: string
  status: BadgeStatus
  utilization: number
  bandwidth: string
  latencyMs: number
  isGenesis?: boolean
  /** True when node is the Official Foundation Seed Node (Alpha-01); shows Provider + VERIFIED GENESIS badge */
  isFoundationSeed?: boolean
  /** Wallet address that rented this node; null = available */
  rentedBy: string | null
  gateway?: string
  port?: number
  /** Miner wallet address — receives 95% of payment (SPL USDT) */
  minerWalletAddress: string
  /** Price in USDT (human amount, e.g. 0.59 for $0.59/hr). Used for SPL transfer with 6 decimals. */
  priceInUSDT: number
  /** Display string e.g. "$0.59/hr" — can be derived from priceInUSDT */
  pricePerHour: string
  /** Lifecycle for lock-in model; when LOCKED, tenant pays locked_price from lock_metadata. */
  lifecycleStatus?: NodeLifecycleStatus
  /** Current vs pending price (miner-facing). */
  price_config?: PriceConfig
  /** Miner earnings and bond. */
  financials?: NodeFinancials
  /** Set at deploy; tenant pays locked_price until undeploy. */
  lock_metadata?: LockMetadata | null
}
