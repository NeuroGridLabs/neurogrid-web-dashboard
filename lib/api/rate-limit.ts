/**
 * Rate limiter for API routes (B-002 — persistent across Vercel instances).
 *
 * Two-tier strategy:
 * - L1 (memory Map): fast path; catches bursts within a single instance.
 *   Resets on cold start, but a single instance still gets bombarded by repeats.
 * - L2 (Supabase RPC `check_rate_limit`): authoritative, cross-instance.
 *   Atomic upsert in Postgres; survives serverless cold starts.
 *
 * If the DB call fails, we fall back to the L1 memory result (degraded but never blocks).
 */

import { createAdminClient } from "@/lib/supabase/server"

interface RateLimitEntry {
  count: number
  resetAt: number
}

const memStore = new Map<string, RateLimitEntry>()

const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanupMem() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of memStore) {
    if (entry.resetAt <= now) memStore.delete(key)
  }
}

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

function checkMemory(key: string, config: RateLimitConfig): RateLimitResult {
  cleanupMem()
  const now = Date.now()
  const entry = memStore.get(key)

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + config.windowMs
    memStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt }
  }

  entry.count++
  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

interface RpcRow {
  allowed: boolean
  remaining: number
  reset_at: string
}

/**
 * Authoritative async rate-limit check.
 * Hits L1 first (cheap reject path), then L2 (Supabase) for cross-instance correctness.
 *
 * Use this in API routes. If you need a sync check (legacy), use `checkRateLimit`.
 */
export async function checkRateLimitAsync(
  key: string,
  config: RateLimitConfig = RATE_LIMITS.write,
): Promise<RateLimitResult> {
  // L1: if even the local instance has exceeded, no need to round-trip.
  const mem = checkMemory(key, config)
  if (!mem.allowed) return mem

  // L2: authoritative DB check.
  try {
    const db = createAdminClient()
    const { data, error } = await db.raw.rpc("check_rate_limit", {
      p_key: key,
      p_max: config.maxRequests,
      p_window_ms: config.windowMs,
    })
    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      // DB unavailable or function missing — degrade to L1 result.
      return mem
    }
    const row: RpcRow = Array.isArray(data) ? data[0] : data
    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetAt: new Date(row.reset_at).getTime(),
    }
  } catch {
    return mem
  }
}

/**
 * Synchronous in-memory rate limit check.
 * Kept for backward compatibility; prefer `checkRateLimitAsync` in API routes.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = RATE_LIMITS.write,
): RateLimitResult {
  return checkMemory(key, config)
}

export const RATE_LIMITS = {
  /** Write operations: settle, dispute, deploy */
  write: { maxRequests: 10, windowMs: 60_000 } as RateLimitConfig,
  /** Registration */
  register: { maxRequests: 3, windowMs: 60_000 } as RateLimitConfig,
  /** Read-heavy endpoints */
  read: { maxRequests: 60, windowMs: 60_000 } as RateLimitConfig,
}
