import { PublicKey } from "@solana/web3.js"
import { program } from "./program"
import { deriveEscrowPda, deriveMinerPda, deriveTreasuryPda } from "./pdas"

export interface TreasuryState {
  authority: string
  totalFeesCollected: bigint
  totalBuybackSpent: bigint
  sessionsCount: bigint
  pda: string
}

export interface MinerState {
  wallet: string
  nodeId: number[]
  fingerprintHash: number[]
  securityBuffer: bigint
  bufferCap: bigint
  optInBufferRouting: boolean
  bufferLockedSince: bigint
  registeredAt: bigint
  unregisteredAt: bigint
  status: string
  pda: string
}

export interface EscrowState {
  sessionId: number[]
  tenant: string
  miner: string
  nodeId: number[]
  escrowAmount: bigint
  platformFee: bigint
  hourlyPrice: bigint
  expectedHours: number
  hoursSettled: number
  settledBitmap: number[]
  phase: string
  startedAt: bigint
  expiresAt: bigint
  completedAt: bigint
  pda: string
}

export async function fetchTreasury(): Promise<TreasuryState | null> {
  const [pda] = deriveTreasuryPda()
  const account = await program.account.treasuryAccount.fetchNullable(pda)
  if (!account) return null
  return {
    authority: account.authority.toBase58(),
    totalFeesCollected: BigInt(account.totalFeesCollected.toString()),
    totalBuybackSpent: BigInt(account.totalBuybackSpent.toString()),
    sessionsCount: BigInt(account.sessionsCount.toString()),
    pda: pda.toBase58(),
  }
}

export async function fetchMiner(minerWallet: PublicKey): Promise<MinerState | null> {
  const [pda] = deriveMinerPda(minerWallet)
  const account = await program.account.minerAccount.fetchNullable(pda)
  if (!account) return null
  return {
    wallet: account.wallet.toBase58(),
    nodeId: Array.from(account.nodeId),
    fingerprintHash: Array.from(account.fingerprintHash),
    securityBuffer: BigInt(account.securityBuffer.toString()),
    bufferCap: BigInt(account.bufferCap.toString()),
    optInBufferRouting: account.optInBufferRouting,
    bufferLockedSince: BigInt(account.bufferLockedSince.toString()),
    registeredAt: BigInt(account.registeredAt.toString()),
    unregisteredAt: BigInt(account.unregisteredAt.toString()),
    status: Object.keys(account.status)[0] ?? "unknown",
    pda: pda.toBase58(),
  }
}

export async function fetchEscrow(sessionId: Uint8Array): Promise<EscrowState | null> {
  const [pda] = deriveEscrowPda(sessionId)
  const account = await program.account.escrowAccount.fetchNullable(pda)
  if (!account) return null
  return {
    sessionId: Array.from(account.sessionId),
    tenant: account.tenant.toBase58(),
    miner: account.miner.toBase58(),
    nodeId: Array.from(account.nodeId),
    escrowAmount: BigInt(account.escrowAmount.toString()),
    platformFee: BigInt(account.platformFee.toString()),
    hourlyPrice: BigInt(account.hourlyPrice.toString()),
    expectedHours: account.expectedHours,
    hoursSettled: account.hoursSettled,
    settledBitmap: Array.from(account.settledBitmap),
    phase: Object.keys(account.phase)[0] ?? "unknown",
    startedAt: BigInt(account.startedAt.toString()),
    expiresAt: BigInt(account.expiresAt.toString()),
    completedAt: BigInt(account.completedAt.toString()),
    pda: pda.toBase58(),
  }
}
