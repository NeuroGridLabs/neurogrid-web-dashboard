"use client"

import { useState } from "react"
import { HackerInput } from "@/components/atoms/hacker-input"
import { NeonButton } from "@/components/atoms/neon-button"

interface MinerFormProps {
  onSubmit?: () => void
}

export function MinerForm({ onSubmit }: MinerFormProps) {
  const [gpuModel, setGpuModel] = useState("")
  const [vram, setVram] = useState("")
  const [gateway, setGateway] = useState("")
  const [fingerprintReady, setFingerprintReady] = useState(false)

  const handleFingerprint = () => {
    setFingerprintReady(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.()
  }

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
          Node Onboarding
        </span>
        <span className="text-xs" style={{ color: "rgba(0,255,65,0.4)" }}>
          GPU Registration
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
        <HackerInput
          label="GPU Model"
          placeholder="e.g. RTX 4090"
          value={gpuModel}
          onChange={(e) => setGpuModel(e.target.value)}
        />
        <HackerInput
          label="VRAM (GB)"
          placeholder="e.g. 24"
          type="number"
          value={vram}
          onChange={(e) => setVram(e.target.value)}
        />
        <HackerInput
          label="FRP Gateway Address"
          placeholder="e.g. yournode.ngrid.io"
          value={gateway}
          onChange={(e) => setGateway(e.target.value)}
        />

        {/* Hardware fingerprint */}
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider" style={{ color: "rgba(0,255,65,0.5)" }}>
            Hardware Fingerprint
          </span>
          {fingerprintReady ? (
            <div
              className="flex items-center gap-2 border px-3 py-2"
              style={{ borderColor: "rgba(0,255,65,0.3)", backgroundColor: "rgba(0,255,65,0.05)" }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "#00FF41", boxShadow: "0 0 4px #00FF41" }}
              />
              <span className="text-xs" style={{ color: "#00FF41" }}>
                Fingerprint captured: 0x7f3a...b291
              </span>
            </div>
          ) : (
            <NeonButton
              type="button"
              variant="secondary"
              onClick={handleFingerprint}
            >
              Collect Hardware Fingerprint
            </NeonButton>
          )}
        </div>

        {/* Submit */}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <NeonButton type="submit" variant="primary" accentColor="#00FFFF">
            Connect Core via FRP
          </NeonButton>
          <NeonButton type="button" variant="secondary" accentColor="#00FF41">
            Start PoI Challenge
          </NeonButton>
        </div>
      </form>
    </div>
  )
}
