export type LogType = "PHYSICAL" | "NETWORK" | "SYSTEM" | "ERROR" | "FINANCIAL"

interface TerminalLogProps {
  type: LogType
  message: string
  timestamp?: string
}

const LOG_COLORS: Record<LogType, string> = {
  PHYSICAL: "#00FFFF",
  NETWORK: "#00FF41",
  SYSTEM: "#00cc33",
  ERROR: "#ff4444",
  FINANCIAL: "#00FF41",
}

const LOG_LABELS: Record<LogType, string> = {
  PHYSICAL: "PHY",
  NETWORK: "NET",
  SYSTEM: "SYS",
  ERROR: "ERR",
  FINANCIAL: "FIN",
}

export function TerminalLog({ type, message, timestamp }: TerminalLogProps) {
  const color = LOG_COLORS[type]
  return (
    <div className="flex items-start gap-2 px-2 py-0.5 text-xs">
      {timestamp && (
        <span className="shrink-0" style={{ color: "rgba(0,255,65,0.25)" }}>
          [{timestamp}]
        </span>
      )}
      <span
        className="shrink-0 px-1 py-0.5 font-bold"
        style={{
          backgroundColor: `${color}11`,
          color,
          border: `1px solid ${color}33`,
        }}
      >
        {LOG_LABELS[type]}
      </span>
      <span className="break-all" style={{ color: `${color}bb` }}>
        {message}
      </span>
    </div>
  )
}
