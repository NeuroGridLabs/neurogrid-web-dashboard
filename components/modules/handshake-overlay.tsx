"use client"

import { useEffect, useState, useCallback, useMemo } from "react"

const HEX_CHARS = "0123456789ABCDEF"

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

const STEPS = [
  "INITIALIZING SECURE HANDSHAKE...",
  "GENERATING RSA-4096 KEY PAIR...",
  "ESTABLISHING FRP TUNNEL...",
  "NEGOTIATING TLS 1.3 CIPHER...",
  "VERIFYING HARDWARE FINGERPRINT...",
  "PoI CHALLENGE: PASSED",
  "PROTOCOL HANDSHAKE COMPLETE.",
]

function HexRing({ size, duration, reverse }: { size: number; duration: number; reverse?: boolean }) {
  const segments = 6
  const radius = size / 2 - 2
  const points = Array.from({ length: segments }, (_, i) => {
    const angle = (Math.PI * 2 * i) / segments - Math.PI / 2
    return `${size / 2 + radius * Math.cos(angle)},${size / 2 + radius * Math.sin(angle)}`
  }).join(" ")

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="absolute"
      style={{ animation: `hexRotate ${duration}s linear infinite ${reverse ? "reverse" : ""}` }}
    >
      <polygon points={points} fill="none" stroke="#00FF41" strokeWidth="1" opacity="0.4" />
    </svg>
  )
}

interface HandshakeOverlayProps {
  active: boolean
  onComplete?: () => void
}

export function HandshakeOverlay({ active, onComplete }: HandshakeOverlayProps) {
  const [step, setStep] = useState(0)
  const [hexStream, setHexStream] = useState("")
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (!active) {
      setStep(0)
      setExiting(false)
      return
    }

    const interval = setInterval(() => {
      setHexStream(
        Array.from({ length: 32 }, () => HEX_CHARS[Math.floor(Math.random() * 16)]).join("")
      )
    }, 60)
    return () => clearInterval(interval)
  }, [active])

  useEffect(() => {
    if (!active) return
    if (step < STEPS.length) {
      const t = setTimeout(() => setStep((s) => s + 1), 800)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => {
        setExiting(true)
        setTimeout(() => onComplete?.(), 500)
      }, 400)
      return () => clearTimeout(t)
    }
  }, [active, step, onComplete])

  if (!active) return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-500 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
      style={{ backgroundColor: "rgba(5,5,5,0.97)" }}
      role="dialog"
      aria-label="Protocol handshake in progress"
    >
      {/* Hex rings */}
      <div className="relative flex items-center justify-center">
        <HexRing size={180} duration={8} />
        <HexRing size={140} duration={6} reverse />
        <HexRing size={100} duration={4} />
        <div className="absolute">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00FF41" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      </div>

      {/* Status */}
      <div className="relative z-10 mt-10 flex flex-col items-center gap-3 px-4">
        <h2 className="text-sm font-bold tracking-widest" style={{ color: "#00FF41" }}>
          PROTOCOL HANDSHAKE
        </h2>
        <div
          className="max-w-md truncate text-center text-xs opacity-25"
          style={{ color: "#00FF41" }}
          aria-hidden="true"
        >
          {hexStream}
        </div>
        <div className="mt-3 flex w-full max-w-md flex-col gap-1 text-xs">
          {STEPS.slice(0, step).map((s, i) => (
            <div key={i} className="flex items-center gap-2 animate-fade-in-up">
              <span style={{ color: i === STEPS.length - 1 && step >= STEPS.length ? "#00FF41" : "#00cc33" }}>
                {i === STEPS.length - 1 && step >= STEPS.length ? "[OK]" : "[>>]"}
              </span>
              <span style={{ color: i === STEPS.length - 1 && step >= STEPS.length ? "#00FF41" : "#00cc33" }}>
                {s}
              </span>
            </div>
          ))}
          {step < STEPS.length && (
            <span className="animate-blink" style={{ color: "#00FF41" }}>_</span>
          )}
        </div>
        <div className="mt-3 h-px w-48 overflow-hidden" style={{ backgroundColor: "rgba(0,255,65,0.1)" }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${(step / STEPS.length) * 100}%`,
              backgroundColor: "#00FF41",
              boxShadow: "0 0 10px #00FF41",
            }}
          />
        </div>
      </div>
    </div>
  )
}
