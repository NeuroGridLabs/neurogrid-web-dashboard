/**
 * Solana on-chain transaction verification for deploy/assign.
 *
 * Verifies that a transaction signature corresponds to a real USDT split payment:
 * - Transaction is confirmed (finalized or confirmed)
 * - Contains SPL token transfer instructions to the expected miner + treasury ATAs
 * - Transfer amounts match the escrow breakdown (95% miner, 5% treasury)
 *
 * This prevents fake deployments where the client sends a fabricated signature.
 */

import {
  Connection,
  PublicKey,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js"
import { getAssociatedTokenAddressSync } from "@solana/spl-token"
import { USDT_MINT_ADDRESS, USDT_DECIMALS, TREASURY_WALLET_ADDRESS } from "@/lib/solana-constants"

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC ??
  "https://api.mainnet-beta.solana.com"

const VERIFY_TIMEOUT_MS = 15_000

export interface VerifyResult {
  valid: boolean
  error?: string
  /** Actual miner amount in human-readable USD (e.g. 0.5605) */
  minerAmountUsd?: number
  /** Actual treasury amount in human-readable USD */
  treasuryAmountUsd?: number
}

/**
 * Verify a Solana transaction signature against expected escrow amounts.
 *
 * @param signature - The base58 transaction signature
 * @param expectedMinerWallet - The miner's wallet address (will derive ATA)
 * @param expectedEscrowUsd - Expected miner payment (95% of total)
 * @param expectedFeeUsd - Expected treasury fee (5% of total)
 * @param payerWallet - The tenant's wallet (must be the signer)
 * @param toleranceBps - Allowed deviation in basis points (default 50 = 0.5%)
 */
export async function verifyDeployTransaction(
  signature: string,
  expectedMinerWallet: string,
  expectedEscrowUsd: number,
  expectedFeeUsd: number,
  payerWallet: string,
  toleranceBps = 50,
): Promise<VerifyResult> {
  const connection = new Connection(RPC_URL, {
    commitment: "confirmed",
  })

  let tx: ParsedTransactionWithMeta | null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

    tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    })

    clearTimeout(timeout)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown RPC error"
    if (msg.includes("abort")) {
      return { valid: false, error: "Transaction verification timed out" }
    }
    return { valid: false, error: `RPC error: ${msg}` }
  }

  if (!tx) {
    return { valid: false, error: "Transaction not found on-chain" }
  }

  // 1. Check confirmation status
  if (tx.meta?.err) {
    return { valid: false, error: "Transaction failed on-chain" }
  }

  // 2. Verify the payer is the expected tenant wallet
  const signers = tx.transaction.message.accountKeys
    .filter((k) => k.signer)
    .map((k) => k.pubkey.toBase58())

  if (!signers.includes(payerWallet)) {
    return { valid: false, error: "Transaction was not signed by the expected wallet" }
  }

  // 3. Parse token transfers from inner instructions + top-level instructions
  const transfers = extractTokenTransfers(tx)

  // 4. Derive expected ATAs
  const minerPubkey = new PublicKey(expectedMinerWallet)
  const expectedMinerAta = getAssociatedTokenAddressSync(
    USDT_MINT_ADDRESS,
    minerPubkey,
  ).toBase58()

  const expectedTreasuryAta = getAssociatedTokenAddressSync(
    USDT_MINT_ADDRESS,
    TREASURY_WALLET_ADDRESS,
  ).toBase58()

  // 5. Find matching transfers
  const minerTransfer = transfers.find((t) => t.destination === expectedMinerAta)
  const treasuryTransfer = transfers.find((t) => t.destination === expectedTreasuryAta)

  if (!minerTransfer) {
    return { valid: false, error: "No USDT transfer to miner ATA found in transaction" }
  }

  if (!treasuryTransfer) {
    return { valid: false, error: "No USDT transfer to treasury ATA found in transaction" }
  }

  // 6. Verify amounts within tolerance
  const minerActual = minerTransfer.amountRaw / 10 ** USDT_DECIMALS
  const treasuryActual = treasuryTransfer.amountRaw / 10 ** USDT_DECIMALS

  const toleranceFactor = toleranceBps / 10_000

  if (Math.abs(minerActual - expectedEscrowUsd) > expectedEscrowUsd * toleranceFactor) {
    return {
      valid: false,
      error: `Miner amount mismatch: expected $${expectedEscrowUsd.toFixed(6)}, got $${minerActual.toFixed(6)}`,
    }
  }

  if (Math.abs(treasuryActual - expectedFeeUsd) > expectedFeeUsd * toleranceFactor) {
    return {
      valid: false,
      error: `Treasury fee mismatch: expected $${expectedFeeUsd.toFixed(6)}, got $${treasuryActual.toFixed(6)}`,
    }
  }

  return {
    valid: true,
    minerAmountUsd: minerActual,
    treasuryAmountUsd: treasuryActual,
  }
}

/* ── Token transfer parsing helpers ──────────────────────── */

interface TokenTransfer {
  source: string
  destination: string
  amountRaw: number
  mint?: string
}

function extractTokenTransfers(tx: ParsedTransactionWithMeta): TokenTransfer[] {
  const transfers: TokenTransfer[] = []

  // Check top-level instructions
  for (const ix of tx.transaction.message.instructions) {
    if ("parsed" in ix && ix.parsed?.type === "transferChecked") {
      const info = ix.parsed.info
      transfers.push({
        source: info.source,
        destination: info.destination,
        amountRaw: Number(info.tokenAmount?.amount ?? 0),
        mint: info.mint,
      })
    }
    if ("parsed" in ix && ix.parsed?.type === "transfer" && ix.program === "spl-token") {
      const info = ix.parsed.info
      transfers.push({
        source: info.source,
        destination: info.destination,
        amountRaw: Number(info.amount ?? 0),
      })
    }
  }

  // Check inner instructions (created by CPI calls)
  if (tx.meta?.innerInstructions) {
    for (const inner of tx.meta.innerInstructions) {
      for (const ix of inner.instructions) {
        if ("parsed" in ix && ix.parsed?.type === "transferChecked") {
          const info = ix.parsed.info
          transfers.push({
            source: info.source,
            destination: info.destination,
            amountRaw: Number(info.tokenAmount?.amount ?? 0),
            mint: info.mint,
          })
        }
        if ("parsed" in ix && ix.parsed?.type === "transfer" && ix.program === "spl-token") {
          const info = ix.parsed.info
          transfers.push({
            source: info.source,
            destination: info.destination,
            amountRaw: Number(info.amount ?? 0),
          })
        }
      }
    }
  }

  return transfers
}
