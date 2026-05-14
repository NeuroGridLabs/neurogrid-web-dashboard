import { NextRequest, NextResponse } from "next/server"
import { requireWalletAuth } from "@/lib/auth/middleware"
import { validateBody } from "@/lib/api/validate"
import { minerRegisterBodySchema } from "@/lib/validations/miner"
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/api/rate-limit"
import { validateCsrf } from "@/lib/api/csrf"
import { createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Server-side tunnel verification: ping the gateway endpoint.
 * Returns true if the endpoint responds within timeout.
 */
async function verifyTunnel(gateway: string): Promise<boolean> {
  if (!gateway) return false
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(gateway, {
      method: "HEAD",
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

/**
 * POST: Register a miner node.
 * Tunnel verification is done server-side (HTTP ping), not trusted from client.
 */
export async function POST(request: NextRequest) {
  // 1. Auth
  const authResult = await requireWalletAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const wallet = authResult.sub

  // 2. CSRF
  const csrfErr = validateCsrf(request)
  if (csrfErr) return csrfErr

  // 3. Rate limit
  const rl = await checkRateLimitAsync(`register:${wallet}`, RATE_LIMITS.register)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 3. Validate
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = validateBody(minerRegisterBodySchema, rawBody)
  if (!parsed.success) return parsed.response
  const body = parsed.data

  // 4. Wallet must match authenticated user
  if (body.walletAddress !== wallet) {
    return NextResponse.json(
      { error: "walletAddress must match authenticated wallet" },
      { status: 403 },
    )
  }

  // 5. Server-side tunnel verification
  const tunnelOk = body.gateway ? await verifyTunnel(body.gateway) : false
  if (!tunnelOk) {
    return NextResponse.json(
      {
        error: "Registration failed: tunnel verification failed. Ensure your node gateway is reachable.",
        code: "TUNNEL_VERIFICATION_REQUIRED",
      },
      { status: 400 },
    )
  }

  const db = createAdminClient()

  // 6. Check if already registered
  const { data: existing } = await db
    .from("miners")
    .select("id")
    .eq("wallet_address", wallet)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "Wallet already has a registered node" },
      { status: 409 },
    )
  }

  // 7. Generate node ID and insert
  const nodeId = `node-${wallet.slice(0, 8).toLowerCase()}-${Date.now().toString(36)}`

  const { error: insertErr } = await db.from("miners").insert({
    wallet_address: wallet,
    node_id: nodeId,
    gpu_model: body.gpuModel,
    vram: body.vram,
    bandwidth: body.bandwidth ?? null,
    price_per_hour: body.pricePerHour ?? 0.59,
    tunnel_verified: true,
  })

  if (insertErr) {
    return NextResponse.json({ error: "Failed to register miner" }, { status: 500 })
  }

  return NextResponse.json(
    {
      nodeId,
      status: "ACTIVE",
      message: "Node registered. Tunnel verified; node is active in Node Command Center.",
    },
    { status: 201 },
  )
}
