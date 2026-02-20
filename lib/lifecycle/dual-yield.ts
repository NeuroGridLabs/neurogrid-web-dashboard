/**
 * Dual-Yield Engine (Golden Handcuffs).
 * POOL A: Free Balance — liquid, withdrawable anytime; graduated APY.
 * POOL B: Security Buffer — 10% of order until cap 100*hourly_price; opt-in continuous lock; 7-day cooldown after UNREGISTER; graduated APY.
 */

import type { MinerDualYield } from "@/lib/types/escrow"
import {
  SECURITY_BUFFER_RATE,
  SECURITY_BUFFER_HOURS_MULTIPLIER,
  SECURITY_BUFFER_COOLDOWN_DAYS,
  POOL_A_APY_TIERS,
  POOL_B_APY_TIERS,
} from "@/lib/types/escrow"

/**
 * Buffer cap for a node: 100 * hourly_price.
 */
export function bufferCapUsd(hourlyPriceUsd: number): number {
  return SECURITY_BUFFER_HOURS_MULTIPLIER * hourlyPriceUsd
}

/**
 * From an order profit (95% of hourly price per hour, or single order amount):
 * 10% goes to Security Buffer until buffer reaches cap; rest to Free Balance.
 */
export function allocateOrderProfit(
  orderProfitUsd: number,
  currentBufferUsd: number,
  bufferCapUsd: number,
  optInBufferRouting: boolean
): { toFreeUsd: number; toBufferUsd: number } {
  const toBufferRate = optInBufferRouting ? SECURITY_BUFFER_RATE : 0
  const headroom = Math.max(0, bufferCapUsd - currentBufferUsd)
  const toBufferUsd = Math.min(
    headroom,
    orderProfitUsd * (currentBufferUsd < bufferCapUsd ? SECURITY_BUFFER_RATE : toBufferRate)
  )
  const toFreeUsd = orderProfitUsd - toBufferUsd
  return { toFreeUsd, toBufferUsd }
}

/**
 * Base requirement: always deduct 10% from every order until buffer reaches cap.
 * After cap, if opt-in, keep routing 10% to buffer; else all to free.
 */
export function allocateOrderProfitStrict(
  orderProfitUsd: number,
  currentBufferUsd: number,
  bufferCapUsd: number,
  optInBufferRouting: boolean
): { toFreeUsd: number; toBufferUsd: number } {
  const needMore = Math.max(0, bufferCapUsd - currentBufferUsd)
  const mandatoryBuffer = Math.min(needMore, orderProfitUsd * SECURITY_BUFFER_RATE)
  const remaining = orderProfitUsd - mandatoryBuffer
  const optionalBuffer = optInBufferRouting
    ? remaining * SECURITY_BUFFER_RATE
    : 0
  const toBufferUsd = mandatoryBuffer + optionalBuffer
  const toFreeUsd = orderProfitUsd - toBufferUsd
  return { toFreeUsd, toBufferUsd }
}

/**
 * Can withdraw Security Buffer only if node is UNREGISTERED and 7-day cooldown has passed.
 */
export function canWithdrawBuffer(
  nodeRegistered: boolean,
  unregisteredAt: string | null
): boolean {
  if (nodeRegistered || !unregisteredAt) return false
  const cooldownEnd = new Date(unregisteredAt)
  cooldownEnd.setDate(cooldownEnd.getDate() + SECURITY_BUFFER_COOLDOWN_DAYS)
  return new Date() >= cooldownEnd
}

/**
 * APY tier by days (since lock or since first deposit for buffer).
 */
function getApyForDays(
  daysHeld: number,
  tiers: readonly { daysMin: number; daysMax: number; apy: number }[]
): number {
  for (const t of tiers) {
    if (daysHeld >= t.daysMin && daysHeld <= t.daysMax) return t.apy
  }
  return tiers[tiers.length - 1]?.apy ?? 0
}

/**
 * POOL A: Free Balance APY (0–30d 0.3%, 31–90d 0.8%, 90+d 1.5%).
 */
export function poolApyFree(daysHeld: number): number {
  return getApyForDays(daysHeld, POOL_A_APY_TIERS)
}

/**
 * POOL B: Security Buffer APY (0–30d 0.3%, 31–90d 1.0%, 90+d 3.0%).
 */
export function poolApyBuffer(daysHeld: number): number {
  return getApyForDays(daysHeld, POOL_B_APY_TIERS)
}

/**
 * Accrued interest (simplified: principal * apy * (days/365)).
 */
export function accruedInterestUsd(
  principalUsd: number,
  apy: number,
  daysHeld: number
): number {
  if (principalUsd <= 0 || daysHeld <= 0) return 0
  return principalUsd * apy * (daysHeld / 365)
}

/**
 * Compute display APY and accrued interest for a miner's dual-yield state.
 */
export function computeDualYieldDisplay(
  freeBalanceUsd: number,
  securityBufferUsd: number,
  bufferLockedSince: string | null
): { freeApy: number; bufferApy: number; accruedInterestUsd: number } {
  const now = new Date()
  const bufferDays = bufferLockedSince
    ? Math.max(0, (now.getTime() - new Date(bufferLockedSince).getTime()) / (24 * 60 * 60 * 1000))
    : 0
  const freeApy = poolApyFree(bufferDays)
  const bufferApy = poolApyBuffer(bufferDays)
  const accruedFree = accruedInterestUsd(freeBalanceUsd, freeApy, bufferDays)
  const accruedBuffer = accruedInterestUsd(securityBufferUsd, bufferApy, bufferDays)
  return {
    freeApy,
    bufferApy,
    accruedInterestUsd: accruedFree + accruedBuffer,
  }
}
