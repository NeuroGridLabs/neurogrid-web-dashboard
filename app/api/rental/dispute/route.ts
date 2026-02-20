import { NextRequest, NextResponse } from "next/server"
import { disputeRefundAndSlash } from "@/lib/lifecycle/settlement"
import type { RentalSession } from "@/lib/types/escrow"

export const dynamic = "force-dynamic"

/**
 * POST: Resolve offline dispute — refund tenant only unused time, slash Miner SecurityBuffer.
 * Body: { session, hours_used }.
 * Returns: refund_tenant_usd, slash_miner_usd for persistence.
 */
export async function POST(request: NextRequest) {
  let body: { session?: RentalSession; hours_used?: number }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const session = body.session
  const hoursUsed = typeof body.hours_used === "number" ? body.hours_used : 0
  if (!session || typeof session.expires_at !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid session" },
      { status: 400 }
    )
  }
  const { refund_tenant_usd, slash_miner_usd } = disputeRefundAndSlash(session, hoursUsed)
  return NextResponse.json({
    refund_tenant_usd,
    slash_miner_usd,
    message: "Refund unused time to tenant; apply slash to Miner SecurityBuffer.",
  })
}
