import { SignJWT, jwtVerify, type JWTPayload } from "jose"

export interface NeurogridJwtPayload extends JWTPayload {
  /** Solana wallet address (Base58) or Supabase user ID for web2 */
  sub: string
  /** Auth method */
  method: "wallet" | "web2"
  /** User role at time of issuance */
  role: "miner" | "tenant"
}

const ALG = "HS256"

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET environment variable is not set")
  return new TextEncoder().encode(secret)
}

function getExpiryHours(): number {
  const hours = Number(process.env.JWT_EXPIRY_HOURS)
  return Number.isFinite(hours) && hours > 0 ? hours : 24
}

/**
 * Sign a new JWT for an authenticated user.
 */
export async function signJwt(payload: {
  wallet: string
  method: "wallet" | "web2"
  role: "miner" | "tenant"
}): Promise<string> {
  const expiryHours = getExpiryHours()

  return new SignJWT({
    sub: payload.wallet,
    method: payload.method,
    role: payload.role,
  } satisfies NeurogridJwtPayload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${expiryHours}h`)
    .setIssuer("neurogrid")
    .sign(getSecret())
}

/**
 * Verify and decode a JWT. Returns the payload or null if invalid/expired.
 */
export async function verifyJwt(
  token: string,
): Promise<NeurogridJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "neurogrid",
    })
    return payload as NeurogridJwtPayload
  } catch {
    return null
  }
}

/**
 * Check if a JWT is close to expiry (within 1 hour by default).
 * Used by the client to decide when to call /api/auth/refresh.
 */
export function isTokenExpiringSoon(
  payload: NeurogridJwtPayload,
  thresholdMs: number = 60 * 60 * 1000,
): boolean {
  if (!payload.exp) return true
  return payload.exp * 1000 - Date.now() < thresholdMs
}
