/**
 * CSRF protection for write API routes.
 *
 * Strategy: Double-submit cookie pattern.
 * - On auth (connect-wallet), server sets a CSRF token cookie (httpOnly=false, SameSite=Strict)
 * - Client reads the cookie and sends it in X-CSRF-Token header on write requests
 * - Server compares cookie value vs header value
 *
 * This works because:
 * - Cross-origin requests cannot read our cookies (SameSite=Strict)
 * - Attacker can neither read the cookie nor forge the header
 * - No server-side state needed
 */

import { randomBytes } from "crypto"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const CSRF_COOKIE = "neurogrid_csrf"
const CSRF_HEADER = "x-csrf-token"

/**
 * Generate a CSRF token and return it (to be set as cookie by the auth route).
 */
export function generateCsrfToken(): string {
  return randomBytes(24).toString("hex")
}

/**
 * Build Set-Cookie header value for the CSRF token.
 * httpOnly=false so client JS can read and send it in header.
 * SameSite=Strict to prevent cross-origin cookie sending.
 */
export function csrfCookieValue(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return `${CSRF_COOKIE}=${token}; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24}${secure}`
}

/**
 * Validate CSRF token on write requests.
 *
 * Bearer-token requests are exempt: an Authorization header must be attached
 * explicitly by the client and is never auto-sent by browsers across origins,
 * so the CSRF threat model does not apply. CSRF only protects cookie-based
 * sessions where the browser may send credentials on cross-site requests.
 *
 * Returns null if valid (or exempt), or a 403 NextResponse if invalid.
 */
export function validateCsrf(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get("authorization")
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return null
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value
  const headerToken = request.headers.get(CSRF_HEADER)

  if (!cookieToken || !headerToken) {
    return NextResponse.json(
      { error: "CSRF token missing" },
      { status: 403 },
    )
  }

  if (cookieToken !== headerToken) {
    return NextResponse.json(
      { error: "CSRF token mismatch" },
      { status: 403 },
    )
  }

  return null
}

/**
 * Cookie name for client-side CSRF reading.
 */
export const CSRF_TOKEN_COOKIE = CSRF_COOKIE
export const CSRF_TOKEN_HEADER = CSRF_HEADER
