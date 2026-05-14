"use client"

import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div
          className="flex flex-col items-center justify-center gap-4 p-8 text-center"
          style={{ minHeight: "200px" }}
        >
          <p className="text-sm font-bold uppercase tracking-wider" style={{ color: "#ff6666" }}>
            Something went wrong
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            type="button"
            className="border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-90"
            style={{ borderColor: "#00FF41", color: "#00FF41" }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
