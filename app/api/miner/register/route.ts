import { NextRequest, NextResponse } from "next/server"
import { getAuthMethodFromRequest } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

/** RBAC: Miner/Worker APIs require wallet auth. Web2-only users get 403. */
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

/**
 * Request body: miner registration (sent after wallet connect + form submit).
 * Registration succeeds only when tunnel (NeuroGrid protocol) verification has passed.
 */
export interface MinerRegisterBody {
  walletAddress: string
  pricePerHour?: string
  bandwidth?: string
  gpuModel?: string
  vram?: string
  gateway?: string
  /** When true, backend treats tunnel as verified; only then is registration successful. */
  tunnelVerified?: boolean
  /** @deprecated Use tunnelVerified. Kept for backward compatibility. */
  frpVerified?: boolean
}

/**
 * Registration fails by default. Only when tunnel verification passes does
 * the backend return 201 and the node count as registered.
 * Stub: tunnelVerified (or frpVerified) required for success; real backend verifies physical link and protocol handshake.
 */
export async function POST(request: NextRequest) {
  const forbidden = requireWalletAuth(request)
  if (forbidden) return forbidden
  let body: MinerRegisterBody
  try {
    body = (await request.json()) as MinerRegisterBody
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }
  const { walletAddress, tunnelVerified, frpVerified } = body
  if (!walletAddress || typeof walletAddress !== "string") {
    return NextResponse.json(
      { error: "walletAddress is required" },
      { status: 400 }
    )
  }

  const verified = tunnelVerified === true || frpVerified === true
  if (!verified) {
    return NextResponse.json(
      {
        error:
          "Registration failed: tunnel verification required. Connect using NeuroClient (or backend-provisioned config) and complete verification, then submit again.",
        code: "TUNNEL_VERIFICATION_REQUIRED",
      },
      { status: 400 }
    )
  }

  const nodeId = "alpha-01"
  return NextResponse.json(
    {
      nodeId,
      status: "ACTIVE",
      message: "Node registered. Tunnel verified; node is active in Node Command Center.",
    },
    { status: 201 }
  )
}
