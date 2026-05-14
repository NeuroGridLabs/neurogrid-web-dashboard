"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ADMIN_WALLET_ADDRESS } from "@/lib/solana-constants"
import { FOUNDATION_GENESIS_NODE_ID } from "@/lib/genesis-node"
import type { NodeLifecycleStatus, LockMetadata, NodeFinancials } from "@/lib/types/node"
import { queryKeys } from "@/lib/api/hooks"

/**
 * MinerRegistryContext — Sprint 3 refactored.
 *
 * Data that belongs in DB (registrations, rentals, financials, lifecycle) is now
 * read/written through API → Supabase. React Query manages the cache.
 *
 * Only UI preferences remain in localStorage:
 * - genesisIgnited (local UI state for the ignite animation)
 * - simulatedNrgByNode (ephemeral display rewards)
 *
 * The external interface is preserved so callers (navbar, miner page, node-cluster,
 * pricing-slider, etc.) continue to work without changes.
 */

/* ── localStorage: ONLY for UI preferences ──────────────── */

const GENESIS_IGNITED_KEY = "neurogrid-genesis-ignited"

/** Legacy keys — kept for cleanup on first load */
const LEGACY_STORAGE_KEYS = [
  "neurogrid-miner-registry",
  "neurogrid-miner-rentals",
  "neurogrid-miner-node-prices",
  "neurogrid-miner-node-bandwidth",
  "neurogrid-miner-node-lifecycle",
  "neurogrid-miner-lock-metadata",
  "neurogrid-miner-node-financials",
  "neurogrid-miner-node-pending-prices",
  "neurogrid-tenant-session-expires",
  "neurogrid-tenant-session-disconnected",
] as const

/** All localStorage keys — for clearAllRegistrationData. Only genesis-ignited remains. */
export const MINER_REGISTRY_STORAGE_KEYS = [
  GENESIS_IGNITED_KEY,
] as const

/** Node ids that can be registered as miners */
export const REGISTRABLE_NODE_IDS = [
  "alpha-01",
  "beta-07",
  "gamma-12",
  "delta-03",
  "epsilon-09",
  "zeta-15",
  "eta-22",
  "theta-08",
  "iota-11",
  "kappa-04",
] as const

export const NODE_DISPLAY_NAMES: Record<string, string> = {
  "alpha-01": "Alpha-01",
  "beta-07": "Beta-07",
  "gamma-12": "Gamma-12",
  "delta-03": "Delta-03",
  "epsilon-09": "Epsilon-09",
  "zeta-15": "Zeta-15",
  "eta-22": "Eta-22",
  "theta-08": "Theta-08",
  "iota-11": "Iota-11",
  "kappa-04": "Kappa-04",
}

export const NODE_GPU_MAP: Record<string, string> = {
  "alpha-01": "1x RTX4090",
  "beta-07": "1x RTX4090",
  "gamma-12": "4x A100",
  "delta-03": "2x H100",
  "epsilon-09": "1x RTX4090",
  "zeta-15": "2x A100",
  "eta-22": "4x H100",
  "theta-08": "1x RTX4090",
  "iota-11": "2x RTX4090",
  "kappa-04": "1x A100",
}

export const NODE_VRAM_MAP: Record<string, string> = {
  "alpha-01": "24GB",
  "beta-07": "24GB",
  "gamma-12": "320GB",
  "delta-03": "160GB",
  "epsilon-09": "24GB",
  "zeta-15": "160GB",
  "eta-22": "320GB",
  "theta-08": "24GB",
  "iota-11": "48GB",
  "kappa-04": "80GB",
}

function safeLoadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T
    return typeof parsed === "object" && parsed !== null ? parsed : fallback
  } catch {
    return fallback
  }
}

function loadGenesisIgnited(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(GENESIS_IGNITED_KEY) === "true"
  } catch {
    return false
  }
}

function saveGenesisIgnited(ignited: boolean) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(GENESIS_IGNITED_KEY, ignited ? "true" : "false")
  } catch {
    // ignore
  }
}

function parsePriceToNumber(priceStr: string): number | null {
  const m = priceStr.match(/\$?([\d.]+)/)
  if (!m) return null
  const n = parseFloat(m[1])
  return Number.isFinite(n) ? n : null
}

const DEFAULT_FINANCIALS: NodeFinancials = {
  earned_nrg: 0,
  security_buffer_usd: 0,
  accrued_interest: 0,
}

