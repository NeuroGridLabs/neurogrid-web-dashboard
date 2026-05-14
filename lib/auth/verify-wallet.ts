import { PublicKey } from "@solana/web3.js"
import { sign } from "tweetnacl"

/**
 * Verify a Solana wallet signature.
 *
 * Flow:
 *   1. Client signs a nonce message with their wallet
 *   2. Server verifies the signature against the claimed public key
 *   3. If valid, the wallet address is trusted for JWT issuance
 *
 * Uses ed25519 verification via the nacl algorithm embedded in @solana/web3.js's
 * dependency chain. We access tweetnacl directly since it's already installed
 * as a transitive dep of @solana/web3.js.
 *
 * @param walletAddress - Base58-encoded Solana public key
 * @param signatureBytes - Raw signature bytes (Uint8Array)
 * @param message       - The original nonce message that was signed
 * @returns true if signature is valid for the given wallet + message
 */
export function verifyWalletSignature(
  walletAddress: string,
  signatureBytes: Uint8Array,
  message: string,
): boolean {
  try {
    const publicKey = new PublicKey(walletAddress)
    const messageBytes = new TextEncoder().encode(message)

    return sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes())
  } catch {
    return false
  }
}

/**
 * Generate a nonce message for wallet signing.
 * Includes domain, timestamp, and random bytes to prevent replay.
 */
export function generateNonceMessage(domain: string = "neurogrid.io"): {
  message: string
  nonce: string
  issuedAt: number
} {
  const nonce = crypto.randomUUID()
  const issuedAt = Date.now()

  const message = [
    `${domain} wants you to sign in with your Solana account.`,
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${new Date(issuedAt).toISOString()}`,
  ].join("\n")

  return { message, nonce, issuedAt }
}

/**
 * Validate that a nonce hasn't expired.
 * Default window: 5 minutes.
 */
export function isNonceValid(
  issuedAt: number,
  maxAgeMs: number = 5 * 60 * 1000,
): boolean {
  return Date.now() - issuedAt < maxAgeMs
}
