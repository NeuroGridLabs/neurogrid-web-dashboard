/**
 * Session-key derivation for tunnel sessions.
 *
 * Both the deploy/assign endpoint (issuing the key to the tenant) and the
 * miner's session-lookup endpoint (revealing the key to the assigned miner)
 * derive the same key from session_id + RELAY_API_SECRET. No plaintext key
 * is stored in the database; if the database is compromised in isolation,
 * tunnel sessions remain confidential as long as RELAY_API_SECRET is kept
 * out of the database tier.
 */

import { createHmac } from "crypto"

const PREFIX = "ng_sess_"

/**
 * Deterministically derive the relay session key for a given session ID.
 *
 * @param sessionId - The rental session UUID.
 * @returns A stable session-key string of form "ng_sess_<24-hex>".
 * @throws if RELAY_API_SECRET is not configured.
 */
export function deriveSessionKey(sessionId: string): string {
  const secret = process.env.RELAY_API_SECRET
  if (!secret) {
    throw new Error("RELAY_API_SECRET is not configured")
  }
  const digest = createHmac("sha256", secret).update(sessionId).digest("hex")
  return `${PREFIX}${digest.slice(0, 24)}`
}
