"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { ADMIN_WALLET_ADDRESS } from "@/lib/solana-constants"
import { FOUNDATION_GENESIS_NODE_ID } from "@/lib/genesis-node"
import type { NodeLifecycleStatus, LockMetadata, NodeFinancials } from "@/lib/types/node"

const STORAGE_KEY = "neurogrid-miner-registry"
const RENTALS_STORAGE_KEY = "neurogrid-miner-rentals"
const PRICES_STORAGE_KEY = "neurogrid-miner-node-prices"
const BANDWIDTH_STORAGE_KEY = "neurogrid-miner-node-bandwidth"
const GENESIS_IGNITED_KEY = "neurogrid-genesis-ignited"
const LIFECYCLE_STORAGE_KEY = "neurogrid-miner-node-lifecycle"
const LOCK_METADATA_STORAGE_KEY = "neurogrid-miner-lock-metadata"
const FINANCIALS_STORAGE_KEY = "neurogrid-miner-node-financials"
const PENDING_PRICES_STORAGE_KEY = "neurogrid-miner-node-pending-prices"
const SESSION_EXPIRES_KEY = "neurogrid-tenant-session-expires"
const SESSION_DISCONNECTED_KEY = "neurogrid-tenant-session-disconnected"

/** All localStorage keys used for miner/registration/test data (for clear-all). */
export const MINER_REGISTRY_STORAGE_KEYS = [
  STORAGE_KEY,
  RENTALS_STORAGE_KEY,
  PRICES_STORAGE_KEY,
  BANDWIDTH_STORAGE_KEY,
  GENESIS_IGNITED_KEY,
  LIFECYCLE_STORAGE_KEY,
  LOCK_METADATA_STORAGE_KEY,
  FINANCIALS_STORAGE_KEY,
  PENDING_PRICES_STORAGE_KEY,
  SESSION_EXPIRES_KEY,
  SESSION_DISCONNECTED_KEY,
] as const

/** Node ids that can be registered as miners (same pool as Node Command Center) */
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

/** Node id -> GPU spec for price range by same-type */
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

/** Node id -> VRAM for fallback node list (when no backend) */
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