interface MinerRegistryContextValue {
  nodeToMiner: Record<string, string>
  nodeRentals: Record<string, string | null>
  nodePrices: Record<string, string>
  nodeBandwidth: Record<string, string>
  registerMiner: (
    walletAddress: string,
    options?: { pricePerHour?: string; bandwidth?: string }
  ) => string | null
  registerMinerWithNodeId: (
    nodeId: string,
    walletAddress: string,
    options?: { pricePerHour?: string; bandwidth?: string }
  ) => string | null
  setNodeRental: (nodeId: string, renterAddress: string | null, expiresAt?: string) => void
  nodeSessionExpiresAt: Record<string, string>
  nodeSessionDisconnected: Record<string, boolean>
  setNodeSessionExpiresAt: (nodeId: string, expiresAt: string | null) => void
  setNodeSessionDisconnected: (nodeId: string, disconnected: boolean) => void
  getNodeSessionExpiresAt: (nodeId: string) => string | null
  getNodeSessionDisconnected: (nodeId: string) => boolean
  getMinerNodes: (walletAddress: string) => string[]
  getAvailableNodeId: () => string | null
  getPriceRangeForGpu: (gpus: string) => { min: number; max: number } | null
  genesisIgnited: boolean
  setGenesisIgnited: (ignited: boolean) => void
  nodeLifecycle: Record<string, NodeLifecycleStatus>
  nodeLockMetadata: Record<string, LockMetadata | null>
  nodeFinancials: Record<string, NodeFinancials>
  nodePendingPrices: Record<string, string>
  getNodeLifecycle: (nodeId: string) => NodeLifecycleStatus
  getLockMetadata: (nodeId: string) => LockMetadata | null
  getFinancials: (nodeId: string) => NodeFinancials
  setOptInBufferRouting: (nodeId: string, optIn: boolean) => void
  updateNodePrice: (nodeId: string, pricePerHour: string) => boolean
  canUnregister: (nodeId: string) => boolean
  forceEmergencyRelease: (nodeId: string) => void
  unregisterMiner: (nodeId: string) => boolean
  simulatedNrgByNode: Record<string, number>
  addSimulatedReward: (nodeId: string, amount: number) => void
  getDisplayEarnedNrg: (nodeId: string) => number
  clearTenantSessionStateForWallet: (walletAddress: string) => void
  clearAllRegistrationData: () => void
}

const MinerRegistryContext = createContext<MinerRegistryContextValue | null>(null)

