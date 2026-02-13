"use client"

import { useEffect, useState, useCallback } from "react"
import type { TreasuryData } from "@/lib/treasury-api"

const CACHE_TTL = 60_000
let clientCache: { data: TreasuryData; ts: number } | null = null

export function useTreasuryData() {
  const [data, setData] = useState<TreasuryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const now = Date.now()
    if (clientCache && now - clientCache.ts < CACHE_TTL) {
      setData(clientCache.data)
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const r = await fetch("/api/treasury")
      if (!r.ok) throw new Error("Treasury fetch failed")
      const d: TreasuryData = await r.json()
      clientCache = { data: d, ts: now }
      setData(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
