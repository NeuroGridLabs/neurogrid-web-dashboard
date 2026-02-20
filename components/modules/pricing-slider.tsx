"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { HelpCircle, Zap, TrendingUp, LockKeyhole, Wallet, Percent, ChevronDown, DollarSign, LogOut, AlertTriangle, Lock } from "lucide-react"
import { useWallet, useMinerRegistry, NODE_DISPLAY_NAMES } from "@/lib/contexts"
import { FOUNDATION_GENESIS_NODE_ID, isGenesisNode } from "@/lib/genesis-node"
import { useTreasuryData } from "@/components/modules/treasury-api"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { StatusBadge } from "@/components/atoms/status-badge"
import { MinerFinancialCards } from "@/components/modules/miner-financial-cards"

function parsePriceToNumber(priceStr: string): number {
  const m = priceStr.match(/\$?([\d.]+)/)
  if (!m) return 0
  const n = parseFloat(m[1])
  return Number.isFinite(n) ? n : 0
}

/** Donut chart: 95% Miner / 5% Protocol revenue split (v3.5) */
function RevenueSplitDonut() {
  const size = 120
  const stroke = 14
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const segments = [
    { pct: 95, color: "#00FF41" },
    { pct: 5, color: "#ffc800" },
  ]
  let offset = 0
  const paths = segments.map(({ pct, color }) => {
    const dashArray = (pct / 100) * 2 * Math.PI * r
    const dashOffset = -offset * 2 * Math.PI * r
    offset += pct / 100
    return { dashArray, dashOffset, color }
  })

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#0a0a0a"
          strokeWidth={stroke + 2}
        />
        {paths.map((p, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={p.color}
            strokeWidth={stroke}
            strokeDasharray={`${p.dashArray} ${2 * Math.PI * r}`}
            strokeDashoffset={p.dashOffset}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
        style={{ fontFamily: "var(--font-mono), monospace" }}
      >
        <span
          className="text-[10px] font-bold leading-tight uppercase tracking-wider"
          style={{ color: "#00FF41", textShadow: "0 0 8px rgba(0,255,65,0.5)" }}
        >
          95% / 5%
        </span>
        <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(0,255,65,0.6)" }}>
          Revenue Split
        </span>
      </div>
    </div>
  )
}

function FeeBreakdownBlock({ baseHourly }: { baseHourly: number }) {
  const minerRevenue = +(baseHourly * 0.95).toFixed(4)
  const protocolTreasury = +(baseHourly * 0.05).toFixed(4)

  return (
    <div
      className="flex flex-col gap-2 border border-border p-4 shrink-0"
      style={{ backgroundColor: "rgba(0,255,65,0.02)" }}
    >
      <span className="mb-1 text-xs uppercase tracking-wider" style={{ color: "rgba(0,255,65,0.5)" }}>
        5% Fee Breakdown
      </span>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2" style={{ backgroundColor: "#00FF41" }} />
          <span className="text-xs" style={{ color: "rgba(0,255,65,0.6)" }}>
            Miner Revenue (95%)
          </span>
        </div>
        <span className="text-sm font-bold" style={{ color: "#00FF41" }}>
          ${minerRevenue}/hr
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2" style={{ backgroundColor: "#ffc800" }} />
            <span className="text-xs" style={{ color: "rgba(255,200,0,0.95)" }}>
              Protocol Treasury (5%)
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle
                  className="h-3 w-3 cursor-help opacity-60 hover:opacity-100"
                  style={{ color: "#00FF41" }}
                />
              </TooltipTrigger>
              <TooltipContent
                className="max-w-[260px] border"
                style={{ backgroundColor: "var(--terminal-bg)", borderColor: "rgba(0,255,65,0.3)" }}
              >
                <p className="text-xs" style={{ color: "#00FF41" }}>
                  100% routed to Multi-sig for $NRG Buybacks.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm font-bold" style={{ color: "#ffc800" }}>
            ${protocolTreasury}/hr
          </span>
        </div>
        <p className="text-[10px] pl-4" style={{ color: "rgba(255,200,0,0.6)" }}>
          (100% routed to Multi-sig for $NRG Buybacks)
        </p>
      </div>

      <div className="mt-2 flex h-2 overflow-hidden">
        <div style={{ width: "95%", backgroundColor: "#00FF41" }} />
        <div style={{ width: "5%", backgroundColor: "#ffc800" }} />
      </div>
    </div>
  )
}

export function PricingSlider() {
  const { isConnected, address } = useWallet()
  const {
    nodeToMiner,
    nodeRentals,
    nodePrices,
    nodeBandwidth,
    nodePendingPrices,
    getMinerNodes,
    getNodeLifecycle,
    getLockMetadata,
    getNodeSessionExpiresAt,
    getFinancials,
    getDisplayEarnedNrg,
    updateNodePrice,
    canUnregister,
    forceEmergencyRelease,
    unregisterMiner,
  } = useMinerRegistry()
  const { data: treasury } = useTreasuryData()
  const [pendingInputs, setPendingInputs] = useState<Record<string, string>>({})
  const [emergencyReleaseNodeId, setEmergencyReleaseNodeId] = useState<string | null>(null)
  const [liveYieldDisplay, setLiveYieldDisplay] = useState(0)

  const myNodeIds = isConnected && address ? Array.from(new Set(getMinerNodes(address))) : []
  const isAdmin = isGenesisNode(address ?? undefined)

  const platformHourly = useMemo(() => {
    let total = 0
    Object.keys(nodeToMiner).forEach((id) => {
      if (nodeRentals[id]) total += parsePriceToNumber(nodePrices[id] ?? "$0")
    })
    return total
  }, [nodeToMiner, nodeRentals, nodePrices])

  const accountHourly = useMemo(() => {
    if (!address) return 0
    let total = 0
    Object.keys(nodeToMiner).forEach((id) => {
      if (nodeToMiner[id] === address && nodeRentals[id])
        total += parsePriceToNumber(nodePrices[id] ?? "$0")
    })
    return total
  }, [address, nodeToMiner, nodeRentals, nodePrices])

  const accountTotalRevenue = useMemo(() => {
    if (!address) return "0"
    if (accountHourly <= 0) return "0"
    const estimatedTotal = Math.round(accountHourly * 24 * 30 * 0.7)
    return estimatedTotal.toLocaleString()
  }, [address, accountHourly])

  const treasuryAggregate = useMemo(() => {
    let earned_nrg = 0
    let security_buffer_usd = 0
    let accrued_interest = 0
    myNodeIds.forEach((id) => {
      const f = getFinancials(id)
      earned_nrg += getDisplayEarnedNrg(id)
      security_buffer_usd += f.security_buffer_usd
      accrued_interest += f.accrued_interest
    })
    return { earned_nrg, security_buffer_usd, accrued_interest }
  }, [myNodeIds, getFinancials, getDisplayEarnedNrg])

  const handlePriceUpdate = (nodeId: string, value: string) => {
    const lifecycle = getNodeLifecycle(nodeId)
    const applied = updateNodePrice(nodeId, value.trim() ? `$${value.trim()}/hr` : "$0.59/hr")
    if (applied) {
      toast.success(
        lifecycle === "LOCKED"
          ? "Pending price set for next tenant."
          : "Current price updated."
      )
      setPendingInputs((p) => ({ ...p, [nodeId]: "" }))
    }
  }

  const handleUnregister = (nodeId: string) => {
    if (!canUnregister(nodeId)) return
    const removed = unregisterMiner(nodeId)
    if (removed) toast.success("Node unregistered.")
    else toast.error("Cannot unregister while occupied.")
  }

  useEffect(() => {
    const t = setInterval(() => {
      setLiveYieldDisplay((prev) => prev + 0.001)
    }, 2000)
    return () => clearInterval(t)
  }, [])

  const handleConfirmEmergencyRelease = () => {
    if (!emergencyReleaseNodeId) return
    const f = getFinancials(emergencyReleaseNodeId)
    forceEmergencyRelease(emergencyReleaseNodeId)
    toast.error(`Emergency release. 50% buffer slashed ($${(f.security_buffer_usd * 0.5).toFixed(2)}).`)
    setEmergencyReleaseNodeId(null)
  }

  return (
    <>
    <div
      className="flex flex-col border border-border overflow-hidden"
      style={{ backgroundColor: "var(--terminal-bg)", minHeight: "380px" }}
    >
      <div
        className="flex items-center justify-between border-b border-border px-4 py-2 shrink-0"
        style={{ backgroundColor: "rgba(0,255,65,0.03)" }}
      >
        <span className="text-xs uppercase tracking-wider" style={{ color: "#00cc33" }}>
          Pricing Configuration
        </span>
        <span className="text-xs" style={{ color: "rgba(0,255,65,0.4)" }}>
          {isConnected ? "Your Revenue" : "Platform Overview"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-0 min-h-0 p-4">
        {!isConnected ? (
          <>
            <div className="grid grid-cols-2 gap-3 min-h-0 flex-1">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(0,255,255,0.5)" }}>
                    Platform hourly revenue
                  </span>
                  <span className="text-xl font-bold tabular-nums" style={{ color: "#00FFFF" }}>
                    ${platformHourly.toFixed(2)}/hr
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(0,255,255,0.5)" }}>
                    Platform accumulated assets
                  </span>
                  <span className="text-xl font-bold tabular-nums" style={{ color: "#00FF41" }}>
                    ${treasury ? Math.round(treasury.totalReserveUsd).toLocaleString() : "—"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center gap-0">
                <RevenueSplitDonut />
              </div>
            </div>
            <div className="mt-auto pt-2">
              <FeeBreakdownBlock baseHourly={platformHourly} />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-4 min-h-0">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider" style={{ color: "rgba(0,255,255,0.5)" }}>
                    Your hourly revenue (rented out)
                  </span>
                  <motion.div
                    key={accountHourly.toFixed(2)}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-baseline gap-2"
                  >
                    <span className="text-2xl font-bold tabular-nums" style={{ color: "#00FFFF" }}>
                      ${accountHourly.toFixed(2)}/hr
                    </span>
                    {accountHourly > 0 && (
                      <Zap className="h-5 w-5 shrink-0" style={{ color: "#00FF41" }} />
                    )}
                  </motion.div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider" style={{ color: "rgba(0,255,255,0.5)" }}>
                    Account total revenue
                  </span>
                  <motion.div
                    className="flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <span className="text-2xl font-bold tabular-nums" style={{ color: "#00FF41" }}>
                      ${accountTotalRevenue}
                    </span>
                    {Number(accountTotalRevenue.replace(/,/g, "")) > 0 && (
                      <TrendingUp className="h-5 w-5 shrink-0" style={{ color: "rgba(0,255,65,0.7)" }} />
                    )}
                  </motion.div>
                </div>
                {/* Cool visual: glow bar or pulse */}
                <div className="relative mt-2 overflow-hidden rounded border" style={{ borderColor: "rgba(0,255,65,0.2)", height: "48px" }}>
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(0,255,65,0.15) 50%, transparent 100%)",
                    }}
                  />
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-l"
                    style={{
                      width: `${Math.min(100, (accountHourly / 5) * 100)}%`,
                      backgroundColor: "rgba(0,255,65,0.25)",
                      boxShadow: "0 0 20px rgba(0,255,65,0.3)",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (accountHourly / 5) * 100)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium tracking-wider" style={{ color: "rgba(0,255,65,0.9)" }}>
                      Revenue index
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Command Center — Cards A, B, C (V2.0 Dual-Yield) */}
            <div className="mb-6">
              <MinerFinancialCards />
            </div>

            {/* My Registered Miners — each node in a bordered card; list scrolls when many */}
            <div
              className="flex w-full flex-col overflow-hidden border shrink-0 mt-2"
              style={{
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "rgba(0,255,65,0.2)",
                backgroundColor: "rgba(0,255,65,0.04)",
                minHeight: "120px",
                maxHeight: "320px",
              }}
            >
              <div
                className="flex items-center justify-between border-b px-2 shrink-0"
                style={{ borderColor: "rgba(0,255,65,0.15)", height: "32px" }}
              >
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "#00FFFF" }}>
                  My Registered Miners
                </span>
                {myNodeIds.length > 0 && (
                  <Link
                    href="/nodes"
                    className="text-[10px] underline hover:no-underline"
                    style={{ color: "rgba(0,255,255,0.7)" }}
                  >
                    Node Command Center
                  </Link>
                )}
              </div>
              <div
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 flex flex-col gap-2"
                style={{ maxHeight: "280px", borderColor: "rgba(0,255,65,0.08)" }}
              >
                {myNodeIds.length === 0 ? (
                  <p className="text-[10px] py-1" style={{ color: "rgba(0,255,255,0.5)" }}>
                    No miners yet. Register in Node Onboarding above.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {myNodeIds.map((nodeId) => {
                      const renter = nodeRentals[nodeId] ?? null
                      const lifecycle = getNodeLifecycle(nodeId)
                      const isLocked = lifecycle === "LOCKED"
                      const lockMeta = getLockMetadata(nodeId)
                      const sessionEndsAt = getNodeSessionExpiresAt(nodeId)
                      const name = NODE_DISPLAY_NAMES[nodeId] ?? nodeId
                      const price = nodePrices[nodeId] ?? "—"
                      const pendingPrice = nodePendingPrices[nodeId]
                      const bandwidth = nodeBandwidth[nodeId] ?? "—"
                      const lockedDisplay = lockMeta ? `$${lockMeta.locked_price.toFixed(2)}/hr` : "—"
                      const canUnreg = canUnregister(nodeId)
                      const pendingVal = pendingInputs[nodeId] ?? (pendingPrice ? pendingPrice.replace(/^\$?([\d.]+).*/, "$1") : "")
                      const isViolated = lifecycle === "VIOLATED"
                      const nextDisplay = pendingPrice ? (pendingPrice.match(/\$?([\d.]+)/)?.[1] ?? "—") : "—"
                      const tenantShort = renter ? `${renter.slice(0, 6)}…${renter.slice(-4)}` : ""
                      const formatShort = (iso: string) => {
                        try {
                          const d = new Date(iso)
                          return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                        } catch { return iso }
                      }
                      const rentedSince = lockMeta?.locked_at ? formatShort(lockMeta.locked_at) : null
                      const sessionEnds = sessionEndsAt ? formatShort(sessionEndsAt) : null
                      return (
                        <div
                          key={nodeId}
                          className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 p-2 rounded border shrink-0"
                          style={{ borderColor: "rgba(0,255,65,0.25)", backgroundColor: "rgba(0,0,0,0.2)" }}
                        >
                          <span className="flex flex-col gap-0.5 min-w-0">
                            <span className="flex items-center gap-1.5 min-w-0">
                              {isLocked && <LockKeyhole className="h-3 w-3 shrink-0" style={{ color: "#ffa500" }} />}
                              <span className="text-xs font-bold truncate" style={{ color: "#00FFFF" }}>{name}</span>
                              {nodeId === FOUNDATION_GENESIS_NODE_ID && (
                                <span className="px-1 py-0.5 text-[9px] font-bold shrink-0" style={{ backgroundColor: "rgba(0,255,65,0.15)", color: "#00FF41", border: "1px solid rgba(0,255,65,0.4)" }}>[FOUNDATION GENESIS]</span>
                              )}
                              <span className="inline-flex items-center gap-1 shrink-0">
                                {isViolated && <StatusBadge status="VIOLATED" />}
                                {isLocked && <span className="text-[10px]" style={{ color: "rgba(255,165,0,0.95)" }}>LOCKED · {tenantShort}</span>}
                                {!isLocked && !isViolated && (
                                  <span className="inline-flex rounded border px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: renter ? "rgba(0,255,65,0.1)" : "rgba(255,200,0,0.1)", color: renter ? "#00FF41" : "#ffc800", borderColor: renter ? "rgba(0,255,65,0.35)" : "rgba(255,200,0,0.35)" }}>
                                    {renter ? `Rented ${tenantShort}` : "Pending tunnel"}
                                  </span>
                                )}
                              </span>
                            </span>
                            {(rentedSince || sessionEnds) && (
                              <span className="text-[10px] pl-4" style={{ color: "rgba(0,255,255,0.5)" }}>
                                {rentedSince && <>Rented since {rentedSince}</>}
                                {rentedSince && sessionEnds && " · "}
                                {sessionEnds && <>Session ends ~{sessionEnds}</>}
                              </span>
                            )}
                          </span>
                          <span className="flex flex-wrap items-center gap-x-2 text-[10px]" style={{ color: "rgba(0,255,255,0.6)" }}>
                            {isLocked ? (
                              <span className="font-mono">Current: {lockedDisplay} (Locked) | Next: ${nextDisplay} <span className="text-[9px] font-bold uppercase" style={{ color: "rgba(255,200,0,0.9)" }}>[PENDING NEXT]</span></span>
                            ) : (
                              <>
                                <span>{price}</span>
                                <span>{bandwidth}</span>
                              </>
                            )}
                            <span style={{ color: "#00FF41" }}>{renter ? "$—" : "$0"}</span>
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold uppercase shrink-0" style={{ borderColor: "rgba(0,255,65,0.4)", color: "#00FF41", backgroundColor: "rgba(0,255,65,0.08)" }}>
                                ACTIONS <ChevronDown className="h-3 w-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="min-w-[200px] border" style={{ backgroundColor: "var(--terminal-bg)", borderColor: "rgba(0,255,65,0.3)" }} align="end">
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-xs" style={{ color: "#00FF41" }}>
                                  <DollarSign className="h-3.5 w-3.5 mr-2" />
                                  Update Price
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="border" style={{ backgroundColor: "var(--terminal-bg)", borderColor: "rgba(0,255,65,0.3)" }}>
                                  <div className="p-2 space-y-2">
                                    {isLocked && (
                                      <p className="text-[10px] font-medium" style={{ color: "#00FF41" }}>
                                        Next tenant price — applies after current session ends.
                                      </p>
                                    )}
                                    <div className="flex gap-1">
                                      <input type="text" placeholder={isLocked ? "Next $/hr" : "$/hr"} className="flex-1 rounded border bg-black/40 px-2 py-1 text-xs font-mono" style={{ borderColor: "rgba(0,255,65,0.3)", color: "#00FF41" }} value={pendingVal} onChange={(e) => setPendingInputs((p) => ({ ...p, [nodeId]: e.target.value }))} />
                                      <button type="button" className="rounded border px-2 py-1 text-[10px] font-bold uppercase" style={{ borderColor: "rgba(0,255,65,0.4)", color: "#00FF41" }} onClick={() => handlePriceUpdate(nodeId, pendingVal || "0.59")}>Set</button>
                                    </div>
                                  </div>
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuItem disabled={!canUnreg} className="text-xs" style={{ color: canUnreg ? "#ff8866" : "rgba(255,255,255,0.4)" }} onSelect={() => canUnreg && handleUnregister(nodeId)}>
                                <LogOut className="h-3.5 w-3.5 mr-2" />
                                Unregister Asset
                              </DropdownMenuItem>
                              {isLocked && isAdmin && (
                                <DropdownMenuItem className="text-xs" style={{ color: "#ff4444" }} onSelect={(e) => { e.preventDefault(); setEmergencyReleaseNodeId(nodeId) }}>
                                  <AlertTriangle className="h-3.5 w-3.5 mr-2" />
                                  Force Emergency Release
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-2">
              <FeeBreakdownBlock baseHourly={platformHourly} />
            </div>
          </>
        )}
      </div>
    </div>

    <Dialog open={!!emergencyReleaseNodeId} onOpenChange={(open) => !open && setEmergencyReleaseNodeId(null)}>
      <DialogContent className="border-2 max-w-md" style={{ backgroundColor: "#0a0a0a", borderColor: "#ff4444" }}>
        <DialogHeader>
          <DialogTitle className="text-red-500 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            DANGER: Force Emergency Release
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>
          Forcing release while occupied will slash <strong className="text-red-400">50%</strong> of your security buffer ($NRG) and disconnect the tunnel. The tenant will be disconnected. Confirm?
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <button type="button" className="rounded border px-4 py-2 text-sm font-bold" style={{ borderColor: "rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.8)" }} onClick={() => setEmergencyReleaseNodeId(null)}>
            Cancel
          </button>
          <button type="button" className="rounded border px-4 py-2 text-sm font-bold bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30" onClick={handleConfirmEmergencyRelease}>
            Confirm — Slash 50%
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
