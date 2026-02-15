import { NextResponse } from "next/server"
import type { Node } from "@/lib/types/node"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Returns list of rentable nodes from backend.
 * Set NEXT_PUBLIC_NODES_API_URL or NODES_API_URL to your Supabase/Postgres-backed endpoint
 * that returns { nodes: Node[] }. If unset, returns empty array.
 */
export async function GET() {
  const apiUrl =
    process.env.NODES_API_URL ?? process.env.NEXT_PUBLIC_NODES_API_URL
  if (!apiUrl) {
    console.log("[Nodes API] No NODES_API_URL set, returning empty list (Epoch 0)")
    return NextResponse.json({ nodes: [] })
  }
  try {
    console.log("[Nodes API] Fetching nodes from upstream...")
    const res = await fetch(apiUrl, {
      next: { revalidate: 0 },
      headers: { "Content-Type": "application/json" },
    })
    if (!res.ok) {
      console.warn("[Nodes API] Upstream error:", res.status, await res.text())
      return NextResponse.json({ nodes: [] })
    }
    const data = (await res.json()) as { nodes?: Node[] }
    const nodes = Array.isArray(data.nodes) ? data.nodes : []
    console.log("[Nodes API] Returning", nodes.length, "nodes")
    return NextResponse.json({ nodes })
  } catch (e) {
    console.warn("[Nodes API] Error:", e instanceof Error ? e.message : "Unknown error")
    return NextResponse.json({ nodes: [] })
  }
}
