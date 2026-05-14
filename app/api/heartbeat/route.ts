import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/auth/middleware"
import { heartbeatStore, isNodeOnline } from "@/lib/heartbeat-store"

export const dynamic = "force-dynamic"

const heartbeatSchema = z.object({
  node_id: z.string().min(1),
  timestamp: z.string(),
  gpu_util_pct: z.number().min(0).max(100).default(0),
  gpu_temp_c: z.number().default(0),
  gpu_mem_used_mib: z.number().int().default(0),
  gpu_mem_total_mib: z.number().int().default(0),
  gpu_power_w: z.number().default(0),
  active_session: z.string().optional().default(""),
  tunnel_mode: z.string().default("unknown"),
  uptime_sec: z.number().int().default(0),
})

/**
 * POST /api/heartbeat
 * Receives health reports from miner NeuroClient daemons.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = heartbeatSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data = parsed.data

  heartbeatStore.set(data.node_id, {
    nodeId: data.node_id,
    wallet: authResult.sub,
    lastSeen: Date.now(),
    gpuUtilPct: data.gpu_util_pct,
    gpuTempC: data.gpu_temp_c,
    gpuMemUsedMiB: data.gpu_mem_used_mib,
    gpuMemTotalMiB: data.gpu_mem_total_mib,
    gpuPowerW: data.gpu_power_w,
    activeSession: data.active_session || null,
    tunnelMode: data.tunnel_mode,
    uptimeSec: data.uptime_sec,
  })

  return NextResponse.json({ ok: true })
}

/**
 * GET /api/heartbeat
 * Returns current status of all known nodes (for dashboard display).
 */
export async function GET() {
  const nodes: Array<ReturnType<typeof heartbeatStore.get> & { online: boolean }> = []

  heartbeatStore.forEach((hb) => {
    nodes.push({
      ...hb,
      online: isNodeOnline(hb),
    })
  })

  return NextResponse.json({ nodes })
}
