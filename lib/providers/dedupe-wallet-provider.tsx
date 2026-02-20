"use client"

/**
 * Wallet provider that deduplicates wallet adapters by name so only one entry
 * per wallet appears (e.g. one MetaMask instead of "MetaMask" + "MetaMask (Solana)").
 */

import {
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
  SolanaMobileWalletAdapter,
  SolanaMobileWalletAdapterWalletName,
} from "@solana-mobile/wallet-adapter-mobile"
import type { Adapter, WalletError, WalletName } from "@solana/wallet-adapter-base"
import { useConnection, useLocalStorage } from "@solana/wallet-adapter-react"
import { useStandardWalletAdapters } from "@solana/wallet-standard-wallet-adapter-react"
import React, { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react"

import getEnvironment, {
  Environment,
} from "../../node_modules/@solana/wallet-adapter-react/lib/esm/getEnvironment.js"
import getInferredClusterFromEndpoint from "../../node_modules/@solana/wallet-adapter-react/lib/esm/getInferredClusterFromEndpoint.js"
import { WalletProviderBase } from "../../node_modules/@solana/wallet-adapter-react/lib/esm/WalletProviderBase.js"

function supportsSolanaChain(adapter: Adapter): boolean {
  const w = (adapter as { wallet?: { chains?: string[] } }).wallet
  if (!w?.chains?.length) return false
  return w.chains.some((c) => String(c).startsWith("solana:"))
}

function dedupeAdaptersByName(adapters: Adapter[]): Adapter[] {
  const byName = new Map<string, Adapter>()
  for (const a of adapters) {
    const name = a.name
    const existing = byName.get(name)
    if (!existing) {
      byName.set(name, a)
      continue
    }
    const currentSolana = supportsSolanaChain(a)
    const existingSolana = supportsSolanaChain(existing)
    if (currentSolana && !existingSolana) {
      byName.set(name, a)
    } else if (!currentSolana && existingSolana) {
      // keep existing
    } else {
      byName.set(name, a)
    }
  }
  return Array.from(byName.values()).sort((a, b) => {
    const ai = adapters.indexOf(a)
    const bi = adapters.indexOf(b)
    return ai - bi
  })
}

function getIsMobile(adapters: Adapter[]) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null
  return getEnvironment({ adapters, userAgentString: ua }) === Environment.MOBILE_WEB
}

function getUriForAppIdentity() {
  if (typeof location === "undefined") return undefined
  return `${location.protocol}//${location.host}`
}

export interface DedupeWalletProviderProps {
  children: ReactNode
  wallets: Adapter[]
  autoConnect?: boolean | ((adapter: Adapter) => Promise<boolean>)
  localStorageKey?: string
  onError?: (error: WalletError, adapter?: Adapter) => void
}

export function DedupeWalletProvider({
  children,
  wallets: adapters,
  autoConnect,
  localStorageKey = "walletName",
  onError,
}: DedupeWalletProviderProps) {
  const { connection } = useConnection()
  const adaptersWithStandardAdapters = useStandardWalletAdapters(adapters)
  const deduped = useMemo(() => dedupeAdaptersByName(adaptersWithStandardAdapters), [adaptersWithStandardAdapters])

  const mobileWalletAdapter = useMemo(() => {
    if (!getIsMobile(deduped)) return null
    const existing = deduped.find((a) => a.name === SolanaMobileWalletAdapterWalletName)
    if (existing) return existing
    return new SolanaMobileWalletAdapter({
      addressSelector: createDefaultAddressSelector(),
      appIdentity: { uri: getUriForAppIdentity() },
      authorizationResultCache: createDefaultAuthorizationResultCache(),
      cluster: getInferredClusterFromEndpoint(connection?.rpcEndpoint),
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    })
  }, [deduped, connection?.rpcEndpoint])

  const adaptersWithMobileWalletAdapter = useMemo(() => {
    if (mobileWalletAdapter == null || deduped.indexOf(mobileWalletAdapter) !== -1) return deduped
    return [mobileWalletAdapter, ...deduped]
  }, [deduped, mobileWalletAdapter])

  const [walletName, setWalletName] = useLocalStorage<WalletName | null>(localStorageKey, null)
  const adapter = useMemo(
    () => adaptersWithMobileWalletAdapter.find((a) => a.name === walletName) ?? null,
    [adaptersWithMobileWalletAdapter, walletName]
  )

  const isUnloadingRef = useRef(false)
  const changeWallet = useCallback(
    (nextWalletName: WalletName | null) => {
      if (walletName === nextWalletName) return
      if (adapter && adapter.name !== SolanaMobileWalletAdapterWalletName) adapter.disconnect()
      setWalletName(nextWalletName)
    },
    [adapter, setWalletName, walletName]
  )

  useEffect(() => {
    if (!adapter) return
    function handleDisconnect() {
      if (isUnloadingRef.current) return
      setWalletName(null)
    }
    adapter.on("disconnect", handleDisconnect)
    return () => adapter.off("disconnect", handleDisconnect)
  }, [adapter, setWalletName, walletName])

  const hasUserSelectedAWallet = useRef(false)
  const handleAutoConnectRequest = useMemo(() => {
    if (!autoConnect || !adapter) return undefined
    return async () => {
      if (autoConnect === true || (await (typeof autoConnect === "function" ? autoConnect(adapter) : false))) {
        if (hasUserSelectedAWallet.current) await adapter.connect()
        else await adapter.autoConnect()
      }
    }
  }, [autoConnect, adapter])

  useEffect(() => {
    if (walletName === SolanaMobileWalletAdapterWalletName && getIsMobile(deduped)) {
      isUnloadingRef.current = false
      return
    }
    function handleBeforeUnload() {
      isUnloadingRef.current = true
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [deduped, walletName])

  const handleConnectError = useCallback(() => {
    if (adapter) changeWallet(null)
  }, [adapter, changeWallet])

  const selectWallet = useCallback(
    (name: WalletName | null) => {
      hasUserSelectedAWallet.current = true
      changeWallet(name)
    },
    [changeWallet]
  )

  return (
    <WalletProviderBase
      wallets={adaptersWithMobileWalletAdapter}
      adapter={adapter}
      isUnloadingRef={isUnloadingRef}
      onAutoConnectRequest={handleAutoConnectRequest}
      onConnectError={handleConnectError}
      onError={onError}
      onSelectWallet={selectWallet}
    >
      {children}
    </WalletProviderBase>
  )
}
