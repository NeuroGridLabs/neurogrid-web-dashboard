"use client"

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
} from "react"
import { ChevronDown, Minus, Square, X, Bug } from "lucide-react"
import { TerminalLog, type LogType } from "@/components/atoms/terminal-log"
import { useMinerRegistry } from "@/lib/contexts"
import { FOUNDATION_GENESIS_NODE_ID } from "@/lib/genesis-node"
import { toast } from "sonner"

interface TerminalLine {
  type: "input" | "output" | LogType
  content: string
  timestamp?: string
}

const INITIAL_LINES_COUNT = 6

function buildGenesisStatusLines(
  genesisIgnited: boolean,
  alpha01RentedBy: string | null
): TerminalLine[] {
  const status = !genesisIgnited
    ? "STANDBY - BOOTSTRAPPING"
    : alpha01RentedBy
      ? "OCCUPIED"
      : "ONLINE_IDLE"
  const hardware = !genesisIgnited
    ? "Hardware: Locked [RTX 4090 Pool] | Awaiting Whitelist Ignition"
    : "Hardware: Ready [RTX 4090 Pool] | Idle"
  const tunnelStatus = !genesisIgnited
    ? "Tunnel status: PENDING_IGNITION | Ping: Awaiting Gateway"
    : "Tunnel status: READY | Ping: Gateway OK"
  const poll = !genesisIgnited
    ? "Polling Genesis Smart Contract for ignition signal..."
    : alpha01RentedBy
      ? "Genesis Alpha-01 in use by tenant."
      : "Genesis Alpha-01 ready for rent."
  return [
    { type: "SYSTEM", content: "NeuroGrid Protocol v3.5 -- Admin Terminal" },
    { type: "SYSTEM", content: "Type 'help' for available commands." },
    { type: "NETWORK", content: `Genesis Node Alpha-01 [${status}]` },
    { type: "PHYSICAL", content: hardware },
    { type: "NETWORK", content: tunnelStatus },
    { type: "SYSTEM", content: poll },
  ]
}

const COMMAND_MAP: Record<string, TerminalLine[]> = {
  help: [
    { type: "SYSTEM", content: "Available commands:" },
    { type: "SYSTEM", content: "  status     -- Node health & GPU metrics" },
    { type: "SYSTEM", content: "  nodes      -- List connected mining nodes" },
    { type: "SYSTEM", content: "  pool       -- Show reserve pool statistics" },
    { type: "SYSTEM", content: "  tunnel     -- Tunnel diagnostics" },
    { type: "SYSTEM", content: "  poi        -- Proof-of-Inference verification" },
    { type: "SYSTEM", content: "  fees       -- Fee structure breakdown" },
    { type: "SYSTEM", content: "  clear      -- Clear terminal output" },
  ],
  status: [
    { type: "PHYSICAL", content: "NODE STATUS: Alpha-01 [ONLINE]" },
    { type: "PHYSICAL", content: "GPU 0: RTX4090 | 24GB | Temp: 64C | Load: 87%" },
    { type: "PHYSICAL", content: "VRAM Used: 18.4/24GB (76.7%)" },
    { type: "NETWORK", content: "Inference Queue: 14 jobs | Avg: 340ms" },
    { type: "NETWORK", content: "PoI Verifications: 2,847 (24h)" },
    { type: "NETWORK", content: "Revenue: 0.0847 ETH (24h)" },
  ],
  nodes: [
    { type: "NETWORK", content: "Connected Nodes (3):" },
    { type: "PHYSICAL", content: "  [1] Alpha-01  | RTX4090 | 24GB  | ACTIVE  | [Tunnel Ready]" },
    { type: "NETWORK", content: "  [2] Beta-07   | RTX4090 | 24GB  | ACTIVE  | [Tunnel Ready]" },
    { type: "NETWORK", content: "  [3] Gamma-12  | 4x A100  | 320GB | SYNCING | [Tunnel Ready]" },
  ],
  pool: [
    { type: "NETWORK", content: "Macro Reserve Pool:" },
    { type: "NETWORK", content: "  Balance: 12.847 ETH" },
    { type: "NETWORK", content: "  24h Inflow: +0.234 ETH (2% tx fee)" },
    { type: "NETWORK", content: "  Pending Buyback: 0.15 ETH" },
    { type: "NETWORK", content: "  Floor Price Support: ACTIVE" },
  ],
  tunnel: [
    { type: "NETWORK", content: "Tunnel Diagnostics:" },
    { type: "NETWORK", content: "  Gateway: [Encrypted Tunnel Ready]" },
    { type: "NETWORK", content: "  Protocol: TLS 1.3 + QUIC" },
    { type: "PHYSICAL", content: "  Latency: 12ms (avg) | 8ms (p50) | 24ms (p99)" },
    { type: "PHYSICAL", content: "  Bandwidth: 847 / 1000 Mbps" },
    { type: "NETWORK", content: "  Status: HEALTHY" },
  ],
  poi: [
    { type: "NETWORK", content: "Proof-of-Inference Engine:" },
    { type: "NETWORK", content: "  Verified GPUs: 7 (across 3 nodes)" },
    { type: "NETWORK", content: "  Challenges Passed: 12,471 / 12,483 (99.9%)" },
    { type: "NETWORK", content: "  Last: Alpha-01/GPU-0 PASSED (14s ago)" },
  ],
  fees: [
    { type: "NETWORK", content: "Fee Structure:" },
    { type: "NETWORK", content: "  Transaction Fee: 5% of compute cost" },
    { type: "NETWORK", content: "  2% -> Macro Reserve Pool" },
    { type: "NETWORK", content: "  2% -> Node Operator Reward" },
    { type: "NETWORK", content: "  1% -> Protocol Development Fund" },
  ],
}

