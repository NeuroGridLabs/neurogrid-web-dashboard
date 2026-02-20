"use client"

import { Trophy } from "lucide-react"

/** Placeholder rank; replace with API when leaderboard backend exists. */
const PLACEHOLDER_RANK = 42
const ELITE_SLOTS = 30
const UPTIME_PERCENT = 98.2

/** Gradient from green (high) to yellow (mid) based on 0–100 score. */
function uptimeGradient(percent: number) {
  if (percent >= 99) return "linear-gradient(90deg, #00FF41, #7fff00)"
  if (percent >= 95) return "linear-gradient(90deg, #7fff00, #ffc800)"
  return "linear-gradient(90deg, #ffc800, #ff8800)"
}

interface GenesisLeaderboardRankCardProps {
  /** Show card only when miner has at least one registered node. */
  show: boolean
}

export function GenesisLeaderboardRankCard({ show }: GenesisLeaderboardRankCardProps) {
  if (!show) return null

  const latencyRank = "#12"
  const contributionPoints = "2,840"

  return (
    <div
      className="rounded border p-4"
      style={{
        borderColor: "rgba(255,200,0,0.35)",
        backgroundColor: "rgba(255,200,0,0.04)",
      }}
    >
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,200,0,0.9)" }}>
        <Trophy className="h-4 w-4" />
        Genesis Leaderboard Rank
      </div>
      <p className="mb-3 text-sm font-bold" style={{ color: "#ffc800" }}>
        Your Current Rank: <span className="font-mono">#{PLACEHOLDER_RANK}</span>. Top {ELITE_SLOTS} get Lifetime 2% Fee status.
      </p>
      <div className="mb-3 flex flex-col items-center justify-center rounded border py-3" style={{ borderColor: "rgba(255,200,0,0.25)", backgroundColor: "rgba(0,0,0,0.2)" }}>
        <div className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,200,0,0.7)" }}>Uptime Score</div>
        <div
          className="text-3xl font-bold tabular-nums bg-clip-text text-transparent"
          style={{ backgroundImage: uptimeGradient(UPTIME_PERCENT), WebkitBackgroundClip: "text" }}
        >
          {UPTIME_PERCENT}%
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <div className="text-[9px] uppercase" style={{ color: "rgba(255,200,0,0.6)" }}>Latency Rank</div>
          <div className="text-sm font-bold tabular-nums" style={{ color: "#ffc800" }}>{latencyRank}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase" style={{ color: "rgba(255,200,0,0.6)" }}>Contribution Pts</div>
          <div className="text-sm font-bold tabular-nums" style={{ color: "#ffc800" }}>{contributionPoints}</div>
        </div>
      </div>
    </div>
  )
}
