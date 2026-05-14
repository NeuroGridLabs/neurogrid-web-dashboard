// B-008: Single-session reconciliation. Given a rental_sessions row, fetches the on-chain
// escrow PDA, runs the state machine, and applies the decision (update DB, alert, etc).
//
// Returns a result enum for the batch scanner to aggregate.

import * as Sentry from "@sentry/nextjs"
import { fetchEscrow, sessionIdFromUuid } from "@/lib/onchain"
import { createAdminClient } from "@/lib/supabase/server"
import type { RentalPhase, SettlementErrorInsert } from "@/lib/supabase/types"
import { decideReconciliation, type ChainPhase, type ReconciliationDecision } from "./state-machine"

export interface SessionForSync {
  id: string
  node_id: string
  phase: RentalPhase
  /** ISO timestamp of last DB transition. We use created_at as a proxy when no explicit transition timestamp exists. */
  updatedAt: string
}

export type SyncOutcome =
  | { kind: "synced" }
  | { kind: "updated"; from: RentalPhase; to: RentalPhase; reason: string }
  | { kind: "alerted"; severity: "warning" | "critical"; reason: string }
  | { kind: "ghost"; reason: string }
  | { kind: "grace_period"; reason: string }
  | { kind: "error"; reason: string }

/**
 * Reconcile a single rental_session against its on-chain escrow PDA.
 *
 * Side effects when drift detected:
 *  - Updates rental_sessions.phase to chain truth
 *  - Inserts a row into settlement_errors documenting the drift
 *  - Captures a Sentry message at appropriate level
 */
export async function syncEscrowState(session: SessionForSync): Promise<SyncOutcome> {
  const db = createAdminClient()
  const nowMs = Date.now()

  // 1. Read chain state. Wrap in try/catch so RPC failure doesn't bring down the batch.
  let chainPhase: ChainPhase | null
  try {
    const escrow = await fetchEscrow(sessionIdFromUuid(session.id))
    chainPhase = escrow === null ? null : (escrow.phase as ChainPhase)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    Sentry.captureMessage(`reconcile.fetch_escrow_failed: ${msg}`, {
      level: "warning",
      tags: { session_id: session.id, op: "reconcile" },
    })
    return { kind: "error", reason: `fetchEscrow failed: ${msg}` }
  }

  // 2. Decide
  const updatedAtMs = new Date(session.updatedAt).getTime()
  const decision = decideReconciliation(session.phase, chainPhase, updatedAtMs, nowMs)

  // 3. Apply
  return await applyDecision(db, session, chainPhase, decision)
}

async function applyDecision(
  db: ReturnType<typeof createAdminClient>,
  session: SessionForSync,
  chainPhase: ChainPhase | null,
  decision: ReconciliationDecision,
): Promise<SyncOutcome> {
  switch (decision.kind) {
    case "synced":
      return { kind: "synced" }

    case "grace_period":
      return { kind: "grace_period", reason: decision.reason }

    case "update_db": {
      const update: { phase: RentalPhase; completed_at?: string } = { phase: decision.targetPhase }
      if (decision.targetPhase === "COMPLETED") {
        update.completed_at = new Date().toISOString()
      }
      const { error: updateErr } = await db
        .from("rental_sessions")
        .update(update)
        .eq("id", session.id)

      if (updateErr) {
        await logError(db, session.id, "reconcile_update_failed", `${decision.reason} | DB update error: ${updateErr.message}`)
        return { kind: "error", reason: `DB update failed: ${updateErr.message}` }
      }

      // When transitioning to COMPLETED, free the node so it can be rented again.
      // Other targetPhase values (DISPUTED, ACTIVE) keep the node locked.
      if (decision.targetPhase === "COMPLETED") {
        await db
          .from("nodes")
          .update({ lifecycle_status: "IDLE" as const, rented_by: null })
          .eq("id", session.node_id)
      }

      await logError(
        db,
        session.id,
        "reconcile_drift_corrected",
        `${session.phase} → ${decision.targetPhase} (chain=${chainPhase ?? "missing"}): ${decision.reason}`,
        true, // resolved=true: drift was auto-corrected
      )

      Sentry.captureMessage(
        `reconcile: ${session.phase} → ${decision.targetPhase} (session ${session.id})`,
        { level: "info", tags: { session_id: session.id, op: "reconcile" } },
      )

      return { kind: "updated", from: session.phase, to: decision.targetPhase, reason: decision.reason }
    }

    case "alert_only": {
      await logError(db, session.id, "reconcile_anomaly", `[${decision.severity}] ${decision.reason} (chain=${chainPhase ?? "missing"})`)
      Sentry.captureMessage(
        `reconcile.anomaly: ${decision.reason} (session ${session.id})`,
        {
          level: decision.severity === "critical" ? "error" : "warning",
          tags: { session_id: session.id, op: "reconcile", severity: decision.severity },
        },
      )
      return { kind: "alerted", severity: decision.severity, reason: decision.reason }
    }

    case "ghost": {
      await logError(db, session.id, "reconcile_ghost", decision.reason)
      Sentry.captureMessage(`reconcile.ghost: ${decision.reason} (session ${session.id})`, {
        level: "error",
        tags: { session_id: session.id, op: "reconcile" },
      })
      // Per decision matrix: mark COMPLETED to free node from "occupied" state.
      const { error: updateErr } = await db
        .from("rental_sessions")
        .update({ phase: "COMPLETED" as const, completed_at: new Date().toISOString() })
        .eq("id", session.id)
      if (updateErr) {
        return { kind: "error", reason: `ghost update failed: ${updateErr.message}` }
      }
      await db
        .from("nodes")
        .update({ lifecycle_status: "IDLE" as const, rented_by: null })
        .eq("id", session.node_id)
      return { kind: "ghost", reason: decision.reason }
    }
  }
}

async function logError(
  db: ReturnType<typeof createAdminClient>,
  sessionId: string,
  operation: string,
  message: string,
  resolved = false,
) {
  const insert: SettlementErrorInsert = {
    operation,
    session_id: sessionId,
    hour_index: null,
    error_message: message,
    resolved,
  }
  await db.from("settlement_errors").insert(insert)
}
