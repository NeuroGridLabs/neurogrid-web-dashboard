/**
 * Streaming Settlement & Reclamation.
 * Hourly epochs: every 1h verified uptime, unlock escrow_usd / expected_hours from Escrow.
 * Kill switch: at expires_at with no renewal -> RECLAIMING, drop tunnel, DESTROY_CONTAINER.
 * Disputes: if offline, refund only unused time to tenant, slash Miner SecurityBuffer.
 */

import type { RentalSession, RentalPhase } from "@/lib/types/escrow"

/**
 * Per-hour amount unlocked from escrow to miner.
 * Pool-based: escrow_usd / expected_hours (not a fixed 95% constant).
 */
export function hourlyUnlockAmountUsd(escrowUsd: number, expectedHours: number): number {
  if (!Number.isFinite(escrowUsd) || !Number.isFinite(expectedHours)) {
    throw new Error("escrowUsd and expectedHours must be finite numbers")
  }
  if (escrowUsd < 0 || expectedHours <= 0) {
    throw new Error("escrowUsd must be non-negative, expectedHours must be positive")
  }
  return escrowUsd / expectedHours
}

/**
 * After 1 hour of verified uptime: unlock that amount from ProtocolEscrow_USDT to miner settlement.
 * Returns the amount to credit to miner for this epoch.
 */
export function settleOneHour(session: RentalSession): number {
  return hourlyUnlockAmountUsd(session.escrow_total_usd, session.expected_hours)
}

/**
 * Whether the rental has reached expires_at with no renewal — trigger kill switch.
 */
export function shouldReclaim(session: RentalSession, now: Date = new Date()): boolean {
  return new Date(session.expires_at) <= now && session.phase === "ACTIVE"
}

/**
 * Transition to RECLAIMING: drop tunnel connection, signal Miner Agent DESTROY_CONTAINER.
 */
export function transitionToReclaiming(session: RentalSession): RentalSession {
  return { ...session, phase: "RECLAIMING" as RentalPhase }
}

/**
 * Dispute (node offline): refund tenant only unused time; slash Miner SecurityBuffer.
 * Returns { refund_tenant_usd, slash_miner_usd }.
 */
export function disputeRefundAndSlash(
  session: RentalSession,
  hoursUsed: number
): { refund_tenant_usd: number; slash_miner_usd: number } {
  if (!Number.isFinite(hoursUsed) || hoursUsed < 0) {
    throw new Error("hoursUsed must be a non-negative finite number")
  }
  const hoursPaid = session.expected_hours
  const unusedHours = Math.max(0, hoursPaid - hoursUsed)
  const refundTenantUsd = unusedHours * session.hourly_price_usd
  // Slash: 1 hour worth from buffer
  const slashMinerUsd = session.hourly_price_usd
  return { refund_tenant_usd: refundTenantUsd, slash_miner_usd: slashMinerUsd }
}
