/**
 * Pre-Paid Escrow & Anti-Churn (tenant side).
 * Deployment requires expected_hours (min 1). Lock 100% USDT upfront.
 * Split: 5% -> PendingBatchBuybackPool, 95% -> ProtocolEscrow_USDT.
 * Early cancellation charges minimum 1 full hour.
 */

import type { EscrowBreakdown } from "@/lib/types/escrow"
import {
  ANTI_CHURN_MIN_HOURS,
  PLATFORM_FEE_RATE,
} from "@/lib/types/escrow"

export const EXPECTED_HOURS_MIN = 1

/**
 * Compute escrow breakdown for a deployment.
 * total_usd = expected_hours * hourly_price_usd.
 * platform_fee = 5%, escrow = 95%.
 * Throws on invalid inputs (negative, zero price, NaN).
 */
export function computeEscrowBreakdown(
  expectedHours: number,
  hourlyPriceUsd: number,
  startedAt: Date = new Date()
): EscrowBreakdown {
  if (!Number.isFinite(expectedHours) || !Number.isFinite(hourlyPriceUsd)) {
    throw new Error("expectedHours and hourlyPriceUsd must be finite numbers")
  }
  if (hourlyPriceUsd <= 0) {
    throw new Error("hourlyPriceUsd must be positive")
  }

  const hours = Math.max(EXPECTED_HOURS_MIN, Math.floor(expectedHours))
  const totalUsd = hours * hourlyPriceUsd
  const platformFeeUsd = totalUsd * PLATFORM_FEE_RATE
  const escrowUsd = totalUsd - platformFeeUsd

  const expiresAt = new Date(startedAt)
  expiresAt.setHours(expiresAt.getHours() + hours)

  return {
    expected_hours: hours,
    hourly_price_usd: hourlyPriceUsd,
    total_usd: totalUsd,
    platform_fee_usd: platformFeeUsd,
    escrow_usd: escrowUsd,
    expires_at: expiresAt.toISOString(),
  }
}

/**
 * Anti-churn: early cancellation charges at least 1 full hour.
 * Returns the USD amount to charge (non-refundable); remainder is refunded from escrow.
 * Throws on invalid inputs.
 */
export function earlyCancelChargeUsd(
  hourlyPriceUsd: number,
  hoursUsed: number,
  hoursPaid: number
): number {
  if (!Number.isFinite(hourlyPriceUsd) || !Number.isFinite(hoursUsed) || !Number.isFinite(hoursPaid)) {
    throw new Error("All parameters must be finite numbers")
  }
  if (hourlyPriceUsd <= 0 || hoursUsed < 0 || hoursPaid <= 0) {
    throw new Error("hourlyPriceUsd and hoursPaid must be positive, hoursUsed must be non-negative")
  }

  const hoursToCharge = Math.min(
    hoursPaid,
    Math.max(ANTI_CHURN_MIN_HOURS, Math.ceil(hoursUsed))
  )
  return hoursToCharge * hourlyPriceUsd
}

/**
 * Refund to tenant on early cancel: (hours_paid - hours_charged) * hourly_price.
 * Escrow releases that amount back to tenant; the rest stays with protocol/miner per settlement.
 */
export function earlyCancelRefundUsd(
  hourlyPriceUsd: number,
  hoursPaid: number,
  hoursCharged: number
): number {
  const refundHours = Math.max(0, hoursPaid - hoursCharged)
  return refundHours * hourlyPriceUsd
}

const MS_PER_HOUR = 60 * 60 * 1000

/**
 * End of the current billing hour (for hourly alignment).
 * When tenant undeploys, eviction time = end of the current paid hour.
 * e.g. locked_at 9:45, now 10:20 → period end 10:45.
 * Returns error string on invalid ISO input.
 */
export function getCurrentPeriodEnd(lockedAtIso: string, now: Date = new Date()): string {
  const lockedMs = new Date(lockedAtIso).getTime()
  if (Number.isNaN(lockedMs)) {
    throw new Error(`Invalid ISO date: ${lockedAtIso}`)
  }
  const nowMs = now.getTime()
  const elapsed = nowMs - lockedMs
  if (elapsed < 0) {
    return new Date(lockedMs + MS_PER_HOUR).toISOString()
  }
  const elapsedHours = Math.floor(elapsed / MS_PER_HOUR)
  // If exactly on an hour boundary, we're at the start of a new period
  const isExactBoundary = elapsed > 0 && elapsed % MS_PER_HOUR === 0
  const periodsElapsed = isExactBoundary ? elapsedHours : elapsedHours + 1
  const periodEndMs = lockedMs + periodsElapsed * MS_PER_HOUR
  return new Date(periodEndMs).toISOString()
}
