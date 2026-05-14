/**
 * In-memory node heartbeat store.
 * Shared between /api/heartbeat (writes) and /api/nodes (reads).
 *
 * For Epoch 0 this is sufficient — serverless cold starts will reset state,
 * which is acceptable since nodes re-report within 30s.
 * Production would use Supabase or Redis.
 */

export interface NodeHeartbeat {
  nodeId: string
  wallet: string
  lastSeen: number // Unix ms
  gpuUtilPct: number
  gpuTempC: number
  gpuMemUsedMiB: number
  gpuMemTotalMiB: number
  gpuPowerW: number
  activeSession: string | null
  tunnelMode: string
  uptimeSec: number
}

// Node is offline if no heartbeat for 100s (3+ missed 30s intervals)
export const OFFLINE_THRESHOLD_MS = 100_000

export const heartbeatStore = new Map<string, NodeHeartbeat>()

export function isNodeOnline(hb: NodeHeartbeat): boolean {
  return Date.now() - hb.lastSeen < OFFLINE_THRESHOLD_MS
}
