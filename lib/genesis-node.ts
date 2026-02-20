import type { Node } from "@/lib/types/node"
import { ADMIN_WALLET_ADDRESS } from "@/lib/solana-constants"

/** Alpha-01: Official Foundation Seed Node. RTX 4090, 24GB VRAM, 31GB RAM, 6 vCPUs (specs locked). */
export const FOUNDATION_GENESIS_NODE_ID = "alpha-01"

/** Human-readable description for Alpha-01 in UI. */
export const ALPHA01_DESCRIPTION =
  "Officially managed by NeuroGrid Foundation. 100% compute revenue flows to Treasury for $NRG buyback."

/**
 * Genesis verification: true when the node owner is the Admin Wallet (Alpha-01 Genesis provider).
 */
export function isGenesisNode(ownerAddress: string | null | undefined): boolean {
  return !!ownerAddress && ownerAddress === ADMIN_WALLET_ADDRESS
}

/**
 * Returns the single persistent Alpha-01 Foundation Seed Node for Epoch 0.
 * Owned by ADMIN_WALLET_ADDRESS. Used when /api/nodes has no backend or returns empty list.
 */
export function getFoundationGenesisNode(): Node {
  return {
    id: FOUNDATION_GENESIS_NODE_ID,
    name: "Alpha-01",
    gpus: "1x RTX 4090",
    vram: "24GB",
    status: "STANDBY",
    utilization: 0,
    bandwidth: "1 Gbps",
    latencyMs: 0,
    isGenesis: true,
    isFoundationSeed: true,
    rentedBy: null,
    minerWalletAddress: ADMIN_WALLET_ADDRESS,
    priceInUSDT: 0.59,
    pricePerHour: "$0.59/hr",
  }
}
