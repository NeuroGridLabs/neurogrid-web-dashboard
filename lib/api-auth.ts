import type { NextRequest } from "next/server"

export type AuthMethod = "wallet" | "web2"

const AUTH_METHOD_COOKIE = "neurogrid_auth_method"

/**
 * Read auth method from session cookie for API route guards.
 * Returns "wallet" | "web2" | null. Use in /api/miner/* and /api/deploy/* (and /api/worker/* if added):
 * if getAuthMethodFromRequest(request) === "web2" then return 403 Forbidden.
 */
export function getAuthMethodFromRequest(request: NextRequest): AuthMethod | null {
  const value = request.cookies.get(AUTH_METHOD_COOKIE)?.value
  if (value === "wallet" || value === "web2") return value
  return null
}

export function authMethodCookieName(): string {
  return AUTH_METHOD_COOKIE
}
