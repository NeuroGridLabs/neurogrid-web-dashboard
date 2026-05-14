import { NextRequest, NextResponse } from "next/server"
import { requireWalletAuth } from "@/lib/auth/middleware"
import { createAdminClient } from "@/lib/supabase/server"
import { deriveSessionKey } from "@/lib/session-key"

export const dynamic = "force-dynamic"

const RELAY_PUBLIC_ADDR =
  process.env.NEXT_PUBLIC_RELAY_URL ?? process.env.RELAY_INTERNAL_URL ?? ""

/**
 * GET /api/node/:nodeId/session
 *
 * Returns the active rental session assigned to this miner node, or 404 if
 * none. Used by the miner daemon's polling loop to pick up new tenant
 * assignments.
 *
 * Authorization: requires a wallet-bound JWT whose `sub` matches the node's
 * registered owner_wallet — a miner can only see sessions for nodes it owns.
 *
 * Session key is derived (not stored) — see lib/session-key.ts.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nodeId: string }> },
) {
  const auth = await requireWalletAuth(request)
  if (auth instanceof NextResponse) return auth

  const { nodeId } = await context.params
  if (!nodeId) {
    return NextResponse.json({ error: "Missing nodeId" }, { status: 400 })
  }

  const db = createAdminClient()

  const { data: node, error: nodeErr } = await db
    .from("nodes")
    .select("owner_wallet")
    .eq("id", nodeId)
    .single()

  if (nodeErr || !node) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 })
  }

  if (node.owner_wallet !== auth.sub) {
    return NextResponse.json(
      { error: "You do not own this node" },
      { status: 403 },
    )
  }

  const { data: session } = await db
    .from("rental_sessions")
    .select("id, tenant_wallet, expected_hours, hourly_price_usd, started_at, expires_at")
    .eq("node_id", nodeId)
    .eq("phase", "ACTIVE")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ session_id: "" }, { status: 404 })
  }

  const containerImage =
    process.env.DEFAULT_CONTAINER_IMAGE ?? "neurogrid/jupyter-cuda:latest"

  return NextResponse.json({
    session_id: session.id,
    tenant_wallet: session.tenant_wallet,
    expected_hours: session.expected_hours,
    hourly_price_usd: session.hourly_price_usd,
    container_image: containerImage,
    tunnel_config: {
      relay_addr: RELAY_PUBLIC_ADDR,
      session_key: deriveSessionKey(session.id),
      peer_public_key: "",
    },
  })
}
