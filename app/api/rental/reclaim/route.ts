import { NextRequest, NextResponse } from "next/server"
import { shouldReclaim, transitionToReclaiming } from "@/lib/lifecycle/settlement"
import type { RentalSession } from "@/lib/types/escrow"

export const dynamic = "force-dynamic"

/**
 * POST: Check if a rental should transition to RECLAIMING (expires_at reached, no renewal).
 * Body: { session } (RentalSession).
 * Returns: { should_reclaim, session_after }.
 * When should_reclaim is true: drop tunnel connection and signal Miner Agent DESTROY_CONTAINER.
 */
export async function POST(request: NextRequest) {
  let body: { session?: RentalSession }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const session = body.session
  if (!session || typeof session.expires_at !== "string" || typeof session.phase !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid session (expires_at, phase required)" },
      { status: 400 }
    )
  }
  const reclaim = shouldReclaim(session)
  const sessionAfter = reclaim ? transitionToReclaiming(session) : session
  return NextResponse.json({
    should_reclaim: reclaim,
    session_after: sessionAfter,
    message: reclaim
      ? "Transition to RECLAIMING: drop tunnel, signal DESTROY_CONTAINER"
      : "No action",
  })
}
