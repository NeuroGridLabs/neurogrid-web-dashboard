/**
 * API client layer — typed fetch wrappers for all backend routes.
 * JWT is sent automatically via httpOnly cookie (set by /api/auth/connect-wallet).
 */

import type { EscrowBreakdown } from "@/lib/types/escrow"
import type { TreasuryData } from "@/lib/treasury-api"

/* ── Shared helpers ─────────────────────────────────────── */

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = "ApiError"
  }
}

/** Read CSRF token from cookie (set by connect-wallet, readable by JS) */
function getCsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined
  const match = document.cookie.match(/(?:^|;\s*)neurogrid_csrf=([^;]+)/)
  return match?.[1]
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...init?.headers as Record<string, string>,
  }

  // Auto-attach CSRF token on write requests
  if (init?.method && init.method !== "GET") {
    const csrf = getCsrfToken()
    if (csrf) headers["x-csrf-token"] = csrf
  }

  const res = await fetch(url, { ...init, headers })
  const body = await res.json()
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed: ${res.status}`)
  }
  return body as T
}

/* ── Nodes ──────────────────────────────────────────────── */

export interface NodeApiResponse {
  nodes: Array<{
    id: string
    name: string
    gpus: string
    vram: string
    status: string
    utilization: number
    bandwidth: string
    latencyMs: number
    isGenesis?: boolean
    isFoundationSeed?: boolean
    rentedBy: string | null
    minerWalletAddress: string
    priceInUSDT: number
    pricePerHour: string
  }>
}

export function fetchNodes(): Promise<NodeApiResponse> {
  return jsonFetch<NodeApiResponse>("/api/nodes")
}

/* ── Miners ─────────────────────────────────────────────── */

export interface MinerRegisterRequest {
  walletAddress: string
  gpuModel: string
  vram: string
  pricePerHour?: number
  bandwidth?: string
  gateway?: string
}

export interface MinerRegisterResponse {
  nodeId: string
  status: string
  message: string
}

export function registerMiner(body: MinerRegisterRequest): Promise<MinerRegisterResponse> {
  return jsonFetch<MinerRegisterResponse>("/api/miner/register", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/* ── Deploy ─────────────────────────────────────────────── */

export function fetchEscrowBreakdown(expectedHours: number, hourlyPriceUsd: number): Promise<EscrowBreakdown> {
  const params = new URLSearchParams({
    expected_hours: String(expectedHours),
    hourly_price_usd: String(hourlyPriceUsd),
  })
  return jsonFetch<EscrowBreakdown>(`/api/deploy/escrow-breakdown?${params}`)
}

export interface DeployAssignRequest {
  nodeId: string
  renterWalletAddress: string
  transactionSignature?: string
  expected_hours?: number
  hourly_price_usd?: number
}

export interface DeployAssignResponse {
  session_id?: string
  gateway: string
  port: number
  session_key: string
  escrow_breakdown?: EscrowBreakdown
  expected_hours?: number
  expires_at?: string
  status?: string
}

export function deployAssign(body: DeployAssignRequest): Promise<DeployAssignResponse> {
  return jsonFetch<DeployAssignResponse>("/api/deploy/assign", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/* ── Rentals ────────────────────────────────────────────── */

export interface SettleRequest {
  session_id: string
  node_id: string
  hourly_price_usd: number
  miner_wallet: string
  current_buffer_usd?: number
  opt_in_buffer_routing?: boolean
  session_started_at: string
}

export interface SettleResponse {
  session_id: string
  hour_index: number
  unlock_to_miner_usd: number
  to_free_balance_usd: number
  to_security_buffer_usd: number
  buffer_cap_usd: number
  hours_settled: number
  hours_remaining: number
}

export function settleHour(body: SettleRequest): Promise<SettleResponse> {
  return jsonFetch<SettleResponse>("/api/rental/settle", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export interface DisputeRequest {
  session_id: string
}

export interface DisputeResponse {
  session_id: string
  hours_used: number
  refund_tenant_usd: number
  slash_miner_usd: number
  new_phase: string
}

export function fileDispute(body: DisputeRequest): Promise<DisputeResponse> {
  return jsonFetch<DisputeResponse>("/api/rental/dispute", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export interface ReclaimRequest {
  session_id: string
}

export interface ReclaimResponse {
  session_id: string
  new_phase: string
  message: string
}

export function reclaimSession(body: ReclaimRequest): Promise<ReclaimResponse> {
  return jsonFetch<ReclaimResponse>("/api/rental/reclaim", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/* ── Treasury ───────────────────────────────────────────── */

export function fetchTreasury(refresh = false): Promise<TreasuryData> {
  const params = refresh ? "?refresh=1" : ""
  return jsonFetch<TreasuryData>(`/api/treasury${params}`)
}

/* ── Force Release (new Sprint 3 API) ───────────────────── */

export interface ForceReleaseRequest {
  session_id: string
}

export interface ForceReleaseResponse {
  session_id: string
  new_phase: string
  message: string
}

export function forceRelease(body: ForceReleaseRequest): Promise<ForceReleaseResponse> {
  return jsonFetch<ForceReleaseResponse>("/api/rental/force-release", {
    method: "POST",
    body: JSON.stringify(body),
  })
}
