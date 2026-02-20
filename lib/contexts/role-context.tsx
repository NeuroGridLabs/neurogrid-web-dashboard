"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"

export type DashboardRole = "miner" | "tenant"

const STORAGE_KEY = "neurogrid-dashboard-role"

function loadRole(): DashboardRole {
  if (typeof window === "undefined") return "miner"
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === "tenant" || v === "miner") return v
  } catch {
    // ignore
  }
  return "miner"
}

function saveRole(role: DashboardRole) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, role)
  } catch {
    // ignore
  }
}

interface RoleContextValue {
  role: DashboardRole
  setRole: (role: DashboardRole) => void
  isMinerPortal: boolean
  isTenantWorkspace: boolean
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<DashboardRole>("miner")

  useEffect(() => {
    setRoleState(loadRole())
  }, [])

  const setRole = useCallback((next: DashboardRole) => {
    setRoleState(next)
    saveRole(next)
  }, [])

  const value: RoleContextValue = {
    role,
    setRole,
    isMinerPortal: role === "miner",
    isTenantWorkspace: role === "tenant",
  }

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error("useRole must be used within RoleProvider")
  return ctx
}
