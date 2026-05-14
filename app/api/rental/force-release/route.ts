import { NextRequest, NextResponse } from "next/server"
import { requireWalletAuth } from "@/lib/auth/middleware"
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/api/rate-limit"
import { validateCsrf } from "@/lib/api/csrf"
import { createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * POST: Force emergency release of a rental session.
 * Only the miner can trigger this. Session transitions to COMPLETED,
 * node goes to VIOLATED state, 50% of security buffer is slashed.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireWalletAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const wallet = authResult.sub

  const csrfErr = validateCsrf(request)
  if (csrfErr) return csrfErr

  const rl = await checkRateLimitAsync(`force-release:${wallet}`, RATE_LIMITS.write)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const body = rawBody as { session_id?: string }
  if (!body.session_id || typeof body.session_id !== "string") {
    return NextResponse.json({ error: "session_id required" }, { status: 400 })
  }

  const db = createAdminClient()

  const { data: session, error: sessErr } = await db
    .from("rental_sessions")
    .select("*")
    .eq("id", body.session_id)
    .single()

  if (sessErr || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (session.miner_wallet !== wallet) {
    return NextResponse.json({ error: "Only the miner can force release" }, { status: 403 })
  }

  if (session.phase !== "ACTIVE") {
    return NextResponse.json(
      { error: `Cannot force release: session is ${session.phase}` },
      { status: 409 },
    )
  }

  // Transition session to COMPLETED
  await db
    .from("rental_sessions")
    .update({ phase: "COMPLETED" as const, completed_at: new Date().toISOString() })
    .eq("id", session.id)

  // Set node to VIOLATED (not IDLE — this was a forced release)
  await db
    .from("nodes")
    .update({ lifecycle_status: "VIOLATED" as const, rented_by: null })
    .eq("id", session.node_id)

  // Slash 50% of miner's security buffer
  const { data: financials } = await db
    .from("miner_financials")
    .select("*")
    .eq("wallet_address", wallet)
    .eq("node_id", session.node_id)
    .single()

  if (financials) {
    const slashed = financials.security_buffer_usd * 0.5
    await db
      .from("miner_financials")
      .update({ security_buffer_usd: financials.security_buffer_usd - slashed })
      .eq("id", financials.id)
  }

  return NextResponse.json({
    session_id: session.id,
    new_phase: "COMPLETED",
    message: "Emergency release: session terminated, node set to VIOLATED, 50% buffer slashed.",
  })
}
