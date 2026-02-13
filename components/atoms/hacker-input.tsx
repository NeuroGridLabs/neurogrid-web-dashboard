import { forwardRef, type InputHTMLAttributes } from "react"

interface HackerInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export const HackerInput = forwardRef<HTMLInputElement, HackerInputProps>(
  ({ label, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        <label
          className="text-xs uppercase tracking-wider"
          style={{ color: "rgba(0,255,65,0.5)" }}
        >
          {label}
        </label>
        <input
          ref={ref}
          className={`border border-border bg-transparent px-3 py-2 text-sm outline-none transition-colors
            placeholder:text-muted-foreground
            focus:border-primary focus:shadow-[0_0_8px_rgba(0,255,65,0.15)] ${className ?? ""}`}
          style={{ color: "#00FF41" }}
          spellCheck={false}
          autoComplete="off"
          {...props}
        />
      </div>
    )
  }
)
HackerInput.displayName = "HackerInput"
