import { NextResponse } from "next/server"
import { deriveTreasuryPda, fetchTreasury, PROGRAM_ID } from "@/lib/onchain"

export const dynamic = "force-dynamic"

const USDT_DECIMALS = 6

function lamportsToUsd(value: bigint): number {
  return Number(value) / 10 ** USDT_DECIMALS
}

export async function GET() {
  const [pda, bump] = deriveTreasuryPda()
  const state = await fetchTreasury()

  return NextResponse.json({
    program_id: PROGRAM_ID.toBase58(),
    treasury_pda: pda.toBase58(),
    treasury_bump: bump,
    initialized: state !== null,
    state: state
      ? {
          authority: state.authority,
          total_fees_collected_raw: state.totalFeesCollected.toString(),
          total_fees_collected_usd: lamportsToUsd(state.totalFeesCollected),
          total_buyback_spent_raw: state.totalBuybackSpent.toString(),
          total_buyback_spent_usd: lamportsToUsd(state.totalBuybackSpent),
          sessions_count: state.sessionsCount.toString(),
        }
      : null,
  })
}
