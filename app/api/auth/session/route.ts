import { NextRequest, NextResponse } from "next/server"
import { authMethodCookieName } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

/**
 * POST: Set session auth method (wallet | web2). Body: { authMethod: "wallet" | "web2" }.
 * Called by the client when the user connects wallet or logs in via Web2.
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
  const name = authMethodCookieName()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(name, method, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  })
  return res
}

/**
 * DELETE: Clear session (logout). Removes auth method cookie.
 */
export async function DELETE() {
  const name = authMethodCookieName()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(name, "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 })
  return res
}
