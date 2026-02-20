"use client"

import { useMemo } from "react"
import { Lock, Unlock, ShieldCheck } from "lucide-react"
import { useWallet, useMinerRegistry, NODE_DISPLAY_NAMES } from "@/lib/contexts"
import { bufferCapUsd, poolApyFree, poolApyBuffer } from "@/lib/lifecycle/dual-yield"
import { TooltipProvider } from "@/components/ui/tooltip"

function parsePrice(priceStr: string): number {
  const m = priceStr.match(/\$?([\d.]+)/)
  return m ? parseFloat(m[1]) || 0.59 : 0.59
}

const APY_FREE_LOW = "0.3%"
const APY_FREE_HIGH = "1.5%"
const APY_BUFFER_LOW = "0.3%"
const APY_BUFFER_HIGH = "3.0%"
const TRUST_HOURS_TARGET = 100

export function MinerFinancialCards() {
  const { isConnected, address } = useWallet()
  const {
    getMinerNodes,
    getFinancials,
    getNodeLifecycle,
    setOptInBufferRouting,
    nodePrices,
  } = useMinerRegistry()

  const myNodeIds = isConnected && address ? getMinerNodes(address) : []
  const aggregate = useMemo(() => {
    let available_balance = 0
    let security_buffer = 0
    let earned_nrg = 0
    let accrued_interest = 0
    let buffer_cap_sum = 0
    let apyFree = 0.003
    let apyBuffer = 0.003
    myNodeIds.forEach((id) => {
      const f = getFinancials(id)
      available_balance += f.free_balance_usd ?? 0
      security_buffer += f.security_buffer_usd ?? 0
      earned_nrg += f.earned_nrg ?? 0
      accrued_interest += f.accrued_interest ?? 0
      const priceStr = nodePrices[id] ?? "$0.59/hr"
      const hourly = parsePrice(priceStr)
      buffer_cap_sum += bufferCapUsd(hourly)
      const lockedSince = f.buffer_locked_since
      if (lockedSince) {
        const days = (Date.now() - new Date(lockedSince).getTime()) / (24 * 60 * 60 * 1000)
        apyFree = poolApyFree(days)
        apyBuffer = poolApyBuffer(days)
      }
    })
    return {
      available_balance,
      security_buffer,
      earned_nrg,
      accrued_interest,
      buffer_cap_sum,
      apyFree,
      apyBuffer,
    }
  }, [myNodeIds, getFinancials, nodePrices])

  const anyNodeActive = myNodeIds.some((id) => getNodeLifecycle(id) === "LOCKED")
  const trustProgress = aggregate.buffer_cap_sum > 0
    ? Math.min(100, Math.round((aggregate.security_buffer / aggregate.buffer_cap_sum) * TRUST_HOURS_TARGET))
    : 0
  const isTrusted = trustProgress >= TRUST_HOURS_TARGET
  const apyFreeDisplay = aggregate.apyFree <= 0.003 ? APY_FREE_LOW : aggregate.apyFree >= 0.015 ? APY_FREE_HIGH : "0.8%"
  const apyBufferDisplay = aggregate.apyBuffer <= 0.003 ? APY_BUFFER_LOW : aggregate.apyBuffer >= 0.03 ? APY_BUFFER_HIGH : "1.0%"

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider" style={{ color: "#00cc33" }}>
        Financial Command Center
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Card A: Liquid Profits */}
        <div
          className="rounded border p-4"
          style={{
            borderColor: "rgba(0,255,65,0.3)",
            backgroundColor: "rgba(0,255,65,0.06)",
          }}
        >
          <div className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(0,255,65,0.55)" }}>
            Liquid Profits
          </div>
          <div className="mt-2 text-4xl font-bold leading-tight tabular-nums" style={{ color: "#00FF41" }}>
            ${aggregate.available_balance.toFixed(2)}
          </div>
          <p className="mt-2 text-[10px]" style={{ color: "rgba(0,255,65,0.6)" }}>
            Yield [{apyFreeDisplay}] APY · auto-compounding
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-90"
            style={{ borderColor: "#00FF41", color: "#00FF41", backgroundColor: "rgba(0,255,65,0.12)" }}
          >
            Withdraw
          </button>
        </div>

        {/* Card B: Security Buffer */}
        <div
          className="rounded border p-4"
          style={{
            borderColor: "rgba(255,200,0,0.35)",
            backgroundColor: "rgba(255,200,0,0.04)",
          }}
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,200,0,0.8)" }}>
            <Lock className="h-3 w-3" />
            Security Buffer (Escrow)
          </div>
          <div className="mt-2 text-4xl font-bold leading-tight tabular-nums" style={{ color: "#ffc800" }}>
            ${aggregate.security_buffer.toFixed(2)}
          </div>
          <p className="mt-2 text-[10px]" style={{ color: "rgba(255,200,0,0.7)" }}>
            Yield [{apyBufferDisplay}] APY · slashing protection
          </p>
          <div className="mt-2 space-y-1">
            {myNodeIds.slice(0, 2).map((nodeId) => {
              const f = getFinancials(nodeId)
              return (
                <label key={nodeId} className="flex cursor-pointer items-center gap-2 text-[9px]">
                  <input
                    type="checkbox"
                    checked={f.opt_in_buffer_routing ?? false}
                    onChange={(e) => setOptInBufferRouting(nodeId, e.target.checked)}
                    className="h-3 w-3 rounded border"
                    style={{ accentColor: "#ffc800" }}
                  />
                  <span style={{ color: "rgba(255,200,0,0.8)" }}>
                    Auto-route 10% ({NODE_DISPLAY_NAMES[nodeId] ?? nodeId})
                  </span>
                </label>
              )
            })}
            {myNodeIds.length > 2 && (
              <p className="text-[9px]" style={{ color: "rgba(255,200,0,0.55)" }}>
                +{myNodeIds.length - 2} more workers (managed automatically)
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={anyNodeActive}
            className="mt-3 w-full rounded border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            style={{
              borderColor: "rgba(255,200,0,0.4)",
              color: "rgba(255,200,0,0.8)",
              backgroundColor: "rgba(255,200,0,0.08)",
            }}
            title={anyNodeActive ? "Unlock only when all nodes are IDLE (7-day cooldown)" : "Unlock (7-day cooldown)"}
          >
            <Unlock className="mr-1.5 inline h-3.5 w-3.5" />
            Unlock (7-Day Cooldown)
          </button>
        </div>

        {/* Card C: Identity & Trust Score */}
        <div
          className="rounded border p-4"
          style={{
            borderColor: "rgba(0,255,255,0.3)",
            backgroundColor: "rgba(0,255,255,0.04)",
          }}
        >
          <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider" style={{ color: "rgba(0,255,255,0.8)" }}>
            <ShieldCheck className="h-3 w-3" />
            Identity & Trust Score
          </div>
          <div className="mt-2 text-[10px]" style={{ color: "rgba(0,255,255,0.7)" }}>
            Genesis Rank: Top 100 Elite
          </div>
          {!isTrusted ? (
            <>
              <div className="mt-2 text-[9px] uppercase" style={{ color: "rgba(0,255,255,0.5)" }}>
                Building Trust: {trustProgress}/{TRUST_HOURS_TARGET} Hours
              </div>
              <div
                className="mt-1 h-2 w-full overflow-hidden rounded"
                style={{ backgroundColor: "rgba(0,255,255,0.15)" }}
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${trustProgress}%`,
                    backgroundColor: "#00FFFF",
                    boxShadow: "0 0 8px rgba(0,255,255,0.5)",
                  }}
                />
              </div>
            </>
          ) : (
            <div
              className="mt-3 animate-pulse rounded border px-3 py-2 text-center text-xs font-bold uppercase tracking-wider"
              style={{
                borderColor: "rgba(0,255,255,0.6)",
                color: "#00FFFF",
                boxShadow: "0 0 12px rgba(0,255,255,0.4)",
              }}
            >
              [ Trusted Node ]
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
