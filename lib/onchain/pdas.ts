import { PublicKey } from "@solana/web3.js"
import { PROGRAM_ID } from "./program"

const TREASURY_SEED = Buffer.from("treasury")
const MINER_SEED = Buffer.from("miner")
const ESCROW_SEED = Buffer.from("escrow")

export function deriveTreasuryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([TREASURY_SEED], PROGRAM_ID)
}

export function deriveMinerPda(minerWallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MINER_SEED, minerWallet.toBuffer()],
    PROGRAM_ID,
  )
}

export function deriveEscrowPda(sessionId: Uint8Array): [PublicKey, number] {
  if (sessionId.length !== 16) {
    throw new Error(`escrow session_id must be 16 bytes, got ${sessionId.length}`)
  }
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, Buffer.from(sessionId)],
    PROGRAM_ID,
  )
}

/**
 * Parse a UUID-like string (with or without hyphens) into 16 raw bytes.
 * Used to match the session_id format expected by create_escrow.
 */
export function sessionIdFromUuid(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "")
  if (hex.length !== 32) {
    throw new Error(`uuid must encode 16 bytes (32 hex chars), got ${hex.length}`)
  }
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