function loadNodeToMiner(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function saveNodeToMiner(map: Record<string, string>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function loadNodeRentals(): Record<string, string | null> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(RENTALS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string | null>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function saveNodeRentals(map: Record<string, string | null>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(RENTALS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function loadNodePrices(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(PRICES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function saveNodePrices(map: Record<string, string>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(PRICES_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function loadNodeBandwidth(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(BANDWIDTH_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function saveNodeBandwidth(map: Record<string, string>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(BANDWIDTH_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
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

function loadNodeLifecycle(): Record<string, NodeLifecycleStatus> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(LIFECYCLE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    const out: Record<string, NodeLifecycleStatus> = {}
    for (const [id, s] of Object.entries(parsed)) {
      if (s === "IDLE" || s === "LOCKED" || s === "OFFLINE_VIOLATION" || s === "VIOLATED") out[id] = s as NodeLifecycleStatus
    }
    return out
  } catch {
    return {}
  }
}

function saveNodeLifecycle(map: Record<string, NodeLifecycleStatus>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LIFECYCLE_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function loadLockMetadata(): Record<string, LockMetadata | null> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(LOCK_METADATA_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, LockMetadata | null>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function saveLockMetadata(map: Record<string, LockMetadata | null>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LOCK_METADATA_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function loadNodeFinancials(): Record<string, NodeFinancials> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(FINANCIALS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, NodeFinancials>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function saveNodeFinancials(map: Record<string, NodeFinancials>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(FINANCIALS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function loadPendingPrices(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(PENDING_PRICES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function savePendingPrices(map: Record<string, string>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(PENDING_PRICES_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function loadSessionExpires(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(SESSION_EXPIRES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function saveSessionExpires(map: Record<string, string>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SESSION_EXPIRES_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function loadSessionDisconnected(): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(SESSION_DISCONNECTED_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function saveSessionDisconnected(map: Record<string, boolean>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SESSION_DISCONNECTED_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
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

function parsePriceToNumber(priceStr: string): number | null {
  const m = priceStr.match(/\$?([\d.]+)/)
  if (!m) return null
  const n = parseFloat(m[1])
  return Number.isFinite(n) ? n : null
}

function getInitialNodeToMiner(): Record<string, string> {
  if (typeof window === "undefined") return {}
  return loadNodeToMiner()
}

const DEFAULT_FINANCIALS: NodeFinancials = {
  earned_nrg: 0,
  security_buffer_usd: 0,
  accrued_interest: 0,
}

export function MinerRegistryProvider({ children }: { children: ReactNode }) {
  const [nodeToMiner, setNodeToMiner] = useState<Record<string, string>>(getInitialNodeToMiner)
  const [nodeRentals, setNodeRentals] = useState<Record<string, string | null>>(() => loadNodeRentals())
  const [nodePrices, setNodePrices] = useState<Record<string, string>>(() => loadNodePrices())
  const [nodeBandwidth, setNodeBandwidth] = useState<Record<string, string>>(() => loadNodeBandwidth())
  const [genesisIgnited, setGenesisIgnitedState] = useState<boolean>(() => loadGenesisIgnited())
  const [nodeLifecycle, setNodeLifecycle] = useState<Record<string, NodeLifecycleStatus>>(() => loadNodeLifecycle())
  const [nodeLockMetadata, setNodeLockMetadata] = useState<Record<string, LockMetadata | null>>(() => loadLockMetadata())
  const [nodeFinancials, setNodeFinancialsState] = useState<Record<string, NodeFinancials>>(() => loadNodeFinancials())
  const [nodePendingPrices, setNodePendingPrices] = useState<Record<string, string>>(() => loadPendingPrices())
  const [simulatedNrgByNode, setSimulatedNrgByNode] = useState<Record<string, number>>({})
  const [nodeSessionExpiresAt, setNodeSessionExpiresAtState] = useState<Record<string, string>>(() => loadSessionExpires())
  const [nodeSessionDisconnected, setNodeSessionDisconnectedState] = useState<Record<string, boolean>>(() => loadSessionDisconnected())

  useEffect(() => {
    setNodeToMiner(loadNodeToMiner())
  }, [])
  useEffect(() => {
    setNodePrices(loadNodePrices())
  }, [])
  useEffect(() => {
    setNodeBandwidth(loadNodeBandwidth())
  }, [])

  const persistNodeToMiner = useCallback((map: Record<string, string>) => {
    setNodeToMiner(map)
    saveNodeToMiner(map)
  }, [])

  const registerMiner = useCallback(
    (
      walletAddress: string,
      options?: { pricePerHour?: string; bandwidth?: string }
    ): string | null => {
      const current = loadNodeToMiner()
      const taken = new Set(Object.keys(current))
      const available = REGISTRABLE_NODE_IDS.find((id) => !taken.has(id))
      if (!available) return null
      const next = { ...current, [available]: walletAddress }
      persistNodeToMiner(next)
      const price = options?.pricePerHour ?? "$0.59/hr"
      const bandwidth = options?.bandwidth ?? "1 Gbps"
      setNodePrices((prev) => {
        const nextP = { ...prev, [available]: price }
        saveNodePrices(nextP)
        return nextP
      })
      setNodeBandwidth((prev) => {
        const nextB = { ...prev, [available]: bandwidth }
        saveNodeBandwidth(nextB)
        return nextB
      })
      return available
    },
    [persistNodeToMiner]
  )

  const registerMinerWithNodeId = useCallback(
    (
      nodeId: string,
      walletAddress: string,
      options?: { pricePerHour?: string; bandwidth?: string }
    ): string | null => {
      const current = loadNodeToMiner()
      if (current[nodeId]) return null
      const next = { ...current, [nodeId]: walletAddress }
      persistNodeToMiner(next)
      const price = options?.pricePerHour ?? "$0.59/hr"
      const bandwidth = options?.bandwidth ?? "1 Gbps"
      setNodePrices((prev) => {
        const nextP = { ...prev, [nodeId]: price }
        saveNodePrices(nextP)
        return nextP
      })
      setNodeBandwidth((prev) => {
        const nextB = { ...prev, [nodeId]: bandwidth }
        saveNodeBandwidth(nextB)
        return nextB
      })
      return nodeId
    },
    [persistNodeToMiner]
  )

  const setNodeSessionExpiresAt = useCallback((nodeId: string, expiresAt: string | null) => {
    setNodeSessionExpiresAtState((prev) => {
      const next = { ...prev }
      if (expiresAt) next[nodeId] = expiresAt
      else delete next[nodeId]
      saveSessionExpires(next)
      return next
    })
  }, [])

  const clearTenantSessionStateForWallet = useCallback((walletAddress: string) => {
    Object.entries(nodeRentals).forEach(([nodeId, renter]) => {
      if (renter === walletAddress) {
        setNodeSessionExpiresAtState((prev) => {
          const next = { ...prev }
          delete next[nodeId]
          saveSessionExpires(next)
          return next
        })
        setNodeSessionDisconnectedState((prev) => {
          const next = { ...prev }
          delete next[nodeId]
          saveSessionDisconnected(next)
          return next
        })
      }
    })
  }, [nodeRentals])

  const setNodeSessionDisconnected = useCallback((nodeId: string, disconnected: boolean) => {
    setNodeSessionDisconnectedState((prev) => {
      const next = { ...prev, [nodeId]: disconnected }
      if (!disconnected) delete next[nodeId]
      saveSessionDisconnected(next)
      return next
    })
  }, [])

  const getNodeSessionExpiresAt = useCallback(
    (nodeId: string) => nodeSessionExpiresAt[nodeId] ?? null,
    [nodeSessionExpiresAt]
  )

  const getNodeSessionDisconnected = useCallback(
    (nodeId: string) => nodeSessionDisconnected[nodeId] ?? false,
    [nodeSessionDisconnected]
  )

  const setNodeRental = useCallback(
    (nodeId: string, renterAddress: string | null, expiresAt?: string) => {
      setNodeRentals((prev) => {
        const next = { ...prev, [nodeId]: renterAddress }
        saveNodeRentals(next)
        return next
      })
      if (renterAddress) {
        setNodeLifecycle((prev) => {
          const next = { ...prev, [nodeId]: "LOCKED" as NodeLifecycleStatus }
          saveNodeLifecycle(next)
          return next
        })
        if (expiresAt) {
          setNodeSessionExpiresAtState((prev) => {
            const next = { ...prev, [nodeId]: expiresAt }
            saveSessionExpires(next)
            return next
          })
          setNodeSessionDisconnectedState((prev) => {
            const next = { ...prev }
            delete next[nodeId]
            saveSessionDisconnected(next)
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
        setNodeLockMetadata((prev) => {
          const next = { ...prev, [nodeId]: meta }
          saveLockMetadata(next)
          return next
        })
      } else {
        setNodeSessionExpiresAtState((prev) => {
          const next = { ...prev }
          delete next[nodeId]
          saveSessionExpires(next)
          return next
        })
        setNodeSessionDisconnectedState((prev) => {
          const next = { ...prev }
          delete next[nodeId]
          saveSessionDisconnected(next)
          return next
        })
        setNodeLifecycle((prev) => {
          const next = { ...prev, [nodeId]: "IDLE" as NodeLifecycleStatus }
          saveNodeLifecycle(next)
          return next
        })
        setNodeLockMetadata((prev) => {
          const next = { ...prev, [nodeId]: null }
          saveLockMetadata(next)
          return next
        })
        const pending = nodePendingPrices[nodeId]
        if (pending) {
          setNodePrices((prev) => {
            const next = { ...prev, [nodeId]: pending }
            saveNodePrices(next)
            return next
          })
          setNodePendingPrices((prev) => {
            const next = { ...prev }
            delete next[nodeId]
            savePendingPrices(next)
            return next
          })
        }
      }
    },
    [nodePrices, nodePendingPrices]
  )

  const getMinerNodes = useCallback(
    (walletAddress: string): string[] => {
      const fromRegistry = REGISTRABLE_NODE_IDS.filter((id) => nodeToMiner[id] === walletAddress)
      if (walletAddress === ADMIN_WALLET_ADDRESS && !fromRegistry.includes(FOUNDATION_GENESIS_NODE_ID)) {
        return [FOUNDATION_GENESIS_NODE_ID, ...fromRegistry]
      }
      return fromRegistry
    },
    [nodeToMiner]
  )

  const getAvailableNodeId = useCallback((): string | null => {
    const taken = new Set(Object.keys(nodeToMiner))
    return REGISTRABLE_NODE_IDS.find((id) => !taken.has(id)) ?? null
  }, [nodeToMiner])

  const getPriceRangeForGpu = useCallback(
    (gpus: string): { min: number; max: number } | null => {
      const prices: number[] = []
      REGISTRABLE_NODE_IDS.forEach((id) => {
        if (NODE_GPU_MAP[id] !== gpus) return
        if (!nodeToMiner[id]) return
        const p = nodePrices[id]
        if (!p) return
        const n = parsePriceToNumber(p)
        if (n != null) prices.push(n)
      })
      if (prices.length === 0) return null
      return { min: Math.min(...prices), max: Math.max(...prices) }
    },
    [nodeToMiner, nodePrices]
  )

  const setGenesisIgnited = useCallback((ignited: boolean) => {
    setGenesisIgnitedState(ignited)
    saveGenesisIgnited(ignited)
  }, [])

  const getNodeLifecycle = useCallback(
    (nodeId: string): NodeLifecycleStatus => nodeLifecycle[nodeId] ?? "IDLE",
    [nodeLifecycle]
  )

  const getLockMetadata = useCallback(
    (nodeId: string): LockMetadata | null => nodeLockMetadata[nodeId] ?? null,
    [nodeLockMetadata]
  )

  const getFinancials = useCallback(
    (nodeId: string): NodeFinancials => nodeFinancials[nodeId] ?? DEFAULT_FINANCIALS,
    [nodeFinancials]
  )

  const setOptInBufferRouting = useCallback((nodeId: string, optIn: boolean) => {
    setNodeFinancialsState((prev) => {
      const f = prev[nodeId] ?? { ...DEFAULT_FINANCIALS }
      const next = { ...prev, [nodeId]: { ...f, opt_in_buffer_routing: optIn } }
      saveNodeFinancials(next)
      return next
    })
  }, [])

  const updateNodePrice = useCallback(
    (nodeId: string, pricePerHour: string): boolean => {
      const lifecycle = nodeLifecycle[nodeId] ?? "IDLE"
      if (lifecycle === "IDLE") {
        setNodePrices((prev) => {
          const next = { ...prev, [nodeId]: pricePerHour }
          saveNodePrices(next)
          return next
        })
        return true
      }
      if (lifecycle === "LOCKED") {
        setNodePendingPrices((prev) => {
          const next = { ...prev, [nodeId]: pricePerHour }
          savePendingPrices(next)
          return next
        })
        return true
      }
      return false
    },
    [nodeLifecycle]
  )

  const canUnregister = useCallback(
    (nodeId: string): boolean => (nodeLifecycle[nodeId] ?? "IDLE") !== "LOCKED",
    [nodeLifecycle]
  )

  const forceEmergencyRelease = useCallback(
    (nodeId: string) => {
      setNodeRentals((prev) => {
        const next = { ...prev, [nodeId]: null }
        saveNodeRentals(next)
        return next
      })
      setNodeLifecycle((prev) => {
        const next = { ...prev, [nodeId]: "VIOLATED" as NodeLifecycleStatus }
        saveNodeLifecycle(next)
        return next
      })
      setNodeLockMetadata((prev) => {
        const next = { ...prev, [nodeId]: null }
        saveLockMetadata(next)
        return next
      })
      setNodeSessionExpiresAtState((prev) => {
        const next = { ...prev }; delete next[nodeId]; saveSessionExpires(next); return next
      })
      setNodeSessionDisconnectedState((prev) => {
        const next = { ...prev }; delete next[nodeId]; saveSessionDisconnected(next); return next
      })
      setNodeFinancialsState((prev) => {
        const f = prev[nodeId] ?? DEFAULT_FINANCIALS
        const slashed = f.security_buffer_usd * 0.5
        const next = { ...prev, [nodeId]: { ...f, security_buffer_usd: f.security_buffer_usd - slashed } }
        saveNodeFinancials(next)
        return next
      })
    },
    []
  )

  const addSimulatedReward = useCallback((nodeId: string, amount: number) => {
    setSimulatedNrgByNode((prev) => ({ ...prev, [nodeId]: (prev[nodeId] ?? 0) + amount }))
  }, [])

  const getDisplayEarnedNrg = useCallback(
    (nodeId: string) => (nodeFinancials[nodeId]?.earned_nrg ?? 0) + (simulatedNrgByNode[nodeId] ?? 0),
    [nodeFinancials, simulatedNrgByNode]
  )

  const unregisterMiner = useCallback(
    (nodeId: string): boolean => {
      if ((nodeLifecycle[nodeId] ?? "IDLE") === "LOCKED") return false
      const current = loadNodeToMiner()
      if (!current[nodeId]) return false
      const next = { ...current }
      delete next[nodeId]
      persistNodeToMiner(next)
      setNodePrices((p) => {
        const n = { ...p }; delete n[nodeId]; saveNodePrices(n); return n
      })
      setNodeBandwidth((b) => {
        const n = { ...b }; delete n[nodeId]; saveNodeBandwidth(n); return n
      })
      setNodeRentals((r) => { const n = { ...r }; delete n[nodeId]; saveNodeRentals(n); return n })
      setNodeLifecycle((l) => { const n = { ...l }; delete n[nodeId]; saveNodeLifecycle(n); return n })
      setNodeLockMetadata((m) => { const n = { ...m }; delete n[nodeId]; saveLockMetadata(n); return n })
      setNodePendingPrices((p) => { const n = { ...p }; delete n[nodeId]; savePendingPrices(n); return n })
      setNodeFinancialsState((f) => { const n = { ...f }; delete n[nodeId]; saveNodeFinancials(n); return n })
      setNodeSessionExpiresAtState((e) => { const n = { ...e }; delete n[nodeId]; saveSessionExpires(n); return n })
      setNodeSessionDisconnectedState((d) => { const n = { ...d }; delete n[nodeId]; saveSessionDisconnected(n); return n })
      return true
    },
    [nodeLifecycle, persistNodeToMiner]
  )

  const clearAllRegistrationData = useCallback(() => {
    if (typeof window === "undefined") return
    for (const key of MINER_REGISTRY_STORAGE_KEYS) {
      localStorage.removeItem(key)
    }
    const empty: Record<string, string> = {}
    const emptyNull: Record<string, string | null> = {}
    const emptyLifecycle: Record<string, NodeLifecycleStatus> = {}
    const emptyLock: Record<string, LockMetadata | null> = {}
    const emptyFinancials: Record<string, NodeFinancials> = {}
    const emptyBool: Record<string, boolean> = {}
    saveNodeToMiner(empty)
    saveNodeRentals(emptyNull)
    saveNodePrices(empty)
    saveNodeBandwidth(empty)
    saveGenesisIgnited(false)
    saveNodeLifecycle(emptyLifecycle)
    saveLockMetadata(emptyLock)
    saveNodeFinancials(emptyFinancials)
    savePendingPrices(empty)
    saveSessionExpires(empty)
    saveSessionDisconnected(emptyBool)
    setNodeToMiner(empty)
    setNodeRentals(emptyNull)
    setNodePrices(empty)
    setNodeBandwidth(empty)
    setGenesisIgnitedState(false)
    setNodeLifecycle(emptyLifecycle)
    setNodeLockMetadata(emptyLock)
    setNodeFinancialsState(emptyFinancials)
    setNodePendingPrices(empty)
    setNodeSessionExpiresAtState(empty)
    setNodeSessionDisconnectedState(emptyBool)
    setSimulatedNrgByNode({})
  }, [])

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
