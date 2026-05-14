import { NextRequest, NextResponse } from "next/server"
import { AUTH_TOKEN_COOKIE } from "@/lib/auth/middleware"

export const dynamic = "force-dynamic"

/**
 * POST /api/auth/session
 *
 * Legacy endpoint — kept for backward compatibility during migration.
 * New clients should use /api/auth/connect-wallet (wallet) or Supabase Auth (web2).
 *
 * Sets a simple auth-method cookie for the transition period.
 */
export async function POST(request: NextRequest) {
  let body: { authMethod?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const method = body.authMethod
  if (method !== "wallet" && method !== "web2") {
    return NextResponse.json({ error: "authMethod must be 'wallet' or 'web2'" }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })
  // Legacy cookie for components still checking authMethod
  res.cookies.set("neurogrid_auth_method", method, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  })
  return res
}

/**
 * DELETE /api/auth/session
 * Clear both legacy and new auth cookies.
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  // Clear legacy cookie
  res.cookies.set("neurogrid_auth_method", "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 })
  // Clear JWT cookie
  res.cookies.set(AUTH_TOKEN_COOKIE, "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 })
  return res
}
