import { NextRequest, NextResponse } from "next/server"
import { ADMIN_WALLET_ADDRESS } from "@/lib/solana-constants"
import { requireWalletOwnership } from "@/lib/auth/middleware"
import { createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

/**
 * GET /api/admin/settlement-errors
 *
 * Returns recent cron settlement errors, newest first.
 * Admin-only (wallet must equal ADMIN_WALLET_ADDRESS).
 *
 * Query params:
 *   - limit:        number, default 100, max 500
 *   - unresolved:   "1" to return only resolved=false (default returns all)
 *   - operation:    filter by operation type (e.g. "settle")
 */
export async function GET(request: NextRequest) {
  const auth = await requireWalletOwnership(request, ADMIN_WALLET_ADDRESS)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT,
    MAX_LIMIT,
  )
  const unresolvedOnly = searchParams.get("unresolved") === "1"
  const operation = searchParams.get("operation")

  const db = createAdminClient()
  let q = db
    .from("settlement_errors")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (unresolvedOnly) q = q.eq("resolved", false)
  if (operation) q = q.eq("operation", operation)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: "Failed to load errors", details: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: data?.length ?? 0, errors: data ?? [] })
}
