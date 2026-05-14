// B-008: Batch scanner that loads all non-terminal rental_sessions and reconciles each.
//
// Non-terminal phases: ACTIVE, RECLAIMING, DISPUTED. COMPLETED rows are skipped — once a
// session is terminal in DB, drift no longer matters for the active node pool.

import { createAdminClient } from "@/lib/supabase/server"
import { syncEscrowState, type SyncOutcome } from "./sync-escrow-state"

export interface ScanSummary {
  totalScanned: number
  synced: number
  updated: number
  alerted: number
  ghost: number
  gracePeriod: number
  errors: number
  details: Array<{
    sessionId: string
    outcome: SyncOutcome
  }>
}

const NON_TERMINAL_PHASES = ["ACTIVE", "RECLAIMING", "DISPUTED"] as const

export async function scanActiveSessions(): Promise<ScanSummary> {
  const db = createAdminClient()

  const { data: sessions, error } = await db
    .from("rental_sessions")
    .select("id, node_id, phase, created_at")
    .in("phase", NON_TERMINAL_PHASES as unknown as string[])

  const summary: ScanSummary = {
    totalScanned: 0,
    synced: 0,
    updated: 0,
    alerted: 0,
    ghost: 0,
    gracePeriod: 0,
    errors: 0,
    details: [],
  }

  if (error) {
    summary.errors = 1
    summary.details.push({
      sessionId: "(load)",
      outcome: { kind: "error", reason: `load sessions failed: ${error.message}` },
    })
    return summary
  }

  if (!sessions) return summary

  for (const row of sessions) {
    summary.totalScanned++
    const outcome = await syncEscrowState({
      id: row.id,
      node_id: row.node_id,
      phase: row.phase,
      updatedAt: row.created_at,
    })

    summary.details.push({ sessionId: row.id, outcome })

    switch (outcome.kind) {
      case "synced":
        summary.synced++
        break
      case "updated":
        summary.updated++
        break
      case "alerted":
        summary.alerted++
        break
      case "ghost":
        summary.ghost++
        break
      case "grace_period":
        summary.gracePeriod++
        break
      case "error":
        summary.errors++
        break
    }
  }

  return summary
}
