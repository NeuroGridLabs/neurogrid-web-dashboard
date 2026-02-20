/**
 * Streaming Settlement & Reclamation.
 * Hourly epochs: every 1h verified uptime, unlock HourlyPrice * 0.95 from Escrow.
 * Kill switch: at expires_at with no renewal -> RECLAIMING, drop tunnel, DESTROY_CONTAINER.
 * Disputes: if offline, refund only unused time to tenant, slash Miner SecurityBuffer.
 */

import type { RentalSession, RentalPhase } from "@/lib/types/escrow"
import { MINER_ORDER_SHARE } from "@/lib/types/escrow"

/**
 * Per-hour amount unlocked from escrow to miner (95% of hourly price).
 */
export function hourlyUnlockAmountUsd(hourlyPriceUsd: number): number {
  return hourlyPriceUsd * MINER_ORDER_SHARE
}

/**
 * After 1 hour of verified uptime: unlock that amount from ProtocolEscrow_USDT to miner settlement.
 * Returns the amount to credit to miner for this epoch.
 */
export function settleOneHour(session: RentalSession): number {
  return hourlyUnlockAmountUsd(session.hourly_price_usd)
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
  const hoursPaid = session.expected_hours
  const unusedHours = Math.max(0, hoursPaid - hoursUsed)
  const refundTenantUsd = unusedHours * session.hourly_price_usd
  // Slash: protocol can define amount (e.g. proportional to dispute or fixed). Here we use 1 hour worth from buffer.
  const slashMinerUsd = session.hourly_price_usd
  return { refund_tenant_usd: refundTenantUsd, slash_miner_usd: slashMinerUsd }
}
