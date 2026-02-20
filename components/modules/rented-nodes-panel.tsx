"use client"

import { useState, useEffect } from "react"
import { KeyRound, Download, Copy, AlertTriangle } from "lucide-react"
import { GpuBar } from "@/components/atoms/gpu-bar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { RentedNodeSnapshot } from "@/components/modules/node-cluster"

/** Placeholder session key for legacy snapshots that don't have session_key (do not expose raw gateway/port). */
function fallbackSessionKey(nodeId: string): string {
  const slug = nodeId.replace(/-/g, "").slice(0, 12)
  const pad = "0".repeat(12)
  return `ng_sess_${(slug + pad).slice(0, 24)}`
}

function ConnectionDetailsModal({
  node,
  walletAddress,
  open,
  onOpenChange,
}: {
  node: RentedNodeSnapshot
  walletAddress: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const sessionKey = node.session_key ?? fallbackSessionKey(node.id)
  const [copied, setCopied] = useState(false)
  const [clientDownloaded, setClientDownloaded] = useState(false)

  const handleCopySessionKey = async () => {
    try {
      await navigator.clipboard.writeText(sessionKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const handleDownloadClient = () => {
    setClientDownloaded(true)
    const blob = new Blob(
      ["# NeuroClient placeholder\n# Replace with real Mac/Win installer when built.\n# Secure tunnel client — no raw IP/port exposure.\n"],
      { type: "text/plain" }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "NeuroClient-README.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border"
        style={{
          backgroundColor: "var(--terminal-bg)",
          borderColor: "rgba(0,255,65,0.3)",
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-bold uppercase tracking-wider" style={{ color: "#00FF41" }}>
            Secure Access — {node.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-xs">
          {/* Step 1: Get the Client */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(0,255,65,0.6)" }}>
              Step 1 — Get the Client
            </span>
            <button
              type="button"
              onClick={handleDownloadClient}
              className="inline-flex w-full items-center justify-center gap-2 border px-4 py-3 text-sm font-medium transition-colors hover:opacity-90"
              style={{
                borderColor: clientDownloaded ? "rgba(0,255,65,0.4)" : "#00FF41",
                color: "#00FF41",
                backgroundColor: clientDownloaded ? "rgba(0,255,65,0.06)" : "rgba(0,255,65,0.08)",
              }}
            >
              <Download className="h-4 w-4 shrink-0" />
              {clientDownloaded ? "NeuroClient (Mac/Win) — downloaded" : "Download NeuroClient (Mac/Win)"}
            </button>
          </div>

          {/* Step 2: Connection Key */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(0,255,65,0.6)" }}>
              Step 2 — Connection Key
            </span>
            <div
              className="rounded border p-3 font-mono text-[11px] tracking-tight"
              style={{
                borderColor: "rgba(0,255,65,0.25)",
                backgroundColor: "rgba(0,0,0,0.4)",
                color: "rgba(0,255,65,0.9)",
              }}
            >
              {sessionKey}
            </div>
            <button
              type="button"
              onClick={handleCopySessionKey}
              className="inline-flex w-full items-center justify-center gap-2 border px-4 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors hover:opacity-90"
              style={{ borderColor: "#00FF41", color: "#00FF41", backgroundColor: "rgba(0,255,65,0.12)" }}
            >
              <Copy className="h-4 w-4 shrink-0" />
              {copied ? "Copied" : "Copy Session Key"}
            </button>
            <p className="text-[10px] leading-relaxed" style={{ color: "rgba(0,255,65,0.65)" }}>
              Paste this key into your NeuroClient to establish a secure, encrypted tunnel to your GPU. No raw IP or port is exposed.
            </p>
          </div>

          <div
            className="space-y-1.5 rounded border p-3 text-[10px]"
            style={{
              borderColor: "rgba(0,255,65,0.2)",
              backgroundColor: "rgba(0,255,65,0.04)",
              color: "rgba(0,255,65,0.7)",
            }}
          >
            <p className="font-semibold" style={{ color: "#00FF41" }}>
              📦 DATA AIRLOCK & QoS GUIDE:
            </p>
            <ul className="list-inside list-disc space-y-0.5">
              <li><strong>Small Scripts:</strong> Use VS Code Remote / SFTP (Speed limited).</li>
              <li><strong>Public Models:</strong> Run <code className="font-mono">wget --limit-rate=20m [URL]</code> inside the node.</li>
              <li><strong>Large Private Data:</strong> Use P2P <code className="font-mono">croc</code>. DO NOT upload &gt;1GB via SFTP.</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface RentedNodesPanelProps {
  walletAddress?: string | null
  rentedNodes: RentedNodeSnapshot[]
  onUndeploy?: (nodeId: string) => void
  onRedeploy?: (nodeId: string) => void
}

const ROW_GAP = 6
/** ~2mm below device info */
const CARD_PADDING_BOTTOM = 6
/** One row = 2 cards; fixed height so container never grows, scroll for more */
const SINGLE_ROW_HEIGHT_PX = 106

const RENEWAL_WARNING_MINUTES = 30

function formatCountdown(expiresAtIso: string): { text: string; remainingMs: number } {
  const remainingMs = new Date(expiresAtIso).getTime() - Date.now()
  if (remainingMs <= 0) return { text: "0:00", remainingMs: 0 }
  const totalSec = Math.floor(remainingMs / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const h = Math.floor(m / 60)
  const mins = m % 60
  const text = h > 0 ? `${h}:${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`
  return { text, remainingMs }
}

export function RentedNodesPanel({ walletAddress, rentedNodes, onUndeploy, onRedeploy }: RentedNodesPanelProps) {
  const [credentialNode, setCredentialNode] = useState<RentedNodeSnapshot | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const hasDisconnected = rentedNodes.some((n) => n.disconnected && n.expires_at)
    if (!hasDisconnected) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [rentedNodes])

  return (
    <>
      <div
        className="flex flex-col overflow-hidden border border-border"
        style={{ backgroundColor: "var(--terminal-bg)" }}
      >
        <div
          className="flex items-center justify-between border-b border-border px-3 py-1.5"
          style={{ backgroundColor: "rgba(0,255,65,0.03)" }}
        >
          <span className="text-xs uppercase tracking-wider" style={{ color: "#00cc33" }}>
            My Rented Nodes
          </span>
          {rentedNodes.length > 0 && (
            <span className="text-xs" style={{ color: "rgba(0,255,65,0.4)" }}>
              {rentedNodes.length} node{rentedNodes.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div
          className="grid grid-cols-2 gap-x-3 gap-y-2 overflow-x-hidden overflow-y-auto px-2.5 py-2"
          style={{
            maxHeight: SINGLE_ROW_HEIGHT_PX,
            scrollbarWidth: "thin",
          }}
        >
          {rentedNodes.length === 0 ? (
            <div
              className="col-span-2 flex items-center justify-center py-4 text-xs"
              style={{ color: "rgba(0,255,65,0.4)" }}
            >
              No rented nodes. Deploy from Node Command Center above.
            </div>
          ) : (
            rentedNodes.map((node) => (
              <div
                key={node.id}
                className="grid grid-cols-[1fr_auto] gap-x-2 rounded border pl-2 pr-2 pt-1 pb-1 shrink-0"
                style={{
                  borderColor: "rgba(0,255,65,0.15)",
                  backgroundColor: "rgba(0,255,65,0.02)",
                  paddingBottom: CARD_PADDING_BOTTOM,
                }}
              >
                {/* Left column: name, gateway, device info — tight spacing */}
                <div className="flex min-w-0 flex-col gap-0">
                  <span className="truncate text-xs font-bold" style={{ color: "#00FF41" }}>
                    {node.name}
                  </span>
                  {node.disconnected && node.expires_at ? (
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[10px] font-medium" style={{ color: "rgba(255,200,0,0.95)" }} title={node.expires_at}>
                        Reclaim in {formatCountdown(node.expires_at).text}
                      </span>
                      <span className="text-[9px]" style={{ color: "rgba(0,255,255,0.6)" }}>
                        {new Date(node.expires_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })} reclaim
                      </span>
                      {formatCountdown(node.expires_at).remainingMs > 0 && formatCountdown(node.expires_at).remainingMs < RENEWAL_WARNING_MINUTES * 60 * 1000 && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-medium" style={{ color: "#ff9800" }}>
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          Renew within 30 min or the instance will be reclaimed
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setCredentialNode(node)}
                          className="inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] transition-opacity hover:opacity-90"
                          style={{ borderColor: "rgba(0,255,65,0.4)", color: "#00FF41" }}
                          aria-label="Secure access — Session Key & NeuroClient"
                        >
                          <KeyRound className="h-3 w-3 shrink-0" />
                          Access
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px]" style={{ color: "rgba(0,255,65,0.5)" }}>
                          {node.gpus} {node.vram}
                        </span>
                        <div className="w-14 shrink-0">
                          <GpuBar value={node.utilization} color="#00FF41" hideLabel />
                        </div>
                        <span className="text-[10px] font-medium" style={{ color: "#00FF41" }}>
                          {node.utilization}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
                {/* Right column: ACTIVE + Undeploy / Redeploy */}
                <div className="flex min-w-[72px] flex-col items-stretch gap-0.5">
                  <span
                    className="inline-flex items-center rounded border px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: node.disconnected ? "rgba(0,255,255,0.08)" : "rgba(0,255,65,0.1)",
                      color: node.disconnected ? "#00FFFF" : "#00FF41",
                      borderColor: node.disconnected ? "rgba(0,255,255,0.35)" : "rgba(0,255,65,0.35)",
                    }}
                  >
                    <span className="flex w-4 shrink-0 justify-center">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: node.disconnected ? "#00FFFF" : "#00FF41", boxShadow: node.disconnected ? "0 0 4px #00FFFF" : "0 0 4px #00FF41" }}
                      />
                    </span>
                    {node.disconnected ? "Disconnected" : node.status}
                  </span>
                  {node.disconnected && (!node.expires_at || new Date(node.expires_at) > new Date()) ? (
                    <button
                      type="button"
                      onClick={() => onRedeploy?.(node.id)}
                      className="inline-flex items-center rounded border px-2 py-0.5 text-xs transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: "rgba(0,255,255,0.1)",
                        color: "#00FFFF",
                        borderColor: "rgba(0,255,255,0.35)",
                      }}
                      aria-label="Redeploy"
                      title="Redeploy (no extra charge until session ends)"
                    >
                      <span className="flex w-4 shrink-0 justify-center">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: "#00FFFF", boxShadow: "0 0 4px #00FFFF" }}
                        />
                      </span>
                      Redeploy
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onUndeploy?.(node.id)}
                      className="inline-flex items-center rounded border px-2 py-0.5 text-xs transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: "rgba(255,68,68,0.1)",
                        color: "#ff4444",
                        borderColor: "rgba(255,68,68,0.35)",
                      }}
                      aria-label="Undeploy"
                      title="Undeploy"
                    >
                      <span className="flex w-4 shrink-0 justify-center">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: "#ff4444", boxShadow: "0 0 4px #ff4444" }}
                        />
                      </span>
                      Undeploy
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {credentialNode && (
        <ConnectionDetailsModal
          node={credentialNode}
          walletAddress={walletAddress ?? null}
          open={!!credentialNode}
          onOpenChange={(open) => !open && setCredentialNode(null)}
        />
      )}
    </>
  )
}
