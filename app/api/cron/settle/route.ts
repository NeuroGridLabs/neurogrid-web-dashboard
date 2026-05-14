import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/server"
import { hourlyUnlockAmountUsd } from "@/lib/lifecycle/settlement"
import { allocateOrderProfit, bufferCapUsd } from "@/lib/lifecycle/dual-yield"

export const dynamic = "force-dynamic"

const ONE_HOUR_MS = 60 * 60 * 1000

/**
 * Vercel Cron secret — must match CRON_SECRET env var.
 * Prevents unauthorized invocation of the cron endpoint.
 */
function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get("authorization")
  return auth === `Bearer ${secret}`
}

/**
 * GET /api/cron/settle
 *
 * Triggered by Vercel Cron (hourly). Performs two operations:
 * 1. Auto-settle: for all ACTIVE sessions where enough time has passed, settle the next hour
 * 2. Auto-reclaim: for all ACTIVE sessions past expires_at, transition to COMPLETED
 *
 * Protected by CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()
  const now = new Date()
  const results = { settled: 0, reclaimed: 0, errors: [] as string[] }

  const logError = async (
    operation: string,
    message: string,
    sessionId?: string,
    hourIndex?: number,
  ) => {
    results.errors.push(
      `${operation}${sessionId ? ` ${sessionId}` : ""}${hourIndex !== undefined ? ` h${hourIndex}` : ""}: ${message}`,
    )
    Sentry.captureMessage(`cron.${operation}: ${message}`, {
      level: "error",
      tags: { operation, source: "cron-settle" },
      extra: { sessionId, hourIndex },
    })
    try {
      await db.from("settlement_errors").insert({
        operation,
        session_id: sessionId ?? null,
        hour_index: hourIndex ?? null,
        error_message: message,
      })
    } catch {
      // swallow — error logging must never crash the cron itself
    }
  }

  // 1. Load all ACTIVE sessions
  const { data: sessions, error: loadErr } = await db
    .from("rental_sessions")
    .select("*")
    .eq("phase", "ACTIVE")

  if (loadErr || !sessions) {
    await logError("load_sessions", loadErr?.message ?? "unknown error loading sessions")
    return NextResponse.json({ error: "Failed to load sessions", details: results.errors }, { status: 500 })
  }

  for (const session of sessions) {
    const startedAt = new Date(session.started_at)
    const expiresAt = new Date(session.expires_at)
    const elapsedMs = now.getTime() - startedAt.getTime()

    // 2. Auto-reclaim: session expired
    if (expiresAt <= now) {
      try {
        await db
          .from("rental_sessions")
          .update({ phase: "COMPLETED" as const, completed_at: now.toISOString() })
          .eq("id", session.id)
          .eq("phase", "ACTIVE")

        await db
          .from("nodes")
          .update({ lifecycle_status: "IDLE" as const, rented_by: null })
          .eq("id", session.node_id)

        results.reclaimed++
      } catch (e) {
        await logError("reclaim", e instanceof Error ? e.message : "unknown", session.id)
      }
      continue
    }

    // 3. Auto-settle: check if next hour is ready
    const nextHourIndex = session.hours_settled + 1
    if (nextHourIndex > session.expected_hours) continue

    const requiredMs = nextHourIndex * ONE_HOUR_MS
    if (elapsedMs < requiredMs) continue

    try {
      const unlockToMiner = hourlyUnlockAmountUsd(session.escrow_usd, session.expected_hours)

      // Load miner financials
      const { data: financials } = await db
        .from("miner_financials")
        .select("*")
        .eq("wallet_address", session.miner_wallet)
        .eq("node_id", session.node_id)
        .single()

      const currentBufferUsd = financials?.security_buffer_usd ?? 0
      const optIn = financials?.opt_in_buffer_routing ?? false
      const cap = bufferCapUsd(session.hourly_price_usd)
      const { toFreeUsd, toBufferUsd } = allocateOrderProfit(unlockToMiner, currentBufferUsd, cap, optIn)

      // Idempotent insert
      const { error: insertErr } = await db.from("settlement_logs").insert({
        session_id: session.id,
        hour_index: nextHourIndex,
        amount_usd: unlockToMiner,
        free_allocation_usd: toFreeUsd,
        buffer_allocation_usd: toBufferUsd,
      })

      if (insertErr) {
        if (insertErr.code === "23505") continue // Already settled (idempotent)
        throw new Error(insertErr.message)
      }

      // Update session
      await db
        .from("rental_sessions")
        .update({ hours_settled: nextHourIndex })
        .eq("id", session.id)

      // Update miner financials
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
          wallet_address: session.miner_wallet,
          node_id: session.node_id,
          free_balance_usd: toFreeUsd,
          security_buffer_usd: toBufferUsd,
          buffer_locked_since: now.toISOString(),
          opt_in_buffer_routing: false,
          buffer_cap_usd: cap,
          accrued_interest_usd: 0,
        })
      }

      results.settled++
    } catch (e) {
      await logError("settle", e instanceof Error ? e.message : "unknown", session.id, nextHourIndex)
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    active_sessions: sessions.length,
    ...results,
  })
}
