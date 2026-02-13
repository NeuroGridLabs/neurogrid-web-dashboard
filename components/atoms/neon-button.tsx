import { type ButtonHTMLAttributes } from "react"

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost"
  accentColor?: string
}

export function NeonButton({
  children,
  variant = "primary",
  accentColor = "#00FF41",
  className,
  ...props
}: NeonButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:pointer-events-none"

  const variants: Record<string, string> = {
    primary: "",
    secondary: "",
    ghost: "",
  }

  const styles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: accentColor,
      color: "#050505",
      boxShadow: `0 0 12px ${accentColor}44`,
    },
    secondary: {
      backgroundColor: "transparent",
      color: accentColor,
      border: `1px solid ${accentColor}`,
    },
    ghost: {
      backgroundColor: "transparent",
      color: `${accentColor}aa`,
    },
  }

  return (
    <button
      className={`${base} ${variants[variant]} hover:opacity-90 ${className ?? ""}`}
      style={styles[variant]}
      {...props}
    >
      {children}
    </button>
  )
}
