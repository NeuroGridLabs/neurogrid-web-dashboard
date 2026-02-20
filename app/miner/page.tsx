"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/modules/footer"
import { ScanlineOverlay } from "@/components/atoms/scanline-overlay"
import { MinerForm, type MinerFormSubmitPayload } from "@/components/modules/miner-form"
import { NodeOnboardingPanel } from "@/components/modules/node-onboarding-panel"
import { PricingSlider } from "@/components/modules/pricing-slider"
import { HandshakeOverlay } from "@/components/modules/handshake-overlay"
import { MinerConnectTerminal } from "@/components/modules/miner-connect-terminal"
import { GenesisLeaderboardRankCard } from "@/components/modules/genesis-leaderboard-rank-card"
import { useWallet, useMinerRegistry, NODE_DISPLAY_NAMES } from "@/lib/contexts"
import { NeonButton } from "@/components/atoms/neon-button"
import { isGenesisNode } from "@/lib/genesis-node"
import { toast } from "sonner"

export default function MinerPortal() {
  const { isConnected, address, openConnectModal } = useWallet()
  const {
    registerMiner,
    registerMinerWithNodeId,
    getPriceRangeForGpu,
    getAvailableNodeId,
    getMinerNodes,
    clearAllRegistrationData,
  } = useMinerRegistry()
  const [handshakeActive, setHandshakeActive] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [connectTriggered, setConnectTriggered] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [lastRegisteredNodeId, setLastRegisteredNodeId] = useState<string | null>(null)
  const [pendingVerification, setPendingVerification] = useState(false)

  const priceRange = getPriceRangeForGpu("1x RTX4090")
  const canRegister = getAvailableNodeId() !== null
  const isGenesisWallet = isGenesisNode(address ?? undefined)

  const handleFormSubmit = useCallback(
    async (payload: MinerFormSubmitPayload) => {
      setRegisterError(null)
      setPendingVerification(false)
      if (!isConnected || !address) {
        setRegisterError("Wallet not connected.")
        return
      }
      if (!canRegister) {
        setRegisterError("No available node slot. All miners are currently registered.")
        return
      }

      try {
        const res = await fetch("/api/miner/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            pricePerHour: payload.pricePerHour,
            bandwidth: payload.bandwidth,
            gpuModel: payload.gpuModel,
            vram: payload.vram,
            gateway: payload.gateway,
            tunnelVerified: payload.tunnelVerified === true,
          }),
        })
        const data = await res.json().catch(() => null)

        if (!res.ok) {
          setRegisterError(data?.error ?? "Registration failed.")
          setPendingVerification(false)
          return
        }

        const nodeIdFromApi = data?.nodeId
        const isActive = data?.status === "ACTIVE"

        let nodeId: string | null = null
        if (nodeIdFromApi) {
          nodeId = registerMinerWithNodeId(nodeIdFromApi, address, {
            pricePerHour: payload.pricePerHour,
            bandwidth: payload.bandwidth,
          })
        }
        if (nodeId == null) {
          nodeId = registerMiner(address, {
            pricePerHour: payload.pricePerHour,
            bandwidth: payload.bandwidth,
          })
        }
        if (nodeId == null) {
          setRegisterError("No available node slot. All miners are currently registered.")
          return
        }
        setLastRegisteredNodeId(nodeId)
        setPendingVerification(!isActive)
        setConnectTriggered(true)
        setHandshakeActive(!isActive)
      } catch {
        setRegisterError("Network or server error. Try again.")
        setPendingVerification(false)
      }
    },
    [isConnected, address, canRegister, registerMiner, registerMinerWithNodeId]
  )

  const handleHandshakeComplete = useCallback(() => {
    setHandshakeActive(false)
    setSubmitted(true)
  }, [])

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "#050505" }}>
      <ScanlineOverlay />
      <HandshakeOverlay active={handshakeActive} onComplete={handleHandshakeComplete} />
      <Navbar />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 md:px-10">
        {/* Title — Genesis Command Center when connected with Admin Wallet */}
        <div
          className="flex flex-col gap-2 border border-border p-6"
          style={{
            backgroundColor: isGenesisWallet ? "rgba(0,255,65,0.03)" : "rgba(0,255,255,0.02)",
            borderColor: isGenesisWallet ? "rgba(0,255,65,0.2)" : undefined,
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-sm font-bold tracking-wider md:text-base" style={{ color: isGenesisWallet ? "#00FF41" : "#00FFFF" }}>
              {isGenesisWallet ? "GENESIS COMMAND CENTER" : "MINER PORTAL"}
            </h1>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              {isGenesisWallet ? "Alpha-01 · Foundation Seed Node" : "GPU Onboarding & Pricing"}
            </span>
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            {isGenesisWallet
              ? "Officially managed by NeuroGrid Foundation. 100% compute revenue flows to Treasury for $NRG buyback."
              : "Register your GPU hardware, set pricing, and connect via NeuroGrid tunnel protocol"}
          </p>
          {!isConnected && (
            <p className="mt-2 text-xs font-medium" style={{ color: "#00FF41" }}>
              Please Connect Wallet to Proceed
            </p>
          )}
        </div>

        {registerError && (
          <div
            className="flex items-center gap-3 border p-5"
            style={{
              borderColor: "rgba(255,100,80,0.4)",
              backgroundColor: "rgba(255,80,60,0.06)",
            }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: "#ff6655", boxShadow: "0 0 6px #ff6655" }}
            />
            <span className="text-sm" style={{ color: "#ff8866" }}>
              {registerError}
            </span>
          </div>
        )}

        {submitted && lastRegisteredNodeId && (
          <div
            className="flex flex-col gap-3 border p-5"
            style={{
              borderColor: pendingVerification ? "rgba(255,200,0,0.4)" : "rgba(0,255,65,0.3)",
              backgroundColor: pendingVerification ? "rgba(255,200,0,0.05)" : "rgba(0,255,65,0.05)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor: pendingVerification ? "#ffc800" : "#00FF41",
                  boxShadow: pendingVerification ? "0 0 6px #ffc800" : "0 0 6px #00FF41",
                }}
              />
              <span className="text-sm font-medium" style={{ color: pendingVerification ? "#ffc800" : "#00FF41" }}>
                {NODE_DISPLAY_NAMES[lastRegisteredNodeId] ?? lastRegisteredNodeId}{" "}
                {pendingVerification ? "— Pending tunnel verification" : "registered."}
              </span>
            </div>
            {pendingVerification ? (
              <div className="space-y-1 pl-5 text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>
                <p>
                  The backend will verify <strong>physical connectivity</strong> and <strong>tunnel handshake</strong>.
                  Only after the tunnel is established will this node appear as <strong>ACTIVE</strong> in{" "}
                  <Link href="/nodes" className="underline hover:no-underline" style={{ color: "#00FFFF" }}>
                    Node Command Center
                  </Link>{" "}
                  and be rentable.
                </p>
                <p style={{ color: "rgba(255,255,255,0.5)" }}>
                  Connect using NeuroClient or the config from the backend. Without a real backend, the node stays in PENDING and is not rentable.
                </p>
              </div>
            ) : (
              <p className="text-xs pl-5" style={{ color: "rgba(0,255,65,0.7)" }}>
                It is listed in{" "}
                <Link href="/nodes" className="underline hover:no-underline" style={{ color: "#00FFFF" }}>
                  Node Command Center
                </Link>{" "}
                (Nodes page). You can see it in My Registered Miners (Pricing Configuration panel). Connect backend and complete tunnel verification.
              </p>
            )}
          </div>
        )}

        {/* Genesis Leaderboard Rank — for registered miners */}
        {isConnected && address && getMinerNodes(address).length > 0 && (
          <div className="mt-2">
            <GenesisLeaderboardRankCard show />
          </div>
        )}

        {/* Grid: Node Onboarding (guest view or form) + Slider */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <NodeOnboardingPanel
            isConnected={!!isConnected}
            onConnectWallet={openConnectModal}
          >
            <MinerForm
              priceRange={priceRange}
              gpuTypeLabel="Same type (1x RTX4090)"
              canRegister={canRegister}
              onSubmit={handleFormSubmit}
            />
          </NodeOnboardingPanel>
          <PricingSlider />
        </div>

        {/* Terminal with auth overlay */}
        <div className="relative">
          {!isConnected && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
              style={{
                backgroundColor: "rgba(5,5,5,0.85)",
                backdropFilter: "blur(4px)",
              }}
            >
              <p className="text-center text-sm font-bold uppercase tracking-wider" style={{ color: "#00FF41" }}>
                Authentication Required: Connect Wallet to Sync Miner Identity
              </p>
              <NeonButton
                variant="primary"
                accentColor="#00FF41"
                onClick={openConnectModal}
              >
                Connect Wallet
              </NeonButton>
            </div>
          )}
          <MinerConnectTerminal
            connectTriggered={connectTriggered}
            isConnected={isConnected}
            walletAddress={address ?? undefined}
          />
          {isConnected && (
            <div className="mt-2 flex items-center gap-2">
              <NeonButton
                variant="primary"
                accentColor="#00FF41"
                className="text-xs px-4 py-2"
                onClick={() => {
                  const blob = new Blob(
                    [
                      "# NeuroGrid Tunnel / Miner config\n# Replace with backend-provisioned config for production.\n# Enterprise reverse-connection framework — low latency, high penetration, auto-reconnect.\n[common]\nserver_addr = \"ngrid.xyz\"\nserver_port = 7000\n\n[ssh]\ntype = \"tcp\"\nlocal_ip = \"127.0.0.1\"\nlocal_port = 22\nremote_port = 0\n",
                    ],
                    { type: "text/plain" }
                  )
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = isGenesisWallet ? "neurogrid-genesis-alpha01-tunnel.toml" : "neurogrid-miner-tunnel.toml"
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                Download Miner Config (Tunnel)
              </NeonButton>
              <span className="text-xs" style={{ color: "rgba(0,255,65,0.4)" }}>
                Wallet verified · Config unlocked
              </span>
            </div>
          )}

          {/* Clear all registration/test data */}
          <div className="mt-4 flex items-center gap-3">
            <NeonButton
              variant="secondary"
              accentColor="#ff6644"
              className="text-xs px-3 py-1.5"
              onClick={() => {
                clearAllRegistrationData()
                setSubmitted(false)
                setLastRegisteredNodeId(null)
                setPendingVerification(false)
                setRegisterError(null)
                toast.success("All registration and test data cleared.")
              }}
            >
              Clear all test data
            </NeonButton>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Resets miner registry, prices, rentals, and session data in this browser.
            </span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
