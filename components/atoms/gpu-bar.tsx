interface GpuBarProps {
  value: number
  color?: string
  hideLabel?: boolean
  /** When true and value is 0, show a pulsing green bar for "Active Monitoring" */
  pulseWhenIdle?: boolean
}

export function GpuBar({ value, color = "#00FF41", hideLabel, pulseWhenIdle }: GpuBarProps) {
  const showPulse = pulseWhenIdle && value === 0
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden relative"
        style={{ backgroundColor: `${color}1a` }}
      >
        {showPulse ? (
          <div
            className="h-full w-full animate-pulse-glow-bar"
            style={{
              backgroundColor: `${color}40`,
              boxShadow: `0 0 8px ${color}60`,
            }}
          />
        ) : (
          <div
            className="h-full transition-all duration-1000"
            style={{
              width: `${value}%`,
              backgroundColor: value > 80 ? color : value > 50 ? `${color}cc` : `${color}66`,
              boxShadow: value > 80 ? `0 0 8px ${color}80` : "none",
            }}
          />
        )}
      </div>
      {!hideLabel && (
        <span className="w-8 shrink-0 text-right text-xs" style={{ color }}>
          {value}%
        </span>
      )}
    </div>
  )
}
