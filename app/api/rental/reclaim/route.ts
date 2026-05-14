import { NextRequest, NextResponse } from "next/server"
import { requireWalletAuth } from "@/lib/auth/middleware"
import { validateBody } from "@/lib/api/validate"
import { reclaimBodySchema } from "@/lib/validations/rental"
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/api/rate-limit"
import { validateCsrf } from "@/lib/api/csrf"
import { createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * POST: Reclaim a rental session (expires_at reached, no renewal).
 * Session data loaded from DB — not trusted from client.
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
  const rl = await checkRateLimitAsync(`reclaim:${wallet}`, RATE_LIMITS.write)
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
  const parsed = validateBody(reclaimBodySchema, rawBody)
  if (!parsed.success) return parsed.response
  const { session_id } = parsed.data

  const db = createAdminClient()

  // 4. Load session from DB
  const { data: session, error: sessErr } = await db
    .from("rental_sessions")
    .select("*")
    .eq("id", session_id)
    .single()

  if (sessErr || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  // 5. Only miner or tenant can reclaim
  if (session.miner_wallet !== wallet && session.tenant_wallet !== wallet) {
    return NextResponse.json(
      { error: "Only session participants can reclaim" },
      { status: 403 },
    )
  }

  // 6. Phase check
  if (session.phase !== "ACTIVE") {
    return NextResponse.json(
      { error: `Cannot reclaim: session is ${session.phase}` },
      { status: 409 },
    )
  }

  // 7. Check if expires_at has passed
  const now = new Date()
  if (new Date(session.expires_at) > now) {
    return NextResponse.json(
      {
        error: "Session has not expired yet",
        expires_at: session.expires_at,
      },
      { status: 400 },
    )
  }

  // 8. Transition to RECLAIMING then COMPLETED
  const { error: updateErr } = await db
    .from("rental_sessions")
    .update({
      phase: "COMPLETED" as const,
      completed_at: now.toISOString(),
    })
    .eq("id", session.id)
    .eq("phase", "ACTIVE")

  if (updateErr) {
    return NextResponse.json({ error: "Failed to reclaim session" }, { status: 500 })
  }

  // 9. Release node
  await db
    .from("nodes")
    .update({
      lifecycle_status: "IDLE" as const,
      rented_by: null,
    })
    .eq("id", session.node_id)

  return NextResponse.json({
    session_id: session.id,
    new_phase: "COMPLETED",
    message: "Session reclaimed: tunnel dropped, container destroyed.",
  })
}
