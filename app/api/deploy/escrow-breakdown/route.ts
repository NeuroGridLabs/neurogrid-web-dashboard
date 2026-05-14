import { NextRequest, NextResponse } from "next/server"
import { computeEscrowBreakdown } from "@/lib/lifecycle/escrow"
import { validateQuery } from "@/lib/api/validate"
import { escrowBreakdownQuerySchema } from "@/lib/validations/deploy"

export const dynamic = "force-dynamic"

/**
 * GET: Compute pre-paid escrow breakdown for display before deploy.
 * Query: expected_hours (min 1, max 8760), hourly_price_usd (positive, max 10000).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parsed = validateQuery(escrowBreakdownQuerySchema, searchParams)
  if (!parsed.success) return parsed.response

  const { expected_hours = 1, hourly_price_usd = 0.59 } = parsed.data
  const breakdown = computeEscrowBreakdown(expected_hours, hourly_price_usd)
  return NextResponse.json(breakdown)
}
