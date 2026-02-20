import { NextRequest, NextResponse } from "next/server"
import { hourlyUnlockAmountUsd } from "@/lib/lifecycle/settlement"
import { allocateOrderProfitStrict, bufferCapUsd } from "@/lib/lifecycle/dual-yield"
export const dynamic = "force-dynamic"

const ONE_HOUR_MS = 60 * 60 * 1000

/**
 * POST: Simulate / execute one hourly settlement step (mock-friendly for testing).
 * Body: { session_id, node_id, hourly_price_usd, miner_wallet, current_buffer_usd, opt_in_buffer_routing, session_started_at }.
 * 1-Hour Minimum Charge: session_started_at (ISO) is required; server uses server time to ensure at least 1h has elapsed before allowing settlement.
 * Terminate/Renew flows must use this same rule: charge at least 1 hour; settlement only after 1h elapsed.
 * Returns: amount unlocked to miner, allocation to free vs buffer (for dual-yield), and elapsed_seconds for testing.
 */
export async function POST(request: NextRequest) {
  let body: {
    session_id?: string
    node_id?: string
    hourly_price_usd?: number
    miner_wallet?: string
    current_buffer_usd?: number
    opt_in_buffer_routing?: boolean
    /** Required for settlement: session start time (ISO). Server enforces 1-hour minimum using server time. */
    session_started_at?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const now = new Date()
  const startedAtIso = body.session_started_at
  if (!startedAtIso || typeof startedAtIso !== "string") {
    return NextResponse.json(
      { error: "session_started_at (ISO) is required for settlement." },
      { status: 400 }
    )
  }
  const startedAt = new Date(startedAtIso)
  if (Number.isNaN(startedAt.getTime())) {
    return NextResponse.json(
      { error: "session_started_at must be a valid ISO date string." },
      { status: 400 }
    )
  }
  const elapsedMs = now.getTime() - startedAt.getTime()
  if (elapsedMs < ONE_HOUR_MS) {
    return NextResponse.json(
      {
        error:
          "1-Hour Minimum Charge: settlement not allowed until session has been active for at least 1 hour (server time).",
        elapsed_seconds: Math.floor(elapsedMs / 1000),
        required_seconds: ONE_HOUR_MS / 1000,
      },
      { status: 400 }
    )
  }
  const hourlyPriceUsd = typeof body.hourly_price_usd === "number" ? body.hourly_price_usd : 0.59
  const currentBufferUsd = typeof body.current_buffer_usd === "number" ? body.current_buffer_usd : 0
  const optIn = Boolean(body.opt_in_buffer_routing)
  const cap = bufferCapUsd(hourlyPriceUsd)
  const unlockToMiner = hourlyUnlockAmountUsd(hourlyPriceUsd)
  const { toFreeUsd, toBufferUsd } = allocateOrderProfitStrict(
    unlockToMiner,
    currentBufferUsd,
    cap,
    optIn
  )
  return NextResponse.json({
    session_id: body.session_id ?? null,
    node_id: body.node_id ?? null,
    hourly_price_usd: hourlyPriceUsd,
    unlock_to_miner_usd: unlockToMiner,
    to_free_balance_usd: toFreeUsd,
    to_security_buffer_usd: toBufferUsd,
    buffer_cap_usd: cap,
    elapsed_seconds: Math.floor(elapsedMs / 1000),
    one_hour_minimum_met: true,
  })
}
