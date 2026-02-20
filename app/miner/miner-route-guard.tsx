"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "@/lib/contexts"

/** Redirects Web2 users from Miner Console to Marketplace. Renders children only for wallet users. */
export function MinerRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { authMethod } = useAuth()

  useEffect(() => {
    if (authMethod === "web2") {
      toast.error("Access Denied: Operating a node requires a Web3 Wallet connection.")
      router.replace("/nodes")
    }
  }, [authMethod, router])

  if (authMethod === "web2") return null
  return <>{children}</>
}
