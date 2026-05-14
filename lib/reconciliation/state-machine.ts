// B-008 state machine: maps (DB rental_phase, chain EscrowPhase) → reconciliation decision.
//
// SoT (Source of Truth) = chain. DB is a mirror/index. Drift between DB and chain is
// resolved by updating DB to match chain, unless the combination is anomalous and
// involves funds movement (case 5, case 9) — those alert only, no auto-update.

import type { RentalPhase } from "@/lib/supabase/types"

/**
 * On-chain EscrowPhase values (Anchor IDL serialization is lowercase via Object.keys).
 * Rust source: `pub enum EscrowPhase { Active, Disputed, Completed }`.
 */
export type ChainPhase = "active" | "disputed" | "completed"

/**
 * Grace window for transient states. RECLAIMING + chain.active is normal if user
 * just clicked reclaim and TX has not landed yet. After this many seconds, treat as drift.
 */
export const RECLAIM_GRACE_SECONDS = 30

export type ReconciliationDecision =
  | { kind: "synced" }
  | { kind: "update_db"; targetPhase: RentalPhase; reason: string }
  | { kind: "alert_only"; severity: "warning" | "critical"; reason: string }
  | { kind: "ghost"; reason: string } // DB row exists but chain has no escrow account
  | { kind: "grace_period"; reason: string } // transient, retry later

/**
 * Apply the reconciliation decision table.
 *
 * @param dbPhase            current DB rental_phase
 * @param chainPhase         current chain EscrowPhase (lowercase) — null if escrow account not found
 * @param dbUpdatedAt        ms timestamp of last DB transition (used for RECLAIMING grace window)
 * @param nowMs              ms timestamp (current time, injectable for tests)
 */
export function decideReconciliation(
  dbPhase: RentalPhase,
  chainPhase: ChainPhase | null,
  dbUpdatedAt: number,
  nowMs: number,
): ReconciliationDecision {
  // Case 11: chain has no escrow account
  if (chainPhase === null) {
    if (dbPhase === "COMPLETED") {
      // Terminal — completed sessions can have their escrow accounts closed/reaped
      return { kind: "synced" }
    }
    return {
      kind: "ghost",
      reason: `DB phase=${dbPhase} but chain has no escrow account — create_escrow may have failed or been rolled back`,
    }
  }

  // Terminal DB state — no reconciliation needed (escrow may still exist on chain harmlessly)
  if (dbPhase === "COMPLETED") {
    return { kind: "synced" }
  }

  // Same-phase pairs
  if (dbPhase === "ACTIVE" && chainPhase === "active") return { kind: "synced" }
  if (dbPhase === "DISPUTED" && chainPhase === "disputed") return { kind: "synced" }

  // Case 2: chain dispute happened, DB missed it → mirror to DB
  if (dbPhase === "ACTIVE" && chainPhase === "disputed") {
    return {
      kind: "update_db",
      targetPhase: "DISPUTED",
      reason: "Chain dispute landed but DB not updated (likely dispute API call did not write DB)",
    }
  }

  // Case 3: chain completed (settle/reclaim), DB missed it → mirror to DB
  if (dbPhase === "ACTIVE" && chainPhase === "completed") {
    return {
      kind: "update_db",
      targetPhase: "COMPLETED",
      reason: "Chain settle/reclaim completed but DB not updated",
    }
  }

  // Case 4: RECLAIMING + chain.active — user clicked reclaim, TX may be pending
  if (dbPhase === "RECLAIMING" && chainPhase === "active") {
    const elapsedSeconds = (nowMs - dbUpdatedAt) / 1000
    if (elapsedSeconds < RECLAIM_GRACE_SECONDS) {
      return {
        kind: "grace_period",
        reason: `RECLAIMING for ${elapsedSeconds.toFixed(0)}s — within ${RECLAIM_GRACE_SECONDS}s grace window`,
      }
    }
    return {
      kind: "update_db",
      targetPhase: "ACTIVE",
      reason: `RECLAIMING for ${elapsedSeconds.toFixed(0)}s but chain still active — reclaim TX failed/abandoned, revert`,
    }
  }

  // Case 5: RECLAIMING + chain.disputed — anomalous (reclaim should land before dispute)
  if (dbPhase === "RECLAIMING" && chainPhase === "disputed") {
    return {
      kind: "alert_only",
      severity: "critical",
      reason: "Anomalous: DB shows RECLAIMING but chain shows DISPUTED — investigate manually",
    }
  }

  // Case 6: reclaim TX confirmed
  if (dbPhase === "RECLAIMING" && chainPhase === "completed") {
    return {
      kind: "update_db",
      targetPhase: "COMPLETED",
      reason: "Reclaim TX landed on chain, update DB to terminal state",
    }
  }

  // Case 7: DB marked disputed but chain still active — dispute TX never landed
  if (dbPhase === "DISPUTED" && chainPhase === "active") {
    return {
      kind: "update_db",
      targetPhase: "ACTIVE",
      reason: "DB marked DISPUTED but chain still ACTIVE — dispute TX did not land, revert",
    }
  }

  // Case 9: dispute resolved on chain (funds settled). Anomalous because resolution should
  // trigger off-chain notification path; if we got here, that path failed.
  if (dbPhase === "DISPUTED" && chainPhase === "completed") {
    return {
      kind: "alert_only",
      severity: "critical",
      reason: "Dispute resolved on chain (funds settled) but DB still DISPUTED — investigate fund flow before auto-updating",
    }
  }

  // Should be unreachable given exhaustive enumeration above.
  return {
    kind: "alert_only",
    severity: "warning",
    reason: `Unhandled state pair: db=${dbPhase} chain=${chainPhase}`,
  }
}
