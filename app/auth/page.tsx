"use client"

import { useState } from "react"
import Link from "next/link"
import { Wallet, Mail, Github } from "lucide-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { ScanlineOverlay } from "@/components/atoms/scanline-overlay"
import { useRole } from "@/lib/contexts"

const GENESIS_LEADERBOARD_PLACEHOLDER = [
  { rank: 1, address: "8KRq…tBva", pts: "12,400" },
  { rank: 2, address: "7xYz…9Kp2", pts: "11,200" },
  { rank: 3, address: "9mNp…4Lq1", pts: "10,800" },
  { rank: 4, address: "5bCd…2Wr7", pts: "9,100" },
  { rank: 5, address: "3fGh…8Tn4", pts: "8,500" },
]

export default function AuthPage() {
  const { setRole } = useRole()
  const [hoverSecondary, setHoverSecondary] = useState(false)

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#050505" }}>
      <ScanlineOverlay />
      {/* Sidebar: Genesis 100 Leaderboard hero */}
      <aside
        className="hidden w-[320px] shrink-0 flex-col border-r border-border md:flex"
        style={{
          backgroundColor: "rgba(0,255,65,0.02)",
          borderColor: "rgba(0,255,65,0.15)",
        }}
      >
        <div className="border-b border-border p-4" style={{ borderColor: "rgba(0,255,65,0.15)" }}>
          <Link href="/" className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-wider" style={{ color: "#00FF41" }}>
              NEUROGRID PROTOCOL
            </span>
          </Link>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,200,0,0.95)" }}>
            Genesis 100 Leaderboard
          </h2>
          <p className="mb-4 text-[10px]" style={{ color: "rgba(0,255,65,0.6)" }}>
            Top miners by contribution. Rank #1–30 get Lifetime 2% Fee status.
          </p>
          <ul className="space-y-2">
            {GENESIS_LEADERBOARD_PLACEHOLDER.map((row) => (
              <li
                key={row.rank}
                className="flex items-center justify-between rounded border px-2 py-1.5 text-[10px]"
                style={{
                  borderColor: row.rank <= 3 ? "rgba(255,200,0,0.35)" : "rgba(0,255,65,0.2)",
                  backgroundColor: row.rank <= 3 ? "rgba(255,200,0,0.06)" : "rgba(0,255,65,0.03)",
                }}
              >
                <span className="font-bold tabular-nums" style={{ color: row.rank <= 3 ? "#ffc800" : "#00FF41" }}>
                  #{row.rank}
                </span>
                <span className="font-mono" style={{ color: "rgba(0,255,65,0.8)" }}>
                  {row.address}
                </span>
                <span className="tabular-nums" style={{ color: "rgba(0,255,255,0.7)" }}>
                  {row.pts} pts
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[9px]" style={{ color: "rgba(0,255,65,0.4)" }}>
            Connect a worker wallet to climb the board. Marketplace renters have no ranking.
          </p>
        </div>
      </aside>

      {/* Main: Split login */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <h1 className="mb-2 text-center text-lg font-bold tracking-wider" style={{ color: "#00FF41" }}>
            Welcome to NeuroGrid
          </h1>
          <p className="mb-8 text-center text-xs" style={{ color: "rgba(0,255,65,0.6)" }}>
            Connect to access the Worker console or rent from the Marketplace.
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Primary: Web3 Wallet (Miners) */}
            <div
              className="flex flex-col rounded border-2 p-6 transition-colors"
              style={{
                borderColor: "#00FF41",
                backgroundColor: "rgba(0,255,65,0.06)",
              }}
            >
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#00FF41" }}>
                <Wallet className="h-4 w-4" />
                For Miners
              </div>
              <p className="mb-4 text-xs" style={{ color: "rgba(0,255,65,0.75)" }}>
                Connect your Web3 wallet to register GPU nodes, set pricing, and earn from the Dual-Yield engine.
              </p>
              <div className="mt-auto">
                <WalletMultiButton
                  className="!flex !w-full !justify-center !rounded-none !border-2 !border-[#00FF41] !bg-transparent !px-4 !py-3 !text-sm !font-bold !uppercase !tracking-wider !text-[#00FF41] hover:!bg-[rgba(0,255,65,0.12)]"
                  onClick={() => setRole("miner")}
                />
              </div>
            </div>

            {/* Secondary: Email / GitHub / Discord (Tenants, placeholders) */}
            <div
              className="flex flex-col rounded border-2 p-6 transition-colors"
              style={{
                borderColor: hoverSecondary ? "rgba(0,255,255,0.5)" : "rgba(0,255,65,0.25)",
                backgroundColor: "rgba(0,255,255,0.03)",
              }}
              onMouseEnter={() => setHoverSecondary(true)}
              onMouseLeave={() => setHoverSecondary(false)}
            >
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#00FFFF" }}>
                <Mail className="h-4 w-4" />
                For Tenants
              </div>
              <p className="mb-4 text-xs" style={{ color: "rgba(0,255,255,0.7)" }}>
                Continue with Email, GitHub, or Discord. Account Abstraction — gasless onboarding (coming soon).
              </p>
              <div className="mt-auto space-y-2">
                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-center gap-2 rounded border border-border px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-60"
                  style={{ borderColor: "rgba(0,255,255,0.3)", color: "rgba(0,255,255,0.7)" }}
                >
                  <Mail className="h-4 w-4" />
                  Continue with Email
                </button>
                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-center gap-2 rounded border border-border px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-60"
                  style={{ borderColor: "rgba(0,255,255,0.3)", color: "rgba(0,255,255,0.7)" }}
                >
                  <Github className="h-4 w-4" />
                  Continue with GitHub
                </button>
                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-center gap-2 rounded border border-border px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-60"
                  style={{ borderColor: "rgba(0,255,255,0.3)", color: "rgba(0,255,255,0.7)" }}
                >
                  <span className="text-sm">Discord</span>
                  Continue with Discord
                </button>
                <p className="text-center text-[9px]" style={{ color: "rgba(0,255,255,0.4)" }}>
                  AA logic placeholders · Use Web3 Wallet to rent as tenant for now
                </p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center">
            <Link href="/" className="text-xs underline hover:no-underline" style={{ color: "rgba(0,255,65,0.5)" }}>
              ← Back to Home
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
