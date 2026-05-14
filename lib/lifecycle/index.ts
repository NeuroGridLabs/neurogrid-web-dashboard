/**
 * NeuroGrid Lifecycle: Pre-Paid Escrow, Streaming Settlement, Dual-Yield.
 * Re-export for backend and shared use.
 */

export {
  computeEscrowBreakdown,
  earlyCancelChargeUsd,
  earlyCancelRefundUsd,
  getCurrentPeriodEnd,
  EXPECTED_HOURS_MIN,
} from "./escrow"
export {
  hourlyUnlockAmountUsd,
  settleOneHour,
  shouldReclaim,
  transitionToReclaiming,
  disputeRefundAndSlash,
} from "./settlement"
export {
  bufferCapUsd,
  allocateOrderProfit,
  canWithdrawBuffer,
  poolApyFree,
  poolApyBuffer,
  accruedInterestUsd,
  computeDualYieldDisplay,
} from "./dual-yield"
