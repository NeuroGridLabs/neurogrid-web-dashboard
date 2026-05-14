"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useWallet } from "@/lib/contexts/wallet-context"
import { toast } from "sonner"

export type AuthMethod = "wallet" | "web2" | null

/** UI preference — stays in localStorage */
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
  authMethod: AuthMethod
  setAuthMethod: (method: AuthMethod) => void
  canSwitchRole: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** JWT auto-refresh interval: check every 5 minutes */
const REFRESH_CHECK_INTERVAL = 5 * 60 * 1000

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useWallet()
  const queryClient = useQueryClient()
  const [authMethod, setAuthMethodState] = useState<AuthMethod>(() => loadAuthMethod())
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Wallet connect/disconnect sync
  useEffect(() => {
    if (isConnected) {
      setAuthMethodState("wallet")
      saveAuthMethod("wallet")
      fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authMethod: "wallet" }),
      }).catch((e) => {
        toast.error("Failed to sync auth session", {
          description: e instanceof Error ? e.message : "Network error",
        })
      })
    } else {
      // C-FE-01: Full cleanup on disconnect
      setAuthMethodState(null)
      saveAuthMethod(null)

      // Clear JWT cookie via server
      fetch("/api/auth/session", { method: "DELETE" }).catch((e) => {
        toast.error("Failed to clear session", {
          description: e instanceof Error ? e.message : "Network error",
        })
      })

      // Clear all React Query caches
      queryClient.removeQueries()

      // Stop JWT refresh timer
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current)
        refreshTimer.current = null
      }
    }
  }, [isConnected, queryClient])

  // JWT auto-refresh: check periodically, refresh if expiring within 1 hour
  useEffect(() => {
    if (!isConnected) return

    const checkAndRefresh = async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" })
        if (!res.ok && res.status === 401) {
          // JWT expired completely — user needs to reconnect
          toast.warning("Session expired. Please reconnect your wallet.")
        }
      } catch {
        // Network error — silent, will retry next interval
      }
    }

    refreshTimer.current = setInterval(checkAndRefresh, REFRESH_CHECK_INTERVAL)

    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current)
        refreshTimer.current = null
      }
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
