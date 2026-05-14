import { NextRequest, NextResponse } from "next/server"
import { verifyWalletSignature, isNonceValid } from "@/lib/auth/verify-wallet"
import { signJwt } from "@/lib/auth/jwt"
import { AUTH_TOKEN_COOKIE } from "@/lib/auth/middleware"
import { generateCsrfToken, csrfCookieValue } from "@/lib/api/csrf"

export const dynamic = "force-dynamic"

const TOKEN_MAX_AGE = 60 * 60 * 24 // 24 hours in seconds

/**
 * POST /api/auth/connect-wallet
 *
 * Verify wallet signature and issue JWT.
 *
 * Body: {
 *   walletAddress: string,     // Base58 Solana public key
 *   signature: number[],       // Signature bytes as array (from wallet adapter signMessage)
 *   message: string,           // The nonce message that was signed
 *   issuedAt: number,          // Timestamp from /api/auth/nonce
 *   role?: "miner" | "tenant"  // Requested role (default: "tenant")
 * }
 */
export async function POST(request: NextRequest) {
  let body: {
    walletAddress?: string
    signature?: number[]
    message?: string
    issuedAt?: number
    role?: string
  }

  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { walletAddress, signature, message, issuedAt } = body

  // Validate required fields
  if (
    !walletAddress ||
    !signature ||
    !Array.isArray(signature) ||
    !message ||
    typeof issuedAt !== "number"
  ) {
    return NextResponse.json(
      { error: "Missing required fields: walletAddress, signature (number[]), message, issuedAt" },
      { status: 400 },
    )
  }

  // Validate nonce freshness (5 min window)
  if (!isNonceValid(issuedAt)) {
    return NextResponse.json(
      { error: "Nonce expired. Please request a new nonce." },
      { status: 401 },
    )
  }

  // Verify wallet signature
  const signatureBytes = new Uint8Array(signature)
  const valid = verifyWalletSignature(walletAddress, signatureBytes, message)
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid wallet signature" },
      { status: 401 },
    )
  }

  // Determine role
  const role = body.role === "miner" ? "miner" : "tenant"

  // Issue JWT
  const token = await signJwt({
    wallet: walletAddress,
    method: "wallet",
    role,
  })

  // Set httpOnly cookie + return token in body (client can use either)
  const res = NextResponse.json({
    ok: true,
    token,
    wallet: walletAddress,
    method: "wallet",
    role,
  })

  res.cookies.set(AUTH_TOKEN_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  })

  // Set CSRF token cookie (readable by JS, SameSite=Strict)
  const csrfToken = generateCsrfToken()
  res.headers.append("Set-Cookie", csrfCookieValue(csrfToken))

  return res
}
