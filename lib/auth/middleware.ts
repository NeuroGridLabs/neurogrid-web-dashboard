import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { verifyJwt, type NeurogridJwtPayload } from "./jwt"

const AUTH_COOKIE = "neurogrid_token"
const AUTH_HEADER = "Authorization"

/**
 * Extract JWT from request — checks Authorization header first, then cookie.
 */
function extractToken(request: NextRequest): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = request.headers.get(AUTH_HEADER)
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }

  // 2. httpOnly cookie
  return request.cookies.get(AUTH_COOKIE)?.value ?? null
}

/**
 * Verify the request has a valid JWT and return the payload.
 * Returns null if unauthenticated.
 */
export async function getAuthPayload(
  request: NextRequest,
): Promise<NeurogridJwtPayload | null> {
  const token = extractToken(request)
  if (!token) return null
  return verifyJwt(token)
}

/**
 * Require any authenticated user. Returns 401 if not authenticated.
 */
export async function requireAuth(
  request: NextRequest,
): Promise<NeurogridJwtPayload | NextResponse> {
  const payload = await getAuthPayload(request)
  if (!payload) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    )
  }
  return payload
}

/**
 * Require wallet-based authentication. Returns 401/403 appropriately.
 */
export async function requireWalletAuth(
  request: NextRequest,
): Promise<NeurogridJwtPayload | NextResponse> {
  const result = await requireAuth(request)
  if (result instanceof NextResponse) return result

  if (result.method !== "wallet") {
    return NextResponse.json(
      { error: "Wallet authentication required. Web2 users cannot perform this action." },
      { status: 403 },
    )
  }
  return result
}

/**
 * Require that the authenticated wallet matches a specific address.
 * Use for ownership verification on settlement, dispute, etc.
 */
export async function requireWalletOwnership(
  request: NextRequest,
  expectedWallet: string,
): Promise<NeurogridJwtPayload | NextResponse> {
  const result = await requireWalletAuth(request)
  if (result instanceof NextResponse) return result

  if (result.sub !== expectedWallet) {
    return NextResponse.json(
      { error: "You do not have permission to act on behalf of this wallet" },
      { status: 403 },
    )
  }
  return result
}

/**
 * Cookie name for setting JWT tokens in auth API routes.
 */
export const AUTH_TOKEN_COOKIE = AUTH_COOKIE
