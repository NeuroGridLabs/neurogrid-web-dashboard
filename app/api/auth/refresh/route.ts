import { NextRequest, NextResponse } from "next/server"
import { getAuthPayload, AUTH_TOKEN_COOKIE } from "@/lib/auth/middleware"
import { signJwt } from "@/lib/auth/jwt"

export const dynamic = "force-dynamic"

const TOKEN_MAX_AGE = 60 * 60 * 24 // 24 hours in seconds

/**
 * POST /api/auth/refresh
 *
 * Refresh an existing JWT before it expires.
 * Requires a valid (not yet expired) JWT in the request.
 */
export async function POST(request: NextRequest) {
  const payload = await getAuthPayload(request)

  if (!payload) {
    return NextResponse.json(
      { error: "No valid token to refresh" },
      { status: 401 },
    )
  }

  // Issue a fresh token with same claims
  const token = await signJwt({
    wallet: payload.sub,
    method: payload.method,
    role: payload.role,
  })

  const res = NextResponse.json({
    ok: true,
    token,
    wallet: payload.sub,
    method: payload.method,
    role: payload.role,
  })

  res.cookies.set(AUTH_TOKEN_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  })

  return res
}
