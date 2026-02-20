/**
 * NeuroGrid Lifecycle: Pre-Paid Escrow, Streaming Settlement, Dual-Yield.
 * Re-export for backend and shared use.
 */

export {
  computeEscrowBreakdown,
  earlyCancelChargeUsd,
  earlyCancelRefundUsd,
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
  allocateOrderProfitStrict,
  canWithdrawBuffer,
  poolApyFree,
  poolApyBuffer,
  accruedInterestUsd,
  computeDualYieldDisplay,
} from "./dual-yield"
