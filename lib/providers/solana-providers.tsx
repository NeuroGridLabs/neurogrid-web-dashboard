"use client"

import { useMemo, useEffect, type ReactNode } from "react"
import { ConnectionProvider } from "@solana/wallet-adapter-react"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets"
import { initializeWhenDetected } from "@solflare-wallet/metamask-wallet-standard"
import "@solana/wallet-adapter-react-ui/styles.css"
import { DedupeWalletProvider } from "@/lib/providers/dedupe-wallet-provider"

let metamaskRegistered = false
function registerMetaMaskOnce() {
  if (metamaskRegistered || typeof window === "undefined") return
  metamaskRegistered = true
  try {
    initializeWhenDetected()
  } catch {
    metamaskRegistered = false
  }
}

const cluster = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? (process.env.NODE_ENV === "production" ? "mainnet-beta" : "devnet")
const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC ?? (cluster === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com")

export function SolanaProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    registerMetaMaskOnce()
  }, [])

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <DedupeWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </DedupeWalletProvider>
    </ConnectionProvider>
  )
}
