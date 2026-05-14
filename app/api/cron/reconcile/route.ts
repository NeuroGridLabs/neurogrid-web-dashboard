import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { scanActiveSessions } from "@/lib/reconciliation/scan-active-sessions"

export const dynamic = "force-dynamic"

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get("authorization")
  return auth === `Bearer ${secret}`
}

/**
 * GET /api/cron/reconcile
 *
 * Triggered by Vercel Cron every 6 hours. Scans all non-terminal rental_sessions
 * (ACTIVE/RECLAIMING/DISPUTED), fetches on-chain escrow PDA for each, and resolves
 * any drift per the state machine in `lib/reconciliation/state-machine.ts`.
 *
 * Returns a JSON summary of the scan: counts by outcome + per-session details.
 * Drift corrections write to settlement_errors; anomalies fire Sentry alerts.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const summary = await scanActiveSessions()

    if (summary.alerted > 0 || summary.errors > 0) {
      Sentry.captureMessage(
        `reconcile cron: ${summary.alerted} anomalies, ${summary.errors} errors out of ${summary.totalScanned} sessions`,
        { level: summary.alerted > 0 ? "error" : "warning", tags: { op: "reconcile_cron" } },
      )
    }

    return NextResponse.json({
      ok: true,
      summary: {
        totalScanned: summary.totalScanned,
        synced: summary.synced,
        updated: summary.updated,
        alerted: summary.alerted,
        ghost: summary.ghost,
        gracePeriod: summary.gracePeriod,
        errors: summary.errors,
      },
      details: summary.details,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    Sentry.captureException(e, { tags: { op: "reconcile_cron" } })
    return NextResponse.json({ error: "reconcile failed", message: msg }, { status: 500 })
  }
}
