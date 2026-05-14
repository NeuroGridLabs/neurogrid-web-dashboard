import { NextResponse } from "next/server"
import { z } from "zod"
import { getFoundationGenesisNode } from "@/lib/genesis-node"
import { heartbeatStore, isNodeOnline } from "@/lib/heartbeat-store"

export const dynamic = "force-dynamic"
export const revalidate = 0

/** Zod schema for upstream node response — validates shape before passing to frontend */
const upstreamNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  gpus: z.string().default("Unknown"),
  vram: z.string().default("Unknown"),
  status: z.string().default("available"),
  utilization: z.number().default(0),
  bandwidth: z.string().default("N/A"),
  latencyMs: z.number().default(0),
  isGenesis: z.boolean().optional(),
  isFoundationSeed: z.boolean().optional(),
  rentedBy: z.string().nullable().default(null),
  minerWalletAddress: z.string(),
  priceInUSDT: z.number(),
  pricePerHour: z.string(),
})

const upstreamResponseSchema = z.object({
  nodes: z.array(upstreamNodeSchema).default([]),
})

/**
 * Merge heartbeat data into a node record.
 * Adds real-time GPU metrics and online status from the heartbeat store.
 */
function enrichWithHeartbeat(node: z.infer<typeof upstreamNodeSchema>) {
  // Try to find heartbeat by node ID first, then by miner wallet
  let hb = heartbeatStore.get(node.id)
  if (!hb) {
    // Search by wallet address
    heartbeatStore.forEach((v) => {
      if (v.wallet === node.minerWalletAddress) hb = v
    })
  }

  if (!hb) return node

  return {
    ...node,
    status: isNodeOnline(hb) ? (hb.activeSession ? "rented" : "available") : "offline",
    utilization: Math.round(hb.gpuUtilPct),
    heartbeat: {
      online: isNodeOnline(hb),
      gpuTempC: hb.gpuTempC,
      gpuMemUsedMiB: hb.gpuMemUsedMiB,
      gpuMemTotalMiB: hb.gpuMemTotalMiB,
      gpuPowerW: hb.gpuPowerW,
      tunnelMode: hb.tunnelMode,
      uptimeSec: hb.uptimeSec,
      activeSession: hb.activeSession,
      lastSeen: hb.lastSeen,
    },
  }
}

/**
 * Returns list of rentable nodes from backend.
 * When no backend or empty list (Epoch 0), returns the foundation seed node.
 * All nodes are enriched with real-time heartbeat data when available.
 */
export async function GET() {
  const apiUrl =
    process.env.NODES_API_URL ?? process.env.NEXT_PUBLIC_NODES_API_URL
  if (!apiUrl) {
    const genesis = getFoundationGenesisNode()
    return NextResponse.json({ nodes: [enrichWithHeartbeat(genesis)] })
  }
  try {
    const res = await fetch(apiUrl, {
      next: { revalidate: 0 },
      headers: { "Content-Type": "application/json" },
    })
    if (!res.ok) {
      console.warn("[Nodes API] Upstream error:", res.status)
      return NextResponse.json({ nodes: [enrichWithHeartbeat(getFoundationGenesisNode())] })
    }
    const raw = await res.json()
    const parsed = upstreamResponseSchema.safeParse(raw)
    if (!parsed.success) {
      console.warn("[Nodes API] Upstream schema validation failed:", parsed.error.message)
      return NextResponse.json({ nodes: [enrichWithHeartbeat(getFoundationGenesisNode())] })
    }
    const nodes = parsed.data.nodes
    if (nodes.length === 0) {
      return NextResponse.json({ nodes: [enrichWithHeartbeat(getFoundationGenesisNode())] })
    }
    return NextResponse.json({ nodes: nodes.map(enrichWithHeartbeat) })
  } catch (e) {
    console.warn("[Nodes API] Error:", e instanceof Error ? e.message : "Unknown error")
    return NextResponse.json({ nodes: [enrichWithHeartbeat(getFoundationGenesisNode())] })
  }
}
