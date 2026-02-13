"use client"

import { useEffect, useState } from "react"
import { TerminalLog } from "@/components/atoms/terminal-log"
import { Activity } from "lucide-react"

// v3.2: 5% fee flow examples — last tx destination
const FLOW_ENTRIES = [
  { type: "NETWORK" as const, content: "[SWAP] 0.03 SOL added to Anchor-Pool via Raydium" },
  { type: "FINANCIAL" as const, content: "[SWAP] 0.0024 ETH → Sui bridge to Anchor-Pool" },
  { type: "NETWORK" as const, content: "[BUYBACK] 1,240 $NRG repurchased · 2.5% to hard assets" },
  { type: "FINANCIAL" as const, content: "[BUYBACK] 847 $NRG repurchased · 2.5% to Eco-Pool" },
  { type: "SYSTEM" as const, content: "[TX] 5% fee split: 2.5% Anchor | 2.5% Eco" },
]

const EXPLORER_LINKS = [
  { label: "BTC", href: "https://mempool.space/address/bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", addr: "bc1q...0wlh" },
  { label: "SOL", href: "https://solscan.io/account/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK", addr: "DYw8...NSKK" },
  { label: "ETH", href: "https://etherscan.io/address/0x742d35Cc6634C0532925a3b844Bc9e7595f5b291", addr: "0x742d...b291" },
  { label: "Sui", href: "https://suiexplorer.com/address/0x853a5e5e5a5e5a5e5a5e5a5e5a5e5a5e5a5e5a5e", addr: "0x853a...5a5e" },
]

function getTimestamp() {
  return new Date().toLocaleTimeString("en-US", { hour12: false })
}

export function TransparencyLog() {
  const [entries, setEntries] = useState<Array<{ type: "NETWORK" | "FINANCIAL" | "SYSTEM"; content: string; ts?: string }>>([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      const entry = FLOW_ENTRIES[idx % FLOW_ENTRIES.length]
      setEntries((prev) => [...prev.slice(-7), { ...entry, ts: getTimestamp() }])
      setIdx((i) => i + 1)
    }, 4000)
    return () => clearInterval(t)
  }, [idx])

  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div
          className="overflow-hidden border border-border"
          style={{ backgroundColor: "var(--terminal-bg)" }}
        >
          <div
            className="flex items-center justify-between border-b border-border px-4 py-2"
            style={{ backgroundColor: "rgba(0,255,65,0.03)" }}
          >
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: "#00FF41" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#00FF41" }}>
                Live Treasury Flow
              </span>
            </div>
            <span className="text-xs" style={{ color: "rgba(0,255,65,0.4)" }}>
              5% fee destination · Real-time
            </span>
          </div>

          <div
            className="flex flex-col gap-1 overflow-y-auto p-3"
            style={{
              maxHeight: 140,
              background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.01) 2px, rgba(0,255,65,0.01) 4px)",
            }}
          >
            {entries.map((e, i) => (
              <TerminalLog key={i} type={e.type} message={e.content} timestamp={e.ts} />
            ))}
            {entries.length === 0 && (
              <div className="px-2 py-1 text-xs" style={{ color: "rgba(0,255,65,0.3)" }}>
                Waiting for treasury flow...
              </div>
            )}
          </div>

          <div
            className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3"
            style={{ backgroundColor: "rgba(0,255,65,0.02)" }}
          >
            <span className="text-xs" style={{ color: "rgba(0,255,65,0.5)" }}>Multi-sig:</span>
            {EXPLORER_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono transition-colors hover:opacity-80"
                style={{ color: "#00FF41" }}
              >
                {link.label} {link.addr}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
