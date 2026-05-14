/**
 * Server-side client for the NeuroGrid Relay server.
 * Used by API routes to register tunnel sessions after escrow creation.
 */

const RELAY_URL =
  process.env.RELAY_INTERNAL_URL ?? process.env.NEXT_PUBLIC_RELAY_URL ?? ""
const RELAY_SECRET = process.env.RELAY_API_SECRET ?? ""

interface RegisterSessionResult {
  ok: boolean
  session_hash?: string
  error?: string
}

/**
 * Register a tunnel session on the relay so miner and tenant can connect.
 * Called after deploy/assign creates the rental session in DB.
 */
export async function registerRelaySession(
  sessionId: string,
  sessionKey: string,
): Promise<RegisterSessionResult> {
  if (!RELAY_URL) {
    console.warn("[relay-client] RELAY_INTERNAL_URL not configured, skipping session registration")
    return { ok: true, error: "relay not configured" }
  }
  if (!RELAY_SECRET) {
    console.warn("[relay-client] RELAY_API_SECRET not configured")
    return { ok: false, error: "relay secret not configured" }
  }

  const url = `${RELAY_URL.replace(/^ws/, "http")}/api/session`

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RELAY_SECRET}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        session_key: sessionKey,
      }),
    })

    if (!resp.ok) {
      const text = await resp.text()
      console.error(`[relay-client] Register session failed (${resp.status}): ${text}`)
      return { ok: false, error: text }
    }

    const data = await resp.json()
    return { ok: true, session_hash: data.session_hash }
  } catch (err) {
    console.error("[relay-client] Network error:", err)
    return { ok: false, error: String(err) }
  }
}
