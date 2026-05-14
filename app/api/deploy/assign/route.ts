import { randomBytes } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { ADMIN_WALLET_ADDRESS } from "@/lib/solana-constants"
import { FOUNDATION_GENESIS_NODE_ID } from "@/lib/genesis-node"
import { computeEscrowBreakdown } from "@/lib/lifecycle/escrow"
import { requireWalletAuth } from "@/lib/auth/middleware"
import { validateBody } from "@/lib/api/validate"
import { deployAssignBodySchema } from "@/lib/validations/deploy"
import { checkRateLimitAsync, RATE_LIMITS } from "@/lib/api/rate-limit"
import { validateCsrf } from "@/lib/api/csrf"
import { createAdminClient } from "@/lib/supabase/server"
import { fetchEscrow, sessionIdFromUuid } from "@/lib/onchain"
import { registerRelaySession } from "@/lib/relay-client"
import { deriveSessionKey } from "@/lib/session-key"

export const dynamic = "force-dynamic"

function generateGenesisSessionKey(): string {
  return `ng_sess_${randomBytes(12).toString("hex")}`
}

/**
 * POST: Deploy a node — verify on-chain tx, create rental session in DB.
 * Conflict detection via DB query. Transaction signature verified against Solana RPC.
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
  const rl = await checkRateLimitAsync(`deploy:${wallet}`, RATE_LIMITS.write)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 3. Validate body
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = validateBody(deployAssignBodySchema, rawBody)
  if (!parsed.success) return parsed.response
  const body = parsed.data

  // 4. Ownership: renterWalletAddress must match authenticated wallet
  if (body.renterWalletAddress !== wallet) {
    return NextResponse.json(
      { error: "renterWalletAddress must match authenticated wallet" },
      { status: 403 },
    )
  }

  const db = createAdminClient()
  const isGenesisIgnite =
    body.nodeId === FOUNDATION_GENESIS_NODE_ID && wallet === ADMIN_WALLET_ADDRESS

  // 5. DB conflict detection: check for ACTIVE session on this node
  const { data: activeSession } = await db
    .from("rental_sessions")
    .select("id")
    .eq("node_id", body.nodeId)
    .eq("phase", "ACTIVE")
    .limit(1)

  if (activeSession && activeSession.length > 0) {
    return NextResponse.json(
      { error: "Node already has an active session", code: "NODE_ALREADY_DEPLOYED" },
      { status: 409 },
    )
  }

  // 6. Genesis ignite bypass (no payment required)
  if (isGenesisIgnite) {
    const gateway = process.env.DEPLOY_GATEWAY_TEMPLATE
      ? process.env.DEPLOY_GATEWAY_TEMPLATE.replace("{nodeId}", body.nodeId.replace(/-/g, ""))
      : `${body.nodeId.replace(/-/g, "")}.ngrid.xyz`
    const port = process.env.DEPLOY_PORT ? parseInt(process.env.DEPLOY_PORT, 10) : 7890

    return NextResponse.json({
      gateway,
      port: Number.isFinite(port) ? port : 7890,
      session_key: generateGenesisSessionKey(),
      status: "NODE_PROVISIONING",
    })
  }

  // 7. Non-genesis: require transaction signature + on-chain session id
  if (!body.transactionSignature || !body.sessionIdHex) {
    return NextResponse.json(
      { error: "Missing transactionSignature or sessionIdHex (required for non-genesis deploy)" },
      { status: 400 },
    )
  }

  // 8. Compute expected breakdown (for sanity-check + DB columns)
  const startedAt = new Date()
  const escrow = computeEscrowBreakdown(body.expected_hours ?? 1, body.hourly_price_usd ?? 0.59, startedAt)

  // 9. Look up node to get miner_wallet
  const { data: node } = await db
    .from("nodes")
    .select("owner_wallet")
    .eq("id", body.nodeId)
    .single()

  const minerWallet = node?.owner_wallet ?? ""
  if (!minerWallet) {
    return NextResponse.json({ error: "Node has no registered miner" }, { status: 400 })
  }

  // 10. Format sessionIdHex (32 hex chars) → UUID (8-4-4-4-12) for DB primary key
  const sh = body.sessionIdHex.toLowerCase()
  const sessionUuid = `${sh.slice(0, 8)}-${sh.slice(8, 12)}-${sh.slice(12, 16)}-${sh.slice(16, 20)}-${sh.slice(20)}`

  // 11. Prevent replay: same session id cannot be reused
  const { data: existingSession } = await db
    .from("rental_sessions")
    .select("id")
    .eq("id", sessionUuid)
    .limit(1)
  if (existingSession && existingSession.length > 0) {
    return NextResponse.json(
      { error: "Session id already used", code: "SESSION_REPLAY" },
      { status: 409 },
    )
  }

  // 12. On-chain verification: read escrow PDA from chain (trust the chain, not the tx parse)
  let escrowState
  try {
    escrowState = await fetchEscrow(sessionIdFromUuid(sessionUuid))
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to read escrow PDA: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 500 },
    )
  }
  if (!escrowState) {
    return NextResponse.json(
      { error: "Escrow PDA not found on chain (tx may not be confirmed yet — retry in a moment)", code: "ESCROW_NOT_FOUND" },
      { status: 400 },
    )
  }
  if (escrowState.phase !== "active") {
    return NextResponse.json(
      { error: `Escrow phase is ${escrowState.phase}, expected active`, code: "ESCROW_WRONG_PHASE" },
      { status: 400 },
    )
  }
  if (escrowState.tenant !== wallet) {
    return NextResponse.json(
      { error: "Escrow tenant does not match authenticated wallet", code: "ESCROW_TENANT_MISMATCH" },
      { status: 400 },
    )
  }
  if (escrowState.miner !== minerWallet) {
    return NextResponse.json(
      { error: "Escrow miner does not match node owner", code: "ESCROW_MINER_MISMATCH" },
      { status: 400 },
    )
  }

  // 13. Derive USD amounts from on-chain raw values (USDT has 6 decimals)
  const onchainEscrowUsd = Number(escrowState.escrowAmount) / 1_000_000
  const onchainFeeUsd = Number(escrowState.platformFee) / 1_000_000
  const onchainStartedAt = new Date(Number(escrowState.startedAt) * 1000)
  const onchainExpiresAt = new Date(Number(escrowState.expiresAt) * 1000)

  // 14. Create rental session in DB, id = on-chain session_id (as UUID)
  const { data: newSession, error: insertErr } = await db
    .from("rental_sessions")
    .insert({
      id: sessionUuid,
      node_id: body.nodeId,
      tenant_wallet: wallet,
      miner_wallet: minerWallet,
      expected_hours: escrowState.expectedHours,
      hourly_price_usd: Number(escrowState.hourlyPrice) / 1_000_000,
      escrow_usd: onchainEscrowUsd,
      platform_fee_usd: onchainFeeUsd,
      phase: "ACTIVE" as const,
      tx_signature: body.transactionSignature,
      started_at: onchainStartedAt.toISOString(),
      expires_at: onchainExpiresAt.toISOString(),
    })
    .select("id")
    .single()

  if (insertErr || !newSession) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }

  // 13. Update node status
  await db
    .from("nodes")
    .update({
      lifecycle_status: "LOCKED" as const,
      rented_by: wallet,
    })
    .eq("id", body.nodeId)

  // 13b. Register tunnel session on relay (best-effort — non-blocking).
  // Session key is HMAC-derived so the miner can re-derive it from session_id
  // when querying /api/node/{nodeId}/session — no plaintext key persisted.
  const sessionKey = deriveSessionKey(newSession.id)
  const relayResult = await registerRelaySession(newSession.id, sessionKey)
  if (!relayResult.ok) {
    console.warn(`[deploy] Relay session registration failed: ${relayResult.error}`)
    // Continue — relay registration can be retried or handled by miner polling
  }

  // 14. Return deployment info
  const gateway = process.env.DEPLOY_GATEWAY_TEMPLATE
    ? process.env.DEPLOY_GATEWAY_TEMPLATE.replace("{nodeId}", body.nodeId.replace(/-/g, ""))
    : `${body.nodeId.replace(/-/g, "")}.ngrid.xyz`
  const port = process.env.DEPLOY_PORT
    ? parseInt(process.env.DEPLOY_PORT, 10)
    : 7890

  return NextResponse.json({
    session_id: newSession.id,
    gateway,
    port: Number.isFinite(port) ? port : 7890,
    session_key: sessionKey,
    escrow_breakdown: escrow,
    expected_hours: escrowState.expectedHours,
    expires_at: onchainExpiresAt.toISOString(),
    verification: {
      escrow_pda: escrowState.pda,
      escrow_usd: onchainEscrowUsd,
      platform_fee_usd: onchainFeeUsd,
    },
  })
}
