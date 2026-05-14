import { NextResponse } from "next/server"
import { generateNonceMessage } from "@/lib/auth/verify-wallet"

export const dynamic = "force-dynamic"

/**
 * GET /api/auth/nonce
 * Generate a one-time nonce message for wallet signature verification.
 * Client signs this message with their Solana wallet, then sends to /api/auth/connect-wallet.
 */
export async function GET() {
  const { message, nonce, issuedAt } = generateNonceMessage()

  return NextResponse.json({ message, nonce, issuedAt })
}
