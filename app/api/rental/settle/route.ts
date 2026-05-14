import { NextRequest, NextResponse } from "next/server"
import { requireWalletAuth } from "@/lib/auth/middleware"
import { validateBody } from "@/lib/api/validate"
import { settleBodySchema } from "@/lib/validations/rental"
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/api/rate-limit"
import { validateCsrf } from "@/lib/api/csrf"
import { createAdminClient } from "@/lib/supabase/server"
import { hourlyUnlockAmountUsd } from "@/lib/lifecycle/settlement"
import { allocateOrderProfit, bufferCapUsd } from "@/lib/lifecycle/dual-yield"

export const dynamic = "force-dynamic"

const ONE_HOUR_MS = 60 * 60 * 1000

/**
 * POST: Execute one hourly settlement step.
 * Authenticated + DB-backed + idempotent (UNIQUE session_id + hour_index).
 */
export async function POST(request: NextRequest) {
  // 1. Auth
  const authResult = await requireWalletAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const wallet = authResult.sub

  // 2. CSRF
  const csrfErr = validateCsrf(request)
  if (csrfErr) return csrfErr

  // 3. Rate limit
  const rl = await checkRateLimitAsync(`settle:${wallet}`, RATE_LIMITS.write)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 3. Validate body
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = validateBody(settleBodySchema, rawBody)
  if (!parsed.success) return parsed.response
  const body = parsed.data

  const db = createAdminClient()

  // 4. Load session from DB
  const { data: session, error: sessErr } = await db
    .from("rental_sessions")
    .select("*")
    .eq("id", body.session_id)
    .single()

  if (sessErr || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  // 5. Ownership: caller must be miner_wallet for this session
  if (session.miner_wallet !== wallet) {
    return NextResponse.json(
      { error: "Only the session miner can settle" },
      { status: 403 },
    )
  }

  // 6. Phase check
  if (session.phase !== "ACTIVE") {
    return NextResponse.json(
      { error: `Cannot settle: session is ${session.phase}` },
      { status: 409 },
    )
  }

  // 7. 1-hour minimum check
  const now = new Date()
  const startedAt = new Date(session.started_at)
  const elapsedMs = now.getTime() - startedAt.getTime()
  if (elapsedMs < ONE_HOUR_MS) {
    return NextResponse.json(
      {
        error: "1-Hour Minimum: settlement not allowed until 1 hour has elapsed.",
        elapsed_seconds: Math.floor(elapsedMs / 1000),
      },
      { status: 400 },
    )
  }

  // 8. Determine next hour_index to settle
  const nextHourIndex = session.hours_settled + 1
  if (nextHourIndex > session.expected_hours) {
    return NextResponse.json(
      { error: "All hours already settled" },
      { status: 409 },
    )
  }

  // Ensure enough real time has passed for this hour_index
  const requiredMs = nextHourIndex * ONE_HOUR_MS
  if (elapsedMs < requiredMs) {
    return NextResponse.json(
      {
        error: `Hour ${nextHourIndex} not yet settleable`,
        next_settle_at: new Date(startedAt.getTime() + requiredMs).toISOString(),
      },
      { status: 400 },
    )
  }

  // 9. Pool-based unlock: escrow_usd / expected_hours
  const unlockToMiner = hourlyUnlockAmountUsd(session.escrow_usd, session.expected_hours)

  // 10. Load miner financials for dual-yield allocation
  const { data: financials } = await db
    .from("miner_financials")
    .select("*")
    .eq("wallet_address", wallet)
    .eq("node_id", session.node_id)
    .single()

  const currentBufferUsd = financials?.security_buffer_usd ?? 0
  const optIn = financials?.opt_in_buffer_routing ?? body.opt_in_buffer_routing ?? false
  const cap = bufferCapUsd(session.hourly_price_usd)
  const { toFreeUsd, toBufferUsd } = allocateOrderProfit(unlockToMiner, currentBufferUsd, cap, optIn)

  // 11. Idempotent insert: UNIQUE(session_id, hour_index) prevents double-settlement
  const { error: insertErr } = await db.from("settlement_logs").insert({
    session_id: session.id,
    hour_index: nextHourIndex,
    amount_usd: unlockToMiner,
    free_allocation_usd: toFreeUsd,
    buffer_allocation_usd: toBufferUsd,
  })

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { error: "Hour already settled (idempotent)", hour_index: nextHourIndex },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: "Settlement insert failed" }, { status: 500 })
  }

  // 12. Update session hours_settled
  await db
    .from("rental_sessions")
    .update({ hours_settled: nextHourIndex })
    .eq("id", session.id)

  // 13. Update miner financials
  if (financials) {
    await db
      .from("miner_financials")
      .update({
        free_balance_usd: financials.free_balance_usd + toFreeUsd,
        security_buffer_usd: financials.security_buffer_usd + toBufferUsd,
      })
      .eq("id", financials.id)
  } else {
    await db.from("miner_financials").insert({
      wallet_address: wallet,
      node_id: session.node_id,
      free_balance_usd: toFreeUsd,
      security_buffer_usd: toBufferUsd,
      buffer_locked_since: new Date().toISOString(),
      opt_in_buffer_routing: optIn,
      buffer_cap_usd: cap,
      accrued_interest_usd: 0,
    })
  }

  return NextResponse.json({
    session_id: session.id,
    hour_index: nextHourIndex,
    unlock_to_miner_usd: unlockToMiner,
    to_free_balance_usd: toFreeUsd,
    to_security_buffer_usd: toBufferUsd,
    buffer_cap_usd: cap,
    hours_settled: nextHourIndex,
    hours_remaining: session.expected_hours - nextHourIndex,
  })
}
