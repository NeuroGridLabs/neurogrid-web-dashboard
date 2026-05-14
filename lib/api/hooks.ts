"use client"

/**
 * React Query hooks for server-state management.
 * Replaces localStorage-backed state in MinerRegistryContext.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  fetchNodes,
  registerMiner,
  deployAssign,
  settleHour,
  fileDispute,
  reclaimSession,
  fetchTreasury,
  fetchEscrowBreakdown,
  type NodeApiResponse,
  type MinerRegisterRequest,
  type DeployAssignRequest,
  type SettleRequest,
  type DisputeRequest,
  type ReclaimRequest,
} from "./client"

/* ── Query keys ─────────────────────────────────────────── */

export const queryKeys = {
  nodes: ["nodes"] as const,
  treasury: ["treasury"] as const,
  escrowBreakdown: (hours: number, price: number) => ["escrow-breakdown", hours, price] as const,
}

/* ── Nodes ──────────────────────────────────────────────── */

export function useNodes() {
  return useQuery({
    queryKey: queryKeys.nodes,
    queryFn: fetchNodes,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/* ── Treasury ───────────────────────────────────────────── */

export function useTreasury() {
  return useQuery({
    queryKey: queryKeys.treasury,
    queryFn: () => fetchTreasury(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

export function useTreasuryRefresh() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => fetchTreasury(true),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.treasury, data)
    },
  })
}

/* ── Escrow Breakdown ───────────────────────────────────── */

export function useEscrowBreakdown(hours: number, price: number) {
  return useQuery({
    queryKey: queryKeys.escrowBreakdown(hours, price),
    queryFn: () => fetchEscrowBreakdown(hours, price),
    enabled: hours > 0 && price > 0,
    staleTime: 300_000,
  })
}

/* ── Mutations ──────────────────────────────────────────── */

export function useRegisterMiner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: MinerRegisterRequest) => registerMiner(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.nodes })
    },
  })
}

export function useDeployAssign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DeployAssignRequest) => deployAssign(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.nodes })
    },
  })
}

export function useSettleHour() {
  return useMutation({
    mutationFn: (body: SettleRequest) => settleHour(body),
  })
}

export function useFileDispute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DisputeRequest) => fileDispute(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.nodes })
    },
  })
}

export function useReclaimSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ReclaimRequest) => reclaimSession(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.nodes })
    },
  })
}
