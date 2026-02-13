interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
  accentColor?: string
  pulse?: boolean
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  accentColor = "#00FF41",
  pulse,
}: StatCardProps) {
  return (
    <div
      className="group relative overflow-hidden border border-border p-4 transition-all hover:border-primary/40"
      style={{ backgroundColor: "var(--terminal-bg)" }}
    >
      <div
        className="absolute right-0 top-0 h-4 w-4 border-r border-t"
        style={{ borderColor: `${accentColor}33` }}
      />
      <div
        className="absolute bottom-0 left-0 h-4 w-4 border-b border-l"
        style={{ borderColor: `${accentColor}33` }}
      />
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: `${accentColor}66` }}
          >
            {label}
          </span>
          <span
            className={`text-lg font-bold md:text-xl ${pulse ? "animate-pulse-glow" : ""}`}
            style={{ color: accentColor }}
          >
            {value}
          </span>
          {sub && (
            <span className="text-xs" style={{ color: `${accentColor}80` }}>
              {sub}
            </span>
          )}
        </div>
        {icon && (
          <div
            className="rounded p-2 transition-colors group-hover:bg-primary/10"
            style={{ color: accentColor }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
