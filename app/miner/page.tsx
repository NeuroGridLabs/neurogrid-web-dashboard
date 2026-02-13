"use client"

import { useState, useCallback } from "react"
import { Header } from "@/components/modules/header"
import { Footer } from "@/components/modules/footer"
import { ScanlineOverlay } from "@/components/atoms/scanline-overlay"
import { MinerForm } from "@/components/modules/miner-form"
import { PricingSlider } from "@/components/modules/pricing-slider"
import { HandshakeOverlay } from "@/components/modules/handshake-overlay"
import { MinerConnectTerminal } from "@/components/modules/miner-connect-terminal"

export default function MinerPortal() {
  const [handshakeActive, setHandshakeActive] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [connectTriggered, setConnectTriggered] = useState(false)

  const handleFormSubmit = useCallback(() => {
    setConnectTriggered(true)
    setHandshakeActive(true)
  }, [])

  const handleHandshakeComplete = useCallback(() => {
    setHandshakeActive(false)
    setSubmitted(true)
  }, [])

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "#050505" }}>
      <ScanlineOverlay />
      <HandshakeOverlay active={handshakeActive} onComplete={handleHandshakeComplete} />
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6">
        {/* Title */}
        <div
          className="flex flex-col gap-1 border border-border p-4"
          style={{ backgroundColor: "rgba(0,255,255,0.02)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-sm font-bold tracking-wider md:text-base" style={{ color: "#00FFFF" }}>
              MINER PORTAL
            </h1>
            <span className="text-xs" style={{ color: "rgba(0,255,255,0.3)" }}>|</span>
            <span className="text-xs" style={{ color: "rgba(0,255,255,0.4)" }}>
              GPU Onboarding & Pricing
            </span>
          </div>
          <p className="text-xs" style={{ color: "rgba(0,255,255,0.5)" }}>
            Register your GPU hardware, set pricing, and connect via FRP tunnel
          </p>
        </div>

        {submitted && (
          <div
            className="flex items-center gap-3 border p-4"
            style={{
              borderColor: "rgba(0,255,65,0.3)",
              backgroundColor: "rgba(0,255,65,0.05)",
            }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "#00FF41", boxShadow: "0 0 6px #00FF41" }}
            />
            <span className="text-sm" style={{ color: "#00FF41" }}>
              Node successfully registered. PoI verification pending.
            </span>
          </div>
        )}

        {/* Grid: Form + Slider */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <MinerForm onSubmit={handleFormSubmit} />
          <PricingSlider />
        </div>

        {/* Connect Terminal - simulates [NET]/[PHY]/[SYS] output on Connect */}
        <MinerConnectTerminal connectTriggered={connectTriggered} />
      </main>

      <Footer />
    </div>
  )
}
