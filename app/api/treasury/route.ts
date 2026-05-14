import { fetchTreasuryData, invalidateTreasuryCache } from "@/lib/treasury-api"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 60

/**
 * GET: Fetch treasury data with error grading and stale-cache support.
 * Query: refresh=1 invalidates cache and forces re-fetch.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get("refresh") === "1"

    if (forceRefresh) {
      invalidateTreasuryCache()
    }

    const data = await fetchTreasuryData(forceRefresh)

    if (data.totalReserveUsd === 0 && !data.isStale) {
      console.log("[Treasury API] Serving Epoch 0 treasury data (no reserve yet)")
    }

    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    console.warn("[Treasury API] Error:", msg)
    return NextResponse.json(
      { error: "Treasury fetch failed" },
      { status: 500 }
    )
  }
}
