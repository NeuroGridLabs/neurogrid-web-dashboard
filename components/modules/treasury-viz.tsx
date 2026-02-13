"use client"

import { useEffect, useState, useRef } from "react"
import { StatCard } from "@/components/atoms/stat-card"
import { Shield, TrendingUp, ArrowDownRight } from "lucide-react"

function TreasuryChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef = useRef<number[]>([])
  const frameRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Initialize data
    if (dataRef.current.length === 0) {
      dataRef.current = Array.from({ length: 60 }, (_, i) =>
        10 + Math.sin(i * 0.1) * 2 + i * 0.04
      )
    }

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect) return
      canvas.width = rect.width * 2
      canvas.height = rect.height * 2
      ctx.scale(2, 2)
    }
    resize()

    let lastUpdate = 0
    const draw = (time: number) => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect) return
      const w = rect.width
      const h = rect.height

      // Add data point every 500ms
      if (time - lastUpdate > 500) {
        const last = dataRef.current[dataRef.current.length - 1]
        dataRef.current.push(last + (Math.random() - 0.3) * 0.1)
        if (dataRef.current.length > 120) dataRef.current.shift()
        lastUpdate = time
      }

      ctx.clearRect(0, 0, w, h)
      const data = dataRef.current
      const minV = Math.min(...data) - 0.5
      const maxV = Math.max(...data) + 0.5
      const range = maxV - minV

      // Grid lines
      ctx.strokeStyle = "rgba(0,255,65,0.06)"
      ctx.lineWidth = 0.5
      for (let i = 0; i < 5; i++) {
        const y = (i / 4) * h
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      // Line
      ctx.strokeStyle = "#00FF41"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * w
        const y = h - ((v - minV) / range) * h
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      // Fill under
      const lastX = w
      const lastY = h - ((data[data.length - 1] - minV) / range) * h
      ctx.lineTo(lastX, h)
      ctx.lineTo(0, h)
      ctx.closePath()
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, "rgba(0,255,65,0.15)")
      grad.addColorStop(1, "rgba(0,255,65,0)")
      ctx.fillStyle = grad
      ctx.fill()

      // Current value dot
      ctx.fillStyle = "#00FF41"
      ctx.shadowColor = "#00FF41"
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)
    const observer = new ResizeObserver(resize)
    if (canvas.parentElement) observer.observe(canvas.parentElement)

    return () => {
      cancelAnimationFrame(frameRef.current)
      observer.disconnect()
    }
  }, [])

  return (
    <div className="relative h-40 w-full md:h-52">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        aria-label="Treasury reserve inflow chart"
        role="img"
      />
    </div>
  )
}

export function TreasuryViz() {
  const [balance, setBalance] = useState(12.847)

  useEffect(() => {
    const interval = setInterval(() => {
      setBalance((b) => +(b + Math.random() * 0.005).toFixed(3))
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="border border-border"
      style={{ backgroundColor: "var(--terminal-bg)" }}
    >
      <div
        className="flex items-center justify-between border-b border-border px-4 py-2"
        style={{ backgroundColor: "rgba(0,255,65,0.03)" }}
      >
        <span className="text-xs uppercase tracking-wider" style={{ color: "#00cc33" }}>
          Treasury Monitor
        </span>
        <span className="text-xs" style={{ color: "rgba(0,255,65,0.4)" }}>
          2% Reserve Inflow
        </span>
      </div>

      <div className="grid grid-cols-3 gap-px" style={{ backgroundColor: "rgba(0,255,65,0.05)" }}>
        <div className="flex flex-col gap-1 p-3" style={{ backgroundColor: "var(--terminal-bg)" }}>
          <span className="text-xs" style={{ color: "rgba(0,255,65,0.4)" }}>Balance</span>
          <span className="text-sm font-bold" style={{ color: "#00FF41" }}>{balance} ETH</span>
        </div>
        <div className="flex flex-col gap-1 p-3" style={{ backgroundColor: "var(--terminal-bg)" }}>
          <span className="text-xs" style={{ color: "rgba(0,255,65,0.4)" }}>24h Inflow</span>
          <span className="text-sm font-bold" style={{ color: "#00FF41" }}>+0.234 ETH</span>
        </div>
        <div className="flex flex-col gap-1 p-3" style={{ backgroundColor: "var(--terminal-bg)" }}>
          <span className="text-xs" style={{ color: "rgba(0,255,65,0.4)" }}>Last Buyback</span>
          <span className="text-sm font-bold" style={{ color: "#00FF41" }}>0.08 ETH</span>
        </div>
      </div>

      <TreasuryChart />
    </div>
  )
}