function getTimestamp() {
  return new Date().toLocaleTimeString("en-US", { hour12: false })
}

interface SmartTerminalProps {
  isMinimized?: boolean
  onToggleMinimize?: () => void
}

export function SmartTerminal({
  isMinimized = false,
  onToggleMinimize,
}: SmartTerminalProps) {
  const ctx = useMinerRegistry()
  const genesisIgnited = ctx?.genesisIgnited ?? false
  const alpha01RentedBy = ctx?.nodeRentals?.[FOUNDATION_GENESIS_NODE_ID] ?? null
  const initialBlock = useMemo(
    () => buildGenesisStatusLines(genesisIgnited, alpha01RentedBy),
    [genesisIgnited, alpha01RentedBy]
  )
  const [lines, setLines] = useState<TerminalLine[]>(() => initialBlock)
  const [showDetailedLogs, setShowDetailedLogs] = useState(false)
  useEffect(() => {
    setLines((prev) => [...initialBlock, ...prev.slice(INITIAL_LINES_COUNT)])
  }, [initialBlock])
  const [input, setInput] = useState("")
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isSticky, setIsSticky] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const displayLines = useMemo(() => {
    if (showDetailedLogs) return lines
    return lines.filter(
      (l) =>
        !l.content.includes("Polling") &&
        !l.content.includes("Tunnel status:")
    )
  }, [lines, showDetailedLogs])

  // Repetitive polling (stored in full log; hidden when Detailed Logs off)
  useEffect(() => {
    const messages: TerminalLine[] = [
      { type: "SYSTEM", content: "Polling Genesis Smart Contract for ignition signal..." },
      { type: "NETWORK", content: "Tunnel status: PENDING_IGNITION | Ping: Awaiting Gateway" },
    ]
    let i = 0
    const interval = setInterval(() => {
      const msg = messages[i % messages.length]
      setLines((prev) => [...prev, { ...msg, timestamp: getTimestamp() }])
      i++
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // High-value events for main view — REWARD updates Node Card + Treasury in real time
  const addSimulatedReward = ctx?.addSimulatedReward
  useEffect(() => {
    const events: TerminalLine[] = [
      { type: "SYSTEM", content: "[SUCCESS] Heartbeat Verified" },
      { type: "NETWORK", content: "[REWARD] +0.5 NRG Interest Accrued" },
      { type: "PHYSICAL", content: "[WARNING] Packet Loss Detected" },
    ]
    let j = 0
    const t = setInterval(() => {
      const idx = j % events.length
      const line = { ...events[idx], timestamp: getTimestamp() }
      setLines((prev) => [...prev, line])
      if (idx === 1 && addSimulatedReward) addSimulatedReward(FOUNDATION_GENESIS_NODE_ID, 0.5)
      j++
    }, 12000)
    return () => clearInterval(t)
  }, [addSimulatedReward])

  const checkStickyScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setIsSticky(el.scrollHeight - el.scrollTop - el.clientHeight < 60)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", checkStickyScroll)
    return () => el.removeEventListener("scroll", checkStickyScroll)
  }, [checkStickyScroll])

  useEffect(() => {
    if (isSticky && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [lines, isSticky])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    setIsSticky(true)
  }, [])

  const handleCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim().toLowerCase()
    const timestamp = getTimestamp()

    if (trimmed === "clear") {
      setLines([{ type: "SYSTEM", content: "Terminal cleared.", timestamp }])
      return
    }

    const newLines: TerminalLine[] = [
      { type: "input", content: `$ ${cmd}`, timestamp },
    ]

    if (COMMAND_MAP[trimmed]) {
      COMMAND_MAP[trimmed].forEach((line) => {
        newLines.push({ ...line, timestamp })
      })
    } else if (trimmed) {
      newLines.push({
        type: "ERROR",
        content: `Command not found: '${trimmed}'. Type 'help'.`,
        timestamp,
      })
    }

    setLines((prev) => [...prev, ...newLines])
    setHistory((prev) => [cmd, ...prev])
    setHistoryIndex(-1)
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCommand(input)
      setInput("")
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (historyIndex < history.length - 1) {
        const next = historyIndex + 1
        setHistoryIndex(next)
        setInput(history[next])
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex > 0) {
        const next = historyIndex - 1
        setHistoryIndex(next)
        setInput(history[next])
      } else {
        setHistoryIndex(-1)
        setInput("")
      }
    }
  }

  if (isMinimized) {
    return (
      <div
        className="flex cursor-pointer items-center justify-between border border-border px-3 py-2"
        style={{ backgroundColor: "var(--terminal-bg)" }}
        onClick={onToggleMinimize}
        role="button"
        tabIndex={0}
        aria-label="Expand terminal"
        onKeyDown={(e) => e.key === "Enter" && onToggleMinimize?.()}
      >
        <div className="flex items-center gap-2 text-xs" style={{ color: "#00FF41" }}>
          <span style={{ color: "#00cc33" }}>{">"}</span>
          <span>TERMINAL</span>
          <span className="animate-blink">_</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-1.5 py-0.5 text-xs"
            style={{ backgroundColor: "rgba(0,255,65,0.1)", color: "#00FF41" }}
          >
            TUNNEL_STABLE
          </span>
          <span
            className="px-1.5 py-0.5 text-xs"
            style={{ backgroundColor: "rgba(0,255,65,0.1)", color: "#00FF41" }}
          >
            PoI_VERIFIED
          </span>
          <ChevronDown className="h-3 w-3" style={{ color: "#00FF41" }} />
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col overflow-hidden border border-border"
      style={{ backgroundColor: "var(--terminal-bg)" }}
      role="region"
      aria-label="Admin terminal"
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between border-b border-border px-3 py-1.5"
        style={{ backgroundColor: "rgba(0,255,65,0.03)" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <button
              onClick={onToggleMinimize}
              className="h-2.5 w-2.5 rounded-full transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#00FF41" }}
              aria-label="Minimize terminal"
            />
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "rgba(0,255,65,0.3)" }} />
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "rgba(0,255,65,0.15)" }} />
          </div>
          <span className="text-xs tracking-wider" style={{ color: "#00cc33" }}>
            neurogrid@alpha-01:~
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="px-1.5 py-0.5 text-xs"
            style={{ backgroundColor: "rgba(0,255,65,0.1)", color: "#00FF41" }}
          >
            TUNNEL_STABLE
          </span>
          <span
            className="px-1.5 py-0.5 text-xs"
            style={{ backgroundColor: "rgba(0,255,65,0.1)", color: "#00FF41" }}
          >
            PoI_VERIFIED
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowDetailedLogs((v) => !v)}
              className="rounded border px-2 py-1 text-[10px]"
              style={{ borderColor: showDetailedLogs ? "rgba(0,255,65,0.5)" : "rgba(0,255,65,0.25)", color: "rgba(0,255,65,0.8)" }}
            >
              {showDetailedLogs ? "Hide" : "Detailed"} Logs
            </button>
            <button
              type="button"
              onClick={() => {
                const logText = lines.map((l) => (l.timestamp ? `[${l.timestamp}] ` : "") + (l.content ?? "")).join("\n")
                navigator.clipboard.writeText(logText || "(no logs)").then(() => {
                  toast.success("Terminal logs copied. Include them in your bug report or feedback.")
                }).catch(() => toast.error("Could not copy logs."))
              }}
              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium"
              style={{ borderColor: "rgba(0,255,65,0.35)", color: "rgba(0,255,65,0.9)" }}
              title="Copy terminal logs for bug report / feedback"
            >
              <Bug className="h-3 w-3" />
              Report Bug / Feedback
            </button>
            <button onClick={onToggleMinimize} className="p-0.5 hover:opacity-80" aria-label="Minimize">
              <Minus className="h-3 w-3" style={{ color: "#00cc33" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Terminal body — fixed 6-line viewport, no jump */}
      <div
        ref={scrollRef}
        className="relative cursor-text overflow-y-auto overflow-x-hidden p-3"
        style={{ height: "10.5rem" }}
        onClick={() => inputRef.current?.focus()}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.01) 2px, rgba(0,255,65,0.01) 4px)",
          }}
        />

        <div className="relative z-10 flex flex-col gap-0.5 text-[11px]">
          {displayLines.map((line, i) =>
            line.type === "input" ? (
              <div key={i} className="flex items-start gap-2 px-2 py-0.5 text-xs">
                {line.timestamp && (
                  <span className="shrink-0" style={{ color: "rgba(0,255,65,0.25)" }}>
                    [{line.timestamp}]
                  </span>
                )}
                <span style={{ color: "#00FF41" }}>{line.content}</span>
              </div>
            ) : (
              <TerminalLog
                key={i}
                type={line.type as LogType}
                message={line.content}
                timestamp={line.timestamp}
              />
            )
          )}

          {/* Input */}
          <div className="flex items-center gap-1 px-2">
            <span style={{ color: "#00FF41" }}>$</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 border-none bg-transparent text-xs caret-transparent outline-none"
              style={{ color: "#00FF41" }}
              spellCheck={false}
              autoComplete="off"
              aria-label="Terminal input"
            />
            <span className="animate-blink" style={{ color: "#00FF41" }}>_</span>
          </div>
          <div ref={bottomRef} />
        </div>
      </div>

      {!isSticky && (
        <button
          onClick={scrollToBottom}
          className="flex items-center justify-center border-t border-border py-1 text-xs transition-colors hover:opacity-80"
          style={{ backgroundColor: "rgba(0,255,65,0.05)", color: "#00FF41" }}
          aria-label="Scroll to latest"
        >
          <ChevronDown className="mr-1 h-3 w-3" />
          New output below
        </button>
      )}
    </div>
  )
}
