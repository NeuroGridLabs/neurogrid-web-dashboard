/**
 * Shared types barrel. Prefer direct imports for tree-shaking when needed:
 * - import type { Node } from '@/lib/types/node'
 * - import type { RentalSession } from '@/lib/types/escrow'
 * Or use this barrel: import type { Node, RentalSession } from '@/lib/types'
 */

export type {
  NodeLifecycleStatus,
  PriceConfig,
  NodeFinancials,
  LockMetadata,
  Node,
} from "./node"

export type {
  RentalPhase,
  RentalSession,
  EscrowBreakdown,
  MinerDualYield,
} from "./escrow"

export {
  ANTI_CHURN_MIN_HOURS,
  PLATFORM_FEE_BPS,
  PLATFORM_FEE_RATE,
  MINER_ORDER_SHARE,
  SECURITY_BUFFER_RATE,
  SECURITY_BUFFER_HOURS_MULTIPLIER,
  SECURITY_BUFFER_COOLDOWN_DAYS,
  POOL_A_APY_TIERS,
  POOL_B_APY_TIERS,
} from "./escrow"
