"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { useWallet } from "@/lib/contexts/wallet-context"

export type AuthMethod = "wallet" | "web2" | null

const AUTH_METHOD_KEY = "neurogrid-auth-method"

function loadAuthMethod(): AuthMethod {
  if (typeof window === "undefined") return null
  try {
    const v = localStorage.getItem(AUTH_METHOD_KEY)
    if (v === "wallet" || v === "web2") return v
  } catch {
    // ignore
  }
  return null
}

function saveAuthMethod(method: AuthMethod) {
  if (typeof window === "undefined") return
  try {
    if (method) localStorage.setItem(AUTH_METHOD_KEY, method)
    else localStorage.removeItem(AUTH_METHOD_KEY)
  } catch {
    // ignore
  }
}

interface AuthContextValue {
  /** How the user authenticated: wallet (Web3) or web2 (email/social). Null when disconnected. */
  authMethod: AuthMethod
  /** Set authMethod to 'web2' when Web2 login succeeds. Wallet connect is synced automatically. */
  setAuthMethod: (method: AuthMethod) => void
  /** True if user can access both Miner and Tenant views (wallet-only). */
  canSwitchRole: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Must be used inside WalletProvider. Syncs authMethod from wallet: connected => 'wallet', disconnected => null. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useWallet()
  const [authMethod, setAuthMethodState] = useState<AuthMethod>(() => loadAuthMethod())

  useEffect(() => {
    if (isConnected) {
      setAuthMethodState("wallet")
      saveAuthMethod("wallet")
      fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authMethod: "wallet" }),
      }).catch(() => {})
    } else {
      setAuthMethodState(null)
      saveAuthMethod(null)
      fetch("/api/auth/session", { method: "DELETE" }).catch(() => {})
    }
  }, [isConnected])

  const setAuthMethod = useCallback((method: AuthMethod) => {
    setAuthMethodState(method)
    saveAuthMethod(method)
  }, [])

  const value: AuthContextValue = {
    authMethod,
    setAuthMethod,
    canSwitchRole: authMethod === "wallet",
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
