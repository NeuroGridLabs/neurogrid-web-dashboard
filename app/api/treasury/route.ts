import { fetchTreasuryData } from "@/lib/treasury-api"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 60

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const skipCache = process.env.NODE_ENV === "development" && searchParams.get("refresh") === "1"
    console.log("[Treasury API] Fetching treasury data...", skipCache ? "(cache bypass)" : "")
    const data = await fetchTreasuryData(skipCache)
    if (data.totalReserveUsd === 0) {
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
