"use client"

import { useState, useCallback, useEffect } from "react"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/modules/footer"
import { ScanlineOverlay } from "@/components/atoms/scanline-overlay"
import { NodeCluster, type RentedNodeSnapshot } from "@/components/modules/node-cluster"
import { RentedNodesPanel } from "@/components/modules/rented-nodes-panel"
import { SmartTerminal } from "@/components/modules/smart-terminal"
import { TreasuryViz } from "@/components/modules/treasury-viz"
import { useWallet, useRole, useMinerRegistry, NODE_DISPLAY_NAMES, NODE_GPU_MAP, NODE_VRAM_MAP } from "@/lib/contexts"
import { FOUNDATION_GENESIS_NODE_ID } from "@/lib/genesis-node"
import { Wallet, Clock } from "lucide-react"

const RENTED_SNAPSHOTS_KEY = "neurogrid-rented-snapshots"

function loadRentedSnapshots(walletAddress: string): RentedNodeSnapshot[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(RENTED_SNAPSHOTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Record<string, RentedNodeSnapshot[]>
    const list = parsed[walletAddress]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveRentedSnapshots(walletAddress: string, list: RentedNodeSnapshot[]) {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(RENTED_SNAPSHOTS_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, RentedNodeSnapshot[]>) : {}
    all[walletAddress] = list
    localStorage.setItem(RENTED_SNAPSHOTS_KEY, JSON.stringify(all))
  } catch {
    // ignore
  }
}

/** Build a placeholder snapshot for a node we know is rented by this wallet but have no saved snapshot (e.g. after refresh or data loss). */
function syntheticSnapshot(
  nodeId: string,
  status: RentedNodeSnapshot["status"] = "OCCUPIED"
): RentedNodeSnapshot {
  return {
    id: nodeId,
    name: NODE_DISPLAY_NAMES[nodeId] ?? nodeId,
    gpus: NODE_GPU_MAP[nodeId] ?? "—",
    vram: NODE_VRAM_MAP[nodeId] ?? "—",
    status,
    utilization: 0,
    gateway: "—",
    port: 0,
  }
}

function formatCountdown(expiresAtIso: string): string {
  const remainingMs = new Date(expiresAtIso).getTime() - Date.now()
  if (remainingMs <= 0) return "0:00"
  const totalSec = Math.floor(remainingMs / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const h = Math.floor(m / 60)
  const mins = m % 60
  return h > 0 ? `${h}:${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`
}

import { AuthModal } from "@/components/auth/tenant-auth-modal"

export default function NodesPage() {
  const { isConnected, address, openConnectModal } = useWallet()
  const { isTenantWorkspace } = useRole()
  const { nodeRentals, setNodeRental } = useMinerRegistry() ?? { nodeRentals: {}, setNodeRental: () => {} }
  const [terminalMinimized, setTerminalMinimized] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [myRentedNodes, setMyRentedNodes] = useState<RentedNodeSnapshot[]>([])
  const [triggerUndeployNodeId, setTriggerUndeployNodeId] = useState<string | null>(null)
  const [redeployNodeId, setRedeployNodeId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (myRentedNodes.some((n) => n.expires_at)) {
      const id = setInterval(() => setTick((t) => t + 1), 1000)
      return () => clearInterval(id)
    }
  }, [myRentedNodes])

  useEffect(() => {
    if (!isConnected || !address) return
    const loaded = loadRentedSnapshots(address)
    const byId = new Map(loaded.map((n) => [n.id, n]))
    for (const [nodeId, renterAddr] of Object.entries(nodeRentals)) {
      if (renterAddr === address && !byId.has(nodeId)) {
        byId.set(nodeId, syntheticSnapshot(nodeId))
      }
    }
    const merged = Array.from(byId.values())
    setMyRentedNodes(merged)
    if (merged.length !== loaded.length) saveRentedSnapshots(address, merged)
  }, [isConnected, address, nodeRentals])

  // Expiry cleanup: remove sessions past expires_at and release node
  useEffect(() => {
    if (!address) return
    const now = new Date()
    const stillValid: RentedNodeSnapshot[] = []
    myRentedNodes.forEach((n) => {
      const exp = n.expires_at ? new Date(n.expires_at) : null
      if (exp && exp <= now) {
        setNodeRental(n.id, null)
      } else {
        stillValid.push(n)
      }
    })
    if (stillValid.length < myRentedNodes.length) {
      setMyRentedNodes(stillValid)
      saveRentedSnapshots(address, stillValid)
    }
  }, [address, myRentedNodes, setNodeRental])

  const handleDeployComplete = useCallback((node: RentedNodeSnapshot) => {
    setMyRentedNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]))
      byId.set(node.id, node)
      const next = Array.from(byId.values())
      if (address) saveRentedSnapshots(address, next)
      return next
    })
  }, [address])
  const handleUndeployComplete = useCallback((nodeId: string, options?: { keepSession?: boolean; expires_at?: string }) => {
    if (options?.keepSession) {
      setMyRentedNodes((prev) => {
        const next = prev.map((n) =>
          n.id === nodeId ? { ...n, disconnected: true, expires_at: options.expires_at ?? n.expires_at } : n
        )
        if (address) saveRentedSnapshots(address, next)
        return next
      })
    } else {
      setMyRentedNodes((prev) => {
        const next = prev.filter((n) => n.id !== nodeId)
        if (address) saveRentedSnapshots(address, next)
        return next
      })
    }
    setTriggerUndeployNodeId(null)
  }, [address])
  const handleUndeployFromPanel = useCallback((nodeId: string) => {
    setTriggerUndeployNodeId(nodeId)
  }, [])
  const handleUndeployModalOpen = useCallback(() => {
    setTriggerUndeployNodeId(null)
  }, [])

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "#050505" }}>
      <ScanlineOverlay />
      <Navbar />

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 md:px-10">
        {/* Instances panel: active rentals + countdown + RENEW/ADD FUNDS */}
        {isTenantWorkspace && isConnected && (
          <div
            className="rounded border p-6"
            style={{
              borderColor: "rgba(0,255,255,0.3)",
              backgroundColor: "rgba(0,255,255,0.04)",
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: "#00FFFF" }}>
                <Clock className="h-4 w-4" />
                Instances — Active Rentals
              </h2>
              <button
                type="button"
                onClick={openConnectModal}
                className="flex items-center gap-2 rounded border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-90"
                style={{ borderColor: "#00FFFF", color: "#00FFFF", backgroundColor: "rgba(0,255,255,0.1)" }}
              >
                <Wallet className="h-4 w-4" />
                Renew / Add Funds
              </button>
            </div>
            <p className="mb-3 text-[10px]" style={{ color: "rgba(0,255,255,0.7)" }}>
              Prevent the 3-step Kill Switch (reclamation): renew or add funds before your session expires.
            </p>
            {myRentedNodes.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {myRentedNodes.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center justify-between rounded border px-3 py-2"
                    style={{ borderColor: "rgba(0,255,255,0.2)", backgroundColor: "rgba(0,255,255,0.03)" }}
                  >
                    <span className="text-xs font-medium" style={{ color: "#00FF41" }}>
                      {node.name}
                    </span>
                    {node.expires_at && new Date(node.expires_at) > new Date() && (
                      <span className="text-[10px] tabular-nums" style={{ color: "rgba(255,200,0,0.95)" }}>
                        Expires in {formatCountdown(node.expires_at)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px]" style={{ color: "rgba(0,255,255,0.5)" }}>
                No active instances. Rent a node from the Node Command Center below.
              </p>
            )}
          </div>
        )}

        {/* Title - Compute Marketplace */}
          <div
            className="flex flex-col gap-2 border border-border p-6"
          style={{ backgroundColor: "rgba(0,255,65,0.02)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-sm font-bold tracking-wider md:text-base" style={{ color: "#00FF41" }}>
              NODES
            </h1>
            <span className="text-xs" style={{ color: "rgba(0,255,65,0.3)" }}>|</span>
            <span className="text-xs" style={{ color: "rgba(0,255,65,0.4)" }}>
              Compute Marketplace
            </span>
          </div>
          <p className="text-xs" style={{ color: "rgba(0,255,65,0.5)" }}>
            Rent decentralized GPU compute — Physical hardware verified via Proof-of-Inference
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium" style={{ color: "rgba(255,200,0,0.95)" }}>
              Epoch 0: Network Ignition Pending.
            </p>
            <a
              href={process.env.NEXT_PUBLIC_GENESIS_WAITLIST_URL || "https://discord.gg"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-90"
              style={{ borderColor: "#00FF41", color: "#00FF41" }}
            >
              <span aria-hidden>🔒</span>
              Apply for Genesis Whitelist
            </a>
          </div>
        </div>

        {/* Grid: Nodes + Treasury */}
        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <NodeCluster
            isConnected={isConnected}
            walletAddress={address}
            onRequireAuth={() => setAuthModalOpen(true)}
            onDeployComplete={handleDeployComplete}
            onUndeployComplete={handleUndeployComplete}
            triggerUndeployNodeId={triggerUndeployNodeId}
            onUndeployModalOpen={handleUndeployModalOpen}
            redeployNodeId={redeployNodeId}
            onRedeployConsumed={() => setRedeployNodeId(null)}
          />
          <TreasuryViz />
        </div>

        {/* My Rented Nodes: only nodes ordered by connected wallet; 2 per row, scroll for more */}
        {isConnected && (
          <RentedNodesPanel
            walletAddress={address}
            rentedNodes={Array.from(new Map(myRentedNodes.map((n) => [n.id, n])).values())}
            onUndeploy={handleUndeployFromPanel}
            onRedeploy={setRedeployNodeId}
          />
        )}
        {/* Terminal */}
        <SmartTerminal
          isMinimized={terminalMinimized}
          onToggleMinimize={() => setTerminalMinimized((m) => !m)}
        />
      </main>

      <Footer />
    </div>
  )
}