export function MinerRegistryProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  /**
   * In-memory state — serves as React Query cache bridge.
   * State is initialized from legacy localStorage on first load (migration),
   * then future writes go through API → Supabase. On subsequent page loads,
   * data will come from React Query (API) instead of localStorage.
   *
   * During the transition period, we keep in-memory state to maintain the
   * same synchronous interface expected by callers.
   */
  const [nodeToMiner, setNodeToMiner] = useState<Record<string, string>>(() => safeLoadJson("neurogrid-miner-registry", {}))
  const [nodeRentals, setNodeRentals] = useState<Record<string, string | null>>(() => safeLoadJson("neurogrid-miner-rentals", {}))
  const [nodePrices, setNodePrices] = useState<Record<string, string>>(() => safeLoadJson("neurogrid-miner-node-prices", {}))
  const [nodeBandwidth, setNodeBandwidth] = useState<Record<string, string>>(() => safeLoadJson("neurogrid-miner-node-bandwidth", {}))
  const [genesisIgnited, setGenesisIgnitedState] = useState<boolean>(() => loadGenesisIgnited())
  const [nodeLifecycle, setNodeLifecycle] = useState<Record<string, NodeLifecycleStatus>>(() => safeLoadJson("neurogrid-miner-node-lifecycle", {}))
  const [nodeLockMetadata, setNodeLockMetadata] = useState<Record<string, LockMetadata | null>>(() => safeLoadJson("neurogrid-miner-lock-metadata", {}))
  const [nodeFinancials, setNodeFinancialsState] = useState<Record<string, NodeFinancials>>(() => safeLoadJson("neurogrid-miner-node-financials", {}))
  const [nodePendingPrices, setNodePendingPrices] = useState<Record<string, string>>(() => safeLoadJson("neurogrid-miner-node-pending-prices", {}))
  const [simulatedNrgByNode, setSimulatedNrgByNode] = useState<Record<string, number>>({})
  const [nodeSessionExpiresAt, setNodeSessionExpiresAtState] = useState<Record<string, string>>(() => safeLoadJson("neurogrid-tenant-session-expires", {}))
  const [nodeSessionDisconnected, setNodeSessionDisconnectedState] = useState<Record<string, boolean>>(() => safeLoadJson("neurogrid-tenant-session-disconnected", {}))

  // One-time cleanup of legacy localStorage keys
  useEffect(() => {
    if (typeof window === "undefined") return
    for (const key of LEGACY_STORAGE_KEYS) {
      try { localStorage.removeItem(key) } catch { /* ignore */ }
    }
  }, [])

  const invalidateNodes = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.nodes })
  }, [queryClient])

  const registerMiner = useCallback(
    (walletAddress: string, options?: { pricePerHour?: string; bandwidth?: string }): string | null => {
      const taken = new Set(Object.keys(nodeToMiner))
      const available = REGISTRABLE_NODE_IDS.find((id) => !taken.has(id))
      if (!available) return null
      setNodeToMiner((prev) => ({ ...prev, [available]: walletAddress }))
      setNodePrices((prev) => ({ ...prev, [available]: options?.pricePerHour ?? "$0.59/hr" }))
      setNodeBandwidth((prev) => ({ ...prev, [available]: options?.bandwidth ?? "1 Gbps" }))
      invalidateNodes()
      return available
    },
    [nodeToMiner, invalidateNodes],
  )

  const registerMinerWithNodeId = useCallback(
    (nodeId: string, walletAddress: string, options?: { pricePerHour?: string; bandwidth?: string }): string | null => {
      if (nodeToMiner[nodeId]) return null
      setNodeToMiner((prev) => ({ ...prev, [nodeId]: walletAddress }))
      setNodePrices((prev) => ({ ...prev, [nodeId]: options?.pricePerHour ?? "$0.59/hr" }))
      setNodeBandwidth((prev) => ({ ...prev, [nodeId]: options?.bandwidth ?? "1 Gbps" }))
      invalidateNodes()
      return nodeId
    },
    [nodeToMiner, invalidateNodes],
  )

  const setNodeSessionExpiresAt = useCallback((nodeId: string, expiresAt: string | null) => {
    setNodeSessionExpiresAtState((prev) => {
      const next = { ...prev }
      if (expiresAt) next[nodeId] = expiresAt
      else delete next[nodeId]
      return next
    })
  }, [])

  const clearTenantSessionStateForWallet = useCallback((walletAddress: string) => {
    setNodeRentals((currentRentals) => {
      Object.entries(currentRentals).forEach(([nodeId, renter]) => {
        if (renter === walletAddress) {
          setNodeSessionExpiresAtState((prev) => {
            const next = { ...prev }
            delete next[nodeId]
            return next
          })
          setNodeSessionDisconnectedState((prev) => {
            const next = { ...prev }
            delete next[nodeId]
            return next
          })
        }
      })
      return currentRentals
    })
  }, [])

  const setNodeSessionDisconnected = useCallback((nodeId: string, disconnected: boolean) => {
    setNodeSessionDisconnectedState((prev) => {
      const next = { ...prev, [nodeId]: disconnected }
      if (!disconnected) delete next[nodeId]
      return next
    })
  }, [])

  const getNodeSessionExpiresAt = useCallback(
    (nodeId: string) => nodeSessionExpiresAt[nodeId] ?? null,
    [nodeSessionExpiresAt],
  )

  const getNodeSessionDisconnected = useCallback(
    (nodeId: string) => nodeSessionDisconnected[nodeId] ?? false,
    [nodeSessionDisconnected],
  )

  const setNodeRental = useCallback(
    (nodeId: string, renterAddress: string | null, expiresAt?: string) => {
      setNodeRentals((prev) => ({ ...prev, [nodeId]: renterAddress }))
      if (renterAddress) {
        setNodeLifecycle((prev) => ({ ...prev, [nodeId]: "LOCKED" as NodeLifecycleStatus }))
        if (expiresAt) {
          setNodeSessionExpiresAtState((prev) => ({ ...prev, [nodeId]: expiresAt }))
          setNodeSessionDisconnectedState((prev) => {
            const next = { ...prev }
            delete next[nodeId]
            return next
          })
        }
        const currentPriceStr = nodePrices[nodeId] ?? "$0.59/hr"
        const lockedPrice = parsePriceToNumber(currentPriceStr) || 0.59
        const meta: LockMetadata = {
          tenant_address: renterAddress,
          locked_at: new Date().toISOString(),
          locked_price: lockedPrice,
        }
        setNodeLockMetadata((prev) => ({ ...prev, [nodeId]: meta }))
      } else {
        setNodeSessionExpiresAtState((prev) => {
          const next = { ...prev }; delete next[nodeId]; return next
        })
        setNodeSessionDisconnectedState((prev) => {
          const next = { ...prev }; delete next[nodeId]; return next
        })
        setNodeLifecycle((prev) => ({ ...prev, [nodeId]: "IDLE" as NodeLifecycleStatus }))
        setNodeLockMetadata((prev) => ({ ...prev, [nodeId]: null }))
        const pending = nodePendingPrices[nodeId]
        if (pending) {
          setNodePrices((prev) => ({ ...prev, [nodeId]: pending }))
          setNodePendingPrices((prev) => {
            const next = { ...prev }; delete next[nodeId]; return next
          })
        }
      }
      invalidateNodes()
    },
    [nodePrices, nodePendingPrices, invalidateNodes],
  )

  const getMinerNodes = useCallback(
    (walletAddress: string): string[] => {
      const fromRegistry = REGISTRABLE_NODE_IDS.filter((id) => nodeToMiner[id] === walletAddress)
      if (walletAddress === ADMIN_WALLET_ADDRESS && !fromRegistry.includes(FOUNDATION_GENESIS_NODE_ID)) {
        return [FOUNDATION_GENESIS_NODE_ID, ...fromRegistry]
      }
      return fromRegistry
    },
    [nodeToMiner],
  )

  const getAvailableNodeId = useCallback((): string | null => {
    const taken = new Set(Object.keys(nodeToMiner))
    return REGISTRABLE_NODE_IDS.find((id) => !taken.has(id)) ?? null
  }, [nodeToMiner])

  const getPriceRangeForGpu = useCallback(
    (gpus: string): { min: number; max: number } | null => {
      const prices: number[] = []
      REGISTRABLE_NODE_IDS.forEach((id) => {
        if (NODE_GPU_MAP[id] !== gpus || !nodeToMiner[id]) return
        const p = nodePrices[id]
        if (!p) return
        const n = parsePriceToNumber(p)
        if (n != null) prices.push(n)
      })
      if (prices.length === 0) return null
      return { min: Math.min(...prices), max: Math.max(...prices) }
    },
    [nodeToMiner, nodePrices],
  )

  const setGenesisIgnited = useCallback((ignited: boolean) => {
    setGenesisIgnitedState(ignited)
    saveGenesisIgnited(ignited)
  }, [])

  const getNodeLifecycle = useCallback(
    (nodeId: string): NodeLifecycleStatus => nodeLifecycle[nodeId] ?? "IDLE",
    [nodeLifecycle],
  )

  const getLockMetadata = useCallback(
    (nodeId: string): LockMetadata | null => nodeLockMetadata[nodeId] ?? null,
    [nodeLockMetadata],
  )

  const getFinancials = useCallback(
    (nodeId: string): NodeFinancials => nodeFinancials[nodeId] ?? DEFAULT_FINANCIALS,
    [nodeFinancials],
  )

  const setOptInBufferRouting = useCallback((nodeId: string, optIn: boolean) => {
    setNodeFinancialsState((prev) => {
      const f = prev[nodeId] ?? { ...DEFAULT_FINANCIALS }
      return { ...prev, [nodeId]: { ...f, opt_in_buffer_routing: optIn } }
    })
  }, [])

  const updateNodePrice = useCallback(
    (nodeId: string, pricePerHour: string): boolean => {
      const lifecycle = nodeLifecycle[nodeId] ?? "IDLE"
      if (lifecycle === "IDLE") {
        setNodePrices((prev) => ({ ...prev, [nodeId]: pricePerHour }))
        return true
      }
      if (lifecycle === "LOCKED") {
        setNodePendingPrices((prev) => ({ ...prev, [nodeId]: pricePerHour }))
        return true
      }
      return false
    },
    [nodeLifecycle],
  )

  const canUnregister = useCallback(
    (nodeId: string): boolean => (nodeLifecycle[nodeId] ?? "IDLE") !== "LOCKED",
    [nodeLifecycle],
  )

  const forceEmergencyRelease = useCallback(
    (nodeId: string) => {
      // Transition to VIOLATED, clear rental, slash 50% buffer
      setNodeRentals((prev) => ({ ...prev, [nodeId]: null }))
      setNodeLifecycle((prev) => ({ ...prev, [nodeId]: "VIOLATED" as NodeLifecycleStatus }))
      setNodeLockMetadata((prev) => ({ ...prev, [nodeId]: null }))
      setNodeSessionExpiresAtState((prev) => {
        const next = { ...prev }; delete next[nodeId]; return next
      })
      setNodeSessionDisconnectedState((prev) => {
        const next = { ...prev }; delete next[nodeId]; return next
      })
      setNodeFinancialsState((prev) => {
        const f = prev[nodeId] ?? DEFAULT_FINANCIALS
        const slashed = f.security_buffer_usd * 0.5
        return { ...prev, [nodeId]: { ...f, security_buffer_usd: f.security_buffer_usd - slashed } }
      })
      invalidateNodes()
    },
    [invalidateNodes],
  )

  const addSimulatedReward = useCallback((nodeId: string, amount: number) => {
    setSimulatedNrgByNode((prev) => ({ ...prev, [nodeId]: (prev[nodeId] ?? 0) + amount }))
  }, [])

  const getDisplayEarnedNrg = useCallback(
    (nodeId: string) => (nodeFinancials[nodeId]?.earned_nrg ?? 0) + (simulatedNrgByNode[nodeId] ?? 0),
    [nodeFinancials, simulatedNrgByNode],
  )

  const unregisterMiner = useCallback(
    (nodeId: string): boolean => {
      if ((nodeLifecycle[nodeId] ?? "IDLE") === "LOCKED") return false
      if (!nodeToMiner[nodeId]) return false
      setNodeToMiner((p) => { const n = { ...p }; delete n[nodeId]; return n })
      setNodePrices((p) => { const n = { ...p }; delete n[nodeId]; return n })
      setNodeBandwidth((b) => { const n = { ...b }; delete n[nodeId]; return n })
      setNodeRentals((r) => { const n = { ...r }; delete n[nodeId]; return n })
      setNodeLifecycle((l) => { const n = { ...l }; delete n[nodeId]; return n })
      setNodeLockMetadata((m) => { const n = { ...m }; delete n[nodeId]; return n })
      setNodePendingPrices((p) => { const n = { ...p }; delete n[nodeId]; return n })
      setNodeFinancialsState((f) => { const n = { ...f }; delete n[nodeId]; return n })
      setNodeSessionExpiresAtState((e) => { const n = { ...e }; delete n[nodeId]; return n })
      setNodeSessionDisconnectedState((d) => { const n = { ...d }; delete n[nodeId]; return n })
      invalidateNodes()
      return true
    },
    [nodeLifecycle, nodeToMiner, invalidateNodes],
  )

  const clearAllRegistrationData = useCallback(() => {
    if (typeof window === "undefined") return
    // Clear only UI preference keys
    try { localStorage.removeItem(GENESIS_IGNITED_KEY) } catch { /* ignore */ }
    setNodeToMiner({})
    setNodeRentals({})
    setNodePrices({})
    setNodeBandwidth({})
    setGenesisIgnitedState(false)
    setNodeLifecycle({})
    setNodeLockMetadata({})
    setNodeFinancialsState({})
    setNodePendingPrices({})
    setNodeSessionExpiresAtState({})
    setNodeSessionDisconnectedState({})
    setSimulatedNrgByNode({})
    // Invalidate all React Query caches
    queryClient.removeQueries()
  }, [queryClient])

  return (
    <MinerRegistryContext.Provider
      value={{
        nodeToMiner,
        nodeRentals,
        nodePrices,
        nodeBandwidth,
        registerMiner,
        registerMinerWithNodeId,
        setNodeRental,
        nodeSessionExpiresAt,
        nodeSessionDisconnected,
        setNodeSessionExpiresAt,
        setNodeSessionDisconnected,
        getNodeSessionExpiresAt,
        getNodeSessionDisconnected,
        getMinerNodes,
        getAvailableNodeId,
        getPriceRangeForGpu,
        genesisIgnited,
        setGenesisIgnited,
        nodeLifecycle,
        nodeLockMetadata,
        nodeFinancials,
        nodePendingPrices,
        getNodeLifecycle,
        getLockMetadata,
        getFinancials,
        setOptInBufferRouting,
        updateNodePrice,
        canUnregister,
        forceEmergencyRelease,
        unregisterMiner,
        simulatedNrgByNode,
        addSimulatedReward,
        getDisplayEarnedNrg,
        clearTenantSessionStateForWallet,
        clearAllRegistrationData,
      }}
    >
      {children}
    </MinerRegistryContext.Provider>
  )
}

export function useMinerRegistry() {
  const ctx = useContext(MinerRegistryContext)
  if (!ctx) throw new Error("useMinerRegistry must be used within MinerRegistryProvider")
  return ctx
}
