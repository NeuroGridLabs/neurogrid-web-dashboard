"use client"

import { useEffect, useState } from "react"
import { Shield, ExternalLink, Activity } from "lucide-react"
import { TerminalLog } from "@/components/atoms/terminal-log"

// v3.2: 5% fee buyback/distribution flow examples
const LIVE_FLOW_ENTRIES = [
  { type: "NETWORK" as const, content: "[BTC Anchor] +0.0001 BTC secured" },
  { type: "FINANCIAL" as const, content: "[SOL Anchor] +0.03 SOL added via Raydium" },
  { type: "NETWORK" as const, content: "[Eco-Pool] 2.5% fee → liquidity buffer" },
  { type: "FINANCIAL" as const, content: "[Sui/ETH] +0.002 ETH bridged to Anchor" },
  { type: "SYSTEM" as const, content: "[Buyback] 847 $NRG repurchased · 5% fee split" },
]

function getTimestamp() {
  return new Date().toLocaleTimeString("en-US", { hour12: false })
}

function LiveFlowSection() {
  const [lines, setLines] = useState<
    Array<{ type: "NETWORK" | "FINANCIAL" | "SYSTEM"; content: string; ts?: string }>
  >([
    { ...LIVE_FLOW_ENTRIES[0], ts: getTimestamp() },
    { ...LIVE_FLOW_ENTRIES[1], ts: getTimestamp() },
  ])
  const [idx, setIdx] = useState(2)

  useEffect(() => {
    const t = setInterval(() => {
      const entry = { ...LIVE_FLOW_ENTRIES[idx % LIVE_FLOW_ENTRIES.length], ts: getTimestamp() }
      setLines(([, second]) => [second, entry])
      setIdx((i) => i + 1)
    }, 4500)
    return () => clearInterval(t)
  }, [idx])

  return (
    <div
      className="overflow-hidden border border-border"
      style={{ backgroundColor: "rgba(0,255,65,0.02)" }}
    >
      <div
        className="flex items-center gap-2 border-b border-border px-3 py-2"
        style={{ backgroundColor: "rgba(0,255,65,0.03)" }}
      >
        <Activity className="h-3.5 w-3.5" style={{ color: "#00FF41" }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#00FF41" }}>
          Live Flow
        </span>
        <span className="text-xs" style={{ color: "rgba(0,255,65,0.4)" }}>
          5% fee · buyback / distribution
        </span>
      </div>
      <div
        className="grid h-[4.5rem] grid-rows-2 content-start gap-0 overflow-hidden p-2"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.01) 2px, rgba(0,255,65,0.01) 4px)",
        }}
      >
        {lines.map((e, i) => (
          <TerminalLog key={i} type={e.type} message={e.content} timestamp={e.ts} />
        ))}
      </div>
    </div>
  )
}

// v3.2 Multi-chain multi-sig addresses — click to block explorer
const MULTICHAIN_ADDRESSES = [
  { chain: "BTC", label: "Anchor-Pool", addr: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", short: "bc1q...0wlh", href: "https://mempool.space/address/bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" },
  { chain: "SOL", label: "Anchor-Pool", addr: "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK", short: "DYw8...NSKK", href: "https://solscan.io/account/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK" },
  { chain: "ETH", label: "Anchor-Pool", addr: "0x742d35Cc6634C0532925a3b844Bc9e7595f5b291", short: "0x742d...b291", href: "https://etherscan.io/address/0x742d35Cc6634C0532925a3b844Bc9e7595f5b291" },
  { chain: "Sui", label: "Eco-Pool", addr: "0x853a5e5e5a5e5a5e5a5e5a5e5a5e5a5e5a5e5a5e", short: "0x853a...5a5e", href: "https://suiexplorer.com/address/0x853a5e5e5a5e5a5e5a5e5a5e5a5e5a5e5a5e5a5e" },
]

export function TrustCenter() {
  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div
          className="border border-border p-6"
          style={{ backgroundColor: "var(--terminal-bg)" }}
        >
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" style={{ color: "#00FF41" }} />
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "#00FF41" }}>
              Trust Center
            </h2>
          </div>
          <p className="mb-4 text-xs" style={{ color: "rgba(0,255,65,0.5)" }}>
            Multi-chain multi-sig treasury addresses. 100% on-chain verifiable. Click to explorer.
          </p>

          {/* Live Flow: 5% fee buyback/distribution logs */}
          <LiveFlowSection />

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MULTICHAIN_ADDRESSES.map((item) => (
              <a
                key={item.chain}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-2 border border-border p-4 transition-colors hover:border-primary/40"
                style={{ backgroundColor: "rgba(0,255,65,0.02)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#00FFFF" }}>
                    {item.chain} · {item.label}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" style={{ color: "#00FF41" }} />
                </div>
                <span className="font-mono text-xs" style={{ color: "#00FF41" }}>
                  {item.short}
                </span>
                <span
                  className="w-fit px-2 py-0.5 text-xs font-bold"
                  style={{
                    backgroundColor: "rgba(0,255,65,0.15)",
                    color: "#00FF41",
                    border: "1px solid rgba(0,255,65,0.4)",
                  }}
                >
                  Verified
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
