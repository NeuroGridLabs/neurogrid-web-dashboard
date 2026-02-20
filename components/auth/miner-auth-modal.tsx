"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Wallet, HardHat } from "lucide-react"
import { useWallet } from "@/lib/contexts"

const BRAND = { border: "#00FF41", bg: "rgba(0,255,65,0.06)", text: "#00FF41" }

export function MinerAuthModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { openConnectModal } = useWallet()

  const handleConnect = () => {
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
          <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: BRAND.text }}>
            <HardHat className="h-4 w-4" />
            Connect Worker Wallet
          </DialogTitle>
          <DialogDescription className="text-xs" style={{ color: "rgba(0,255,65,0.65)" }}>
            Workers require an on-chain identity for hardware verification and staking. Use Phantom or MetaMask (primary); Solflare and others in the picker.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={handleConnect}
            className="flex w-full items-center justify-center gap-2 rounded border px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-90"
            style={{ borderColor: BRAND.border, backgroundColor: BRAND.bg, color: BRAND.text }}
          >
            <Wallet className="h-4 w-4" />
            Phantom, MetaMask & supported wallets
          </button>
          <p className="text-center text-[9px]" style={{ color: "rgba(0,255,65,0.4)" }}>
            The picker shows Phantom, MetaMask (with Solana Snap), Solflare, and other detected wallets.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
