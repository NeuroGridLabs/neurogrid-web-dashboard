import { describe, it, expect } from "vitest"
import {
  decideReconciliation,
  RECLAIM_GRACE_SECONDS,
  type ReconciliationDecision,
} from "./state-machine"

const NOW = 1_700_000_000_000
const FRESH = NOW - 1_000 // 1s ago
const STALE = NOW - (RECLAIM_GRACE_SECONDS + 5) * 1000 // past grace window

describe("decideReconciliation — 11-state DB×Chain matrix", () => {
  // ── case 1: ACTIVE × active ──
  it("ACTIVE + chain.active → synced", () => {
    const d = decideReconciliation("ACTIVE", "active", FRESH, NOW)
    expect(d.kind).toBe("synced")
  })

  // ── case 2: ACTIVE × disputed → mirror dispute into DB ──
  it("ACTIVE + chain.disputed → update_db to DISPUTED", () => {
    const d = decideReconciliation("ACTIVE", "disputed", FRESH, NOW)
    expect(d.kind).toBe("update_db")
    if (d.kind === "update_db") expect(d.targetPhase).toBe("DISPUTED")
  })

  // ── case 3: ACTIVE × completed → mirror settle/reclaim into DB ──
  it("ACTIVE + chain.completed → update_db to COMPLETED", () => {
    const d = decideReconciliation("ACTIVE", "completed", FRESH, NOW)
    expect(d.kind).toBe("update_db")
    if (d.kind === "update_db") expect(d.targetPhase).toBe("COMPLETED")
  })

  // ── case 4a: RECLAIMING × active within grace ──
  it("RECLAIMING + chain.active within 30s grace → grace_period", () => {
    const d = decideReconciliation("RECLAIMING", "active", FRESH, NOW)
    expect(d.kind).toBe("grace_period")
  })

  // ── case 4b: RECLAIMING × active past grace → revert to ACTIVE ──
  it("RECLAIMING + chain.active past grace → update_db revert to ACTIVE", () => {
    const d = decideReconciliation("RECLAIMING", "active", STALE, NOW)
    expect(d.kind).toBe("update_db")
    if (d.kind === "update_db") expect(d.targetPhase).toBe("ACTIVE")
  })

  // ── case 5: RECLAIMING × disputed → anomalous, alert only ──
  it("RECLAIMING + chain.disputed → alert_only critical (no DB write)", () => {
    const d = decideReconciliation("RECLAIMING", "disputed", FRESH, NOW)
    expect(d.kind).toBe("alert_only")
    if (d.kind === "alert_only") expect(d.severity).toBe("critical")
  })

  // ── case 6: RECLAIMING × completed → reclaim TX landed ──
  it("RECLAIMING + chain.completed → update_db to COMPLETED", () => {
    const d = decideReconciliation("RECLAIMING", "completed", FRESH, NOW)
    expect(d.kind).toBe("update_db")
    if (d.kind === "update_db") expect(d.targetPhase).toBe("COMPLETED")
  })

  // ── case 7: DISPUTED × active → dispute TX never landed, revert ──
  it("DISPUTED + chain.active → update_db revert to ACTIVE", () => {
    const d = decideReconciliation("DISPUTED", "active", FRESH, NOW)
    expect(d.kind).toBe("update_db")
    if (d.kind === "update_db") expect(d.targetPhase).toBe("ACTIVE")
  })

  // ── case 8: DISPUTED × disputed → synced ──
  it("DISPUTED + chain.disputed → synced", () => {
    const d = decideReconciliation("DISPUTED", "disputed", FRESH, NOW)
    expect(d.kind).toBe("synced")
  })

  // ── case 9: DISPUTED × completed → anomalous funds-touching, alert only ──
  it("DISPUTED + chain.completed → alert_only critical (no DB write)", () => {
    const d = decideReconciliation("DISPUTED", "completed", FRESH, NOW)
    expect(d.kind).toBe("alert_only")
    if (d.kind === "alert_only") expect(d.severity).toBe("critical")
  })

  // ── case 10: COMPLETED + any non-null chain → terminal, synced ──
  it.each(["active", "disputed", "completed"] as const)(
    "COMPLETED + chain.%s → synced (terminal DB state)",
    (chainPhase) => {
      const d = decideReconciliation("COMPLETED", chainPhase, FRESH, NOW)
      expect(d.kind).toBe("synced")
    },
  )

  // ── case 11a: chain has no escrow account + DB COMPLETED → reaped, synced ──
  it("COMPLETED + chain null → synced (escrow reaped)", () => {
    const d = decideReconciliation("COMPLETED", null, FRESH, NOW)
    expect(d.kind).toBe("synced")
  })

  // ── case 11b: chain has no escrow + DB non-terminal → ghost session ──
  it.each(["ACTIVE", "RECLAIMING", "DISPUTED"] as const)(
    "%s + chain null → ghost (create_escrow failed/rolled back)",
    (dbPhase) => {
      const d = decideReconciliation(dbPhase, null, FRESH, NOW)
      expect(d.kind).toBe("ghost")
    },
  )
})

describe("decideReconciliation — grace window boundary", () => {
  it("exactly at grace boundary → revert (boundary is exclusive)", () => {
    // elapsed = exactly RECLAIM_GRACE_SECONDS
    const dbUpdatedAt = NOW - RECLAIM_GRACE_SECONDS * 1000
    const d = decideReconciliation("RECLAIMING", "active", dbUpdatedAt, NOW)
    expect(d.kind).toBe("update_db")
  })

  it("just before grace boundary → grace_period", () => {
    // elapsed = RECLAIM_GRACE_SECONDS - 0.001s
    const dbUpdatedAt = NOW - (RECLAIM_GRACE_SECONDS * 1000 - 1)
    const d = decideReconciliation("RECLAIMING", "active", dbUpdatedAt, NOW)
    expect(d.kind).toBe("grace_period")
  })
})

// Exhaustiveness sanity check: every decision kind appears in tests
describe("ReconciliationDecision kinds — coverage sanity", () => {
  it("every decision kind has at least one test case", () => {
    const kinds = new Set<ReconciliationDecision["kind"]>()
    const inputs: Array<Parameters<typeof decideReconciliation>> = [
      ["ACTIVE", "active", FRESH, NOW],
      ["ACTIVE", "disputed", FRESH, NOW],
      ["RECLAIMING", "active", FRESH, NOW],
      ["RECLAIMING", "active", STALE, NOW],
      ["RECLAIMING", "disputed", FRESH, NOW],
      ["ACTIVE", null, FRESH, NOW],
    ]
    for (const args of inputs) kinds.add(decideReconciliation(...args).kind)
    expect(kinds).toEqual(new Set(["synced", "update_db", "grace_period", "alert_only", "ghost"]))
  })
})
