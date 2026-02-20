"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Wallet, Mail, MessageCircle, Lock } from "lucide-react"
import { useWallet } from "@/lib/contexts"

const BRAND = { border: "rgba(0,255,255,0.4)", bg: "rgba(0,255,255,0.06)", text: "#00FFFF" }

export type AuthModalMode = "miner" | "tenant"

/** miner = wallet only (Worker console). tenant = wallet + Web2 (Marketplace / tenant). */
export function AuthModal({
  open,
  onOpenChange,
  mode = "tenant",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: AuthModalMode
}) {
  const { openConnectModal } = useWallet()
  const walletOnly = mode === "miner"

  const handleWalletConnect = () => {
    onOpenChange(false)
    openConnectModal()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-2 sm:rounded-lg"
        style={{ backgroundColor: "#0a0a0a", borderColor: BRAND.border }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-bold uppercase tracking-wider" style={{ color: BRAND.text }}>
            {walletOnly ? "Connect as Miner" : "Login as Tenant"}
          </DialogTitle>
          <DialogDescription className="text-xs" style={{ color: "rgba(0,255,255,0.65)" }}>
            {walletOnly
              ? "Connect a Web3 wallet to operate nodes and access the Worker console."
              : "Sign in to rent GPU compute or manage workers. Use Web3 or Web2 (Email & social) when available."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(0,255,255,0.5)" }}>
            Web3 — Phantom & MetaMask (primary)
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={handleWalletConnect}
              className="flex items-center justify-center gap-2 rounded border px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-90"
              style={{ borderColor: BRAND.border, backgroundColor: BRAND.bg, color: BRAND.text }}
            >
              <Wallet className="h-4 w-4" />
              Phantom, MetaMask & supported wallets
            </button>
          </div>
          <p className="text-[9px]" style={{ color: "rgba(0,255,255,0.4)" }}>
            Solflare and other Solana wallets appear as fallback options in the picker.
          </p>
          {!walletOnly && (
            <div
              className="relative mt-4 rounded-md border p-3"
              style={{
                borderColor: "rgba(0,255,255,0.12)",
                backgroundColor: "rgba(0,255,255,0.03)",
              }}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(0,255,255,0.45)" }} aria-hidden />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(0,255,255,0.45)" }}>
                  Web2 Access (Coming Soon)
                </p>
              </div>
              <p className="mb-3 text-[10px] leading-snug" style={{ color: "rgba(0,255,255,0.4)" }}>
                We are integrating Account Abstraction for frictionless Web2 onboarding. For the v3.5 Genesis phase,
                please connect using a Web3 Wallet.
              </p>
              <div className="grid grid-cols-1 gap-2 cursor-not-allowed select-none" aria-disabled="true">
                <button
                  type="button"
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded border px-4 py-3 text-xs font-bold uppercase tracking-wider transition-none"
                  style={{
                    borderColor: "rgba(0,255,255,0.18)",
                    backgroundColor: "rgba(0,255,255,0.04)",
                    color: "rgba(0,255,255,0.45)",
                    opacity: 0.85,
                  }}
                  title="Coming in v4.0"
                >
                  <span className="text-sm">G</span>
                  Google SSO
                </button>
                <button
                  type="button"
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded border px-4 py-3 text-xs font-bold uppercase tracking-wider transition-none"
                  style={{
                    borderColor: "rgba(0,255,255,0.18)",
                    backgroundColor: "rgba(0,255,255,0.04)",
                    color: "rgba(0,255,255,0.45)",
                    opacity: 0.85,
                  }}
                  title="Coming in v4.0"
                >
                  <MessageCircle className="h-4 w-4" />
                  Discord SSO
                </button>
                <button
                  type="button"
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded border px-4 py-3 text-xs font-bold uppercase tracking-wider transition-none"
                  style={{
                    borderColor: "rgba(0,255,255,0.18)",
                    backgroundColor: "rgba(0,255,255,0.04)",
                    color: "rgba(0,255,255,0.45)",
                    opacity: 0.85,
                  }}
                  title="Coming in v4.0"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
