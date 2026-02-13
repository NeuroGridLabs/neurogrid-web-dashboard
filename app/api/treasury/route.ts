import { fetchTreasuryData } from "@/lib/treasury-api"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 60

export async function GET() {
  try {
    const data = await fetchTreasuryData()
    return NextResponse.json(data)
  } catch (e) {
    console.error("[Treasury API]", e)
    return NextResponse.json(
      { error: "Treasury fetch failed" },
      { status: 500 }
    )
  }
}
