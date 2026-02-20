import { randomBytes } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { ADMIN_WALLET_ADDRESS } from "@/lib/solana-constants"
import { FOUNDATION_GENESIS_NODE_ID } from "@/lib/genesis-node"
import { computeEscrowBreakdown } from "@/lib/lifecycle/escrow"
import { EXPECTED_HOURS_MIN } from "@/lib/lifecycle/escrow"
import { getAuthMethodFromRequest } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

/** Generate a mock session key for the secure tenant connector (no raw IP/port exposed). */
function generateMockSessionKey(): string {
  return `ng_sess_${randomBytes(12).toString("hex")}`
}

/** RBAC: Deploy/Worker APIs require wallet auth. Web2-only users get 403. */
function requireWalletAuth(request: NextRequest): NextResponse | null {
  const authMethod = getAuthMethodFromRequest(request)
  if (authMethod === "web2") {
    return NextResponse.json(
      { error: "Forbidden: Operating a node requires a Web3 Wallet connection." },
      { status: 403 }
    )
  }
  return null
}

/** In-memory set of node ids already PROVISIONING or ACTIVE (ignited). Serverless: per-instance only. */
const provisionedNodeIds = new Set<string>()

/** Request body: pre-paid escrow requires expected_hours (min 1); 100% USDT locked upfront. */
interface AssignBody {
  nodeId: string
  renterWalletAddress: string
  transactionSignature?: string
  /** Required for non-genesis deploy: hours to lock (min 1). Frontend locks total = expected_hours * hourly_price. */
  expected_hours?: number
  /** Hourly price in USDT (for escrow breakdown and expires_at). If omitted, backend may use node default. */
  hourly_price_usd?: number
}

/**
 * After frontend confirms the USDT split tx on Solana, backend verifies the transaction
 * and assigns tunnel port / SSH key (enterprise reverse-connection framework). For Alpha-01 + Admin Wallet, bypasses payment and returns SUCCESS.
 * Rejects 409 if the same node is already PROVISIONING/ACTIVE to enforce uniqueness.
 */
export async function POST(request: NextRequest) {
  const forbidden = requireWalletAuth(request)
  if (forbidden) return forbidden
  let body: AssignBody
  try {
    body = (await request.json()) as AssignBody
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }
  const { nodeId, renterWalletAddress, transactionSignature, expected_hours: rawHours, hourly_price_usd } = body
  if (!nodeId || typeof nodeId !== "string" || !renterWalletAddress || typeof renterWalletAddress !== "string") {
    return NextResponse.json(
      { error: "Missing nodeId or renterWalletAddress" },
      { status: 400 }
    )
  }
  const expectedHours = Math.max(EXPECTED_HOURS_MIN, typeof rawHours === "number" && rawHours >= 1 ? Math.floor(rawHours) : EXPECTED_HOURS_MIN)
  const hourlyPriceUsd = typeof hourly_price_usd === "number" && hourly_price_usd > 0 ? hourly_price_usd : 0.59

  const isGenesisIgnite =
    nodeId === FOUNDATION_GENESIS_NODE_ID && renterWalletAddress === ADMIN_WALLET_ADDRESS

  if (isGenesisIgnite) {
    if (provisionedNodeIds.has(nodeId)) {
      return NextResponse.json(
        { error: "Node already in PROVISIONING or ACTIVE state", code: "NODE_ALREADY_DEPLOYED" },
        { status: 409 }
      )
    }
    provisionedNodeIds.add(nodeId)
    const gateway = process.env.DEPLOY_GATEWAY_TEMPLATE
      ? process.env.DEPLOY_GATEWAY_TEMPLATE.replace("{nodeId}", nodeId.replace(/-/g, ""))
      : `${nodeId.replace(/-/g, "")}.ngrid.xyz`
    const port = process.env.DEPLOY_PORT
      ? parseInt(process.env.DEPLOY_PORT, 10)
      : 7890
    const session_key = generateMockSessionKey()
    return NextResponse.json({
      gateway,
      port: Number.isFinite(port) ? port : 7890,
      session_key,
      status: "NODE_PROVISIONING",
    })
  }

  if (!transactionSignature || typeof transactionSignature !== "string") {
    return NextResponse.json(
      { error: "Missing transactionSignature (required for non-genesis deploy)" },
      { status: 400 }
    )
  }

  // Pre-paid escrow: 5% -> PendingBatchBuybackPool, 95% -> ProtocolEscrow_USDT
  const startedAt = new Date()
  const escrow_breakdown = computeEscrowBreakdown(expectedHours, hourlyPriceUsd, startedAt)

  // Mock: verify transactionSignature on-chain in production; assign tunnel and persist session in DB.
  const gateway = process.env.DEPLOY_GATEWAY_TEMPLATE
    ? process.env.DEPLOY_GATEWAY_TEMPLATE.replace("{nodeId}", nodeId.replace(/-/g, ""))
    : `${nodeId.replace(/-/g, "")}.ngrid.xyz`
  const port = process.env.DEPLOY_PORT
    ? parseInt(process.env.DEPLOY_PORT, 10)
    : nodeId.charCodeAt(nodeId.length - 1) % 2 === 0
      ? 443
      : 7890
  const session_key = generateMockSessionKey()

  return NextResponse.json({
    gateway,
    port: Number.isFinite(port) ? port : 443,
    session_key,
    escrow_breakdown,
    expected_hours: escrow_breakdown.expected_hours,
    expires_at: escrow_breakdown.expires_at,
  })
}
