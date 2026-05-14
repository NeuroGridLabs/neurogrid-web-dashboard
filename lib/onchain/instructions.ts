import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js"
import { BN } from "@coral-xyz/anchor"
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token"
import { program } from "./program"
import {
  deriveEscrowPda,
  deriveMinerPda,
  deriveTreasuryPda,
} from "./pdas"
import { USDT_MINT_ADDRESS } from "@/lib/solana-constants"

/**
 * USDT mint used by the protocol.
 * Defaults to NEXT_PUBLIC_USDT_MINT env var (so devnet can use a test mint),
 * falling back to mainnet USDT constant.
 */
function getUsdtMint(): PublicKey {
  const fromEnv = process.env.NEXT_PUBLIC_USDT_MINT
  if (fromEnv) return new PublicKey(fromEnv)
  return USDT_MINT_ADDRESS
}

export interface BuildCreateEscrowArgs {
  tenant: PublicKey
  miner: PublicKey
  sessionId: Uint8Array // 16 bytes
  expectedHours: number
  hourlyPriceRaw: bigint // USDT base units (6 decimals)
  nodeId: Uint8Array // 32 bytes
}

/**
 * Build create_escrow instructions.
 *
 * Returns 3 instructions:
 *   1. createAssociatedTokenAccountIdempotent for treasury_token (PDA-owned ATA, 5% lands here)
 *   2. createAssociatedTokenAccountIdempotent for escrow_token   (PDA-owned ATA, 95% locked here)
 *   3. create_escrow program instruction
 *
 * Caller combines into a Transaction, sets feePayer = tenant, signs via wallet adapter.
 */
export async function buildCreateEscrowIxs(
  args: BuildCreateEscrowArgs,
): Promise<TransactionInstruction[]> {
  if (args.sessionId.length !== 16) {
    throw new Error("session_id must be exactly 16 bytes")
  }
  if (args.nodeId.length !== 32) {
    throw new Error("node_id must be exactly 32 bytes")
  }

  const mint = getUsdtMint()
  const [escrowPda] = deriveEscrowPda(args.sessionId)
  const [treasuryPda] = deriveTreasuryPda()

  const tenantToken = getAssociatedTokenAddressSync(mint, args.tenant)
  const escrowToken = getAssociatedTokenAddressSync(mint, escrowPda, true)
  const treasuryToken = getAssociatedTokenAddressSync(mint, treasuryPda, true)

  const createTreasuryAta = createAssociatedTokenAccountIdempotentInstruction(
    args.tenant,
    treasuryToken,
    treasuryPda,
    mint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )

  const createEscrowAta = createAssociatedTokenAccountIdempotentInstruction(
    args.tenant,
    escrowToken,
    escrowPda,
    mint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )

  const mainIx = await program.methods
    .createEscrow(
      Array.from(args.sessionId),
      args.expectedHours,
      new BN(args.hourlyPriceRaw.toString()),
      Array.from(args.nodeId),
    )
    .accounts({
      tenant: args.tenant,
      escrow: escrowPda,
      escrowToken,
      tenantToken,
      treasuryToken,
      treasury: treasuryPda,
      miner: args.miner,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as never)
    .instruction()

  return [createTreasuryAta, createEscrowAta, mainIx]
}

export interface BuildSettleHourArgs {
  minerSigner: PublicKey
  sessionId: Uint8Array
  hourIndex: number
}

/**
 * Build settle_hour instruction. Miner signs.
 */
export async function buildSettleHourIx(
  args: BuildSettleHourArgs,
): Promise<TransactionInstruction> {
  const mint = getUsdtMint()
  const [escrowPda] = deriveEscrowPda(args.sessionId)
  const [minerPda] = deriveMinerPda(args.minerSigner)

  const escrowToken = getAssociatedTokenAddressSync(mint, escrowPda, true)
  const minerToken = getAssociatedTokenAddressSync(mint, args.minerSigner)

  return program.methods
    .settleHour(args.hourIndex)
    .accounts({
      minerSigner: args.minerSigner,
      escrow: escrowPda,
      escrowToken,
      minerToken,
      minerAccount: minerPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as never)
    .instruction()
}

export interface BuildDisputeArgs {
  tenant: PublicKey
  miner: PublicKey
  sessionId: Uint8Array
}

/**
 * Build dispute instruction. Tenant signs.
 * Refunds unsettled hours back to tenant, slashes miner buffer.
 */
export async function buildDisputeIx(
  args: BuildDisputeArgs,
): Promise<TransactionInstruction> {
  const mint = getUsdtMint()
  const [escrowPda] = deriveEscrowPda(args.sessionId)
  const [minerPda] = deriveMinerPda(args.miner)

  const escrowToken = getAssociatedTokenAddressSync(mint, escrowPda, true)
  const tenantToken = getAssociatedTokenAddressSync(mint, args.tenant)

  return program.methods
    .dispute()
    .accounts({
      tenant: args.tenant,
      escrow: escrowPda,
      escrowToken,
      tenantToken,
      minerAccount: minerPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as never)
    .instruction()
}

export interface BuildReclaimArgs {
  caller: PublicKey // typically the tenant
  tenant: PublicKey // for ATA derivation; usually same as caller
  sessionId: Uint8Array
}

/**
 * Build reclaim instruction. Anyone may call after expires_at.
 * Returns remaining escrow to tenant.
 */
export async function buildReclaimIx(
  args: BuildReclaimArgs,
): Promise<TransactionInstruction> {
  const mint = getUsdtMint()
  const [escrowPda] = deriveEscrowPda(args.sessionId)

  const escrowToken = getAssociatedTokenAddressSync(mint, escrowPda, true)
  const tenantToken = getAssociatedTokenAddressSync(mint, args.tenant)

  return program.methods
    .reclaim()
    .accounts({
      caller: args.caller,
      escrow: escrowPda,
      escrowToken,
      tenantToken,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as never)
    .instruction()
}
