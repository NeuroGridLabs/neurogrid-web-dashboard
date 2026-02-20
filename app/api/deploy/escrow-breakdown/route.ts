import { NextRequest, NextResponse } from "next/server"
import { computeEscrowBreakdown } from "@/lib/lifecycle/escrow"
import { EXPECTED_HOURS_MIN } from "@/lib/lifecycle/escrow"

export const dynamic = "force-dynamic"

/**
 * GET: Compute pre-paid escrow breakdown for display before deploy.
 * Query: expected_hours (min 1), hourly_price_usd.
 * Returns: total_usd, platform_fee_usd, escrow_usd, expires_at.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const hoursParam = searchParams.get("expected_hours")
  const priceParam = searchParams.get("hourly_price_usd")
  const expectedHours = Math.max(
    EXPECTED_HOURS_MIN,
    hoursParam ? Math.floor(Number(hoursParam)) || EXPECTED_HOURS_MIN : EXPECTED_HOURS_MIN
  )
  const hourlyPriceUsd =
    priceParam && Number(priceParam) > 0 ? Number(priceParam) : 0.59
  const breakdown = computeEscrowBreakdown(expectedHours, hourlyPriceUsd)
  return NextResponse.json(breakdown)
}
