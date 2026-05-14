import { NextRequest, NextResponse } from "next/server"
import { requireWalletAuth } from "@/lib/auth/middleware"
import { validateBody } from "@/lib/api/validate"
import { disputeBodySchema } from "@/lib/validations/rental"
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/api/rate-limit"
import { validateCsrf } from "@/lib/api/csrf"
import { createAdminClient } from "@/lib/supabase/server"
import { disputeRefundAndSlash } from "@/lib/lifecycle/settlement"
import type { RentalSession } from "@/lib/types/escrow"

export const dynamic = "force-dynamic"

/**
 * POST: Resolve offline dispute — refund tenant unused time, slash Miner SecurityBuffer.
 * hours_used is derived from settlement_logs (not trusted from client).
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
  const rl = await checkRateLimitAsync(`dispute:${wallet}`, RATE_LIMITS.write)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 3. Validate
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = validateBody(disputeBodySchema, rawBody)
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

  // 5. Only tenant can file dispute
  if (session.tenant_wallet !== wallet) {
    return NextResponse.json(
      { error: "Only the tenant can file a dispute" },
      { status: 403 },
    )
  }

  // 6. Phase check
  if (session.phase !== "ACTIVE") {
    return NextResponse.json(
      { error: `Cannot dispute: session is ${session.phase}` },
      { status: 409 },
    )
  }

  // 7. Check for existing dispute
  const { data: existing } = await db
    .from("disputes")
    .select("id")
    .eq("session_id", session.id)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "Dispute already filed for this session" },
      { status: 409 },
    )
  }

  // 8. Derive hours_used from settlement_logs (don't trust client)
  const { count: settledHours } = await db
    .from("settlement_logs")
    .select("*", { count: "exact", head: true })
    .eq("session_id", session.id)

  const hoursUsed = settledHours ?? 0

  // 9. Compute refund & slash
  const sessionForCalc: RentalSession = {
    id: session.id,
    node_id: session.node_id,
    tenant_address: session.tenant_wallet,
    expected_hours: session.expected_hours,
    hourly_price_usd: session.hourly_price_usd,
    started_at: session.started_at,
    expires_at: session.expires_at,
    phase: session.phase,
    hours_settled: session.hours_settled,
    platform_fee_usd: session.platform_fee_usd,
    escrow_total_usd: session.escrow_usd,
  }
  const { refund_tenant_usd, slash_miner_usd } = disputeRefundAndSlash(sessionForCalc, hoursUsed)

  // 10. Write dispute record
  const { error: insertErr } = await db.from("disputes").insert({
    session_id: session.id,
    filed_by: wallet,
    hours_used: hoursUsed,
    refund_tenant_usd,
    slash_miner_usd,
  })

  if (insertErr) {
    return NextResponse.json({ error: "Failed to file dispute" }, { status: 500 })
  }

  // 11. Transition session to DISPUTED
  await db
    .from("rental_sessions")
    .update({ phase: "DISPUTED" as const })
    .eq("id", session.id)

  // 12. Slash miner financials
  const { data: financials } = await db
    .from("miner_financials")
    .select("*")
    .eq("wallet_address", session.miner_wallet)
    .eq("node_id", session.node_id)
    .single()

  if (financials) {
    const newBuffer = Math.max(0, financials.security_buffer_usd - slash_miner_usd)
    await db
      .from("miner_financials")
      .update({ security_buffer_usd: newBuffer })
      .eq("id", financials.id)
  }

  return NextResponse.json({
    session_id: session.id,
    hours_used: hoursUsed,
    refund_tenant_usd,
    slash_miner_usd,
    new_phase: "DISPUTED",
  })
}
