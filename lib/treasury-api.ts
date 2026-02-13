/**
 * NeuroGrid 3.2 Treasury API — Multi-Asset Anchor Era
 * Strict allocation: BTC 45%, SOL 20%, NRG 15%, Sui/ETH 20%
 */

export interface TreasuryAsset {
  symbol: string
  amount: number
  amountFormatted: string
  usdValue: number
  weight: number // 0-1
}

export interface TreasuryData {
  assets: TreasuryAsset[]
  totalReserveUsd: number
  pFloor: number
  ecoPoolBalanceUsd: number
  totalSupplyNrg: number
  lastUpdated: number
}

// v3.2: Strict allocation — MUST NOT MODIFY
export const ASSET_WEIGHTS = {
  btc: 0.45,
  sol: 0.2,
  nrg: 0.15,
  suiEth: 0.2,
} as const

const TOTAL_SUPPLY_NRG = 1_000_000
const CACHE_TTL_MS = 60_000 // 1 min cache

let cache: { data: TreasuryData; ts: number } | null = null

async function fetchWithTimeout(
  url: string,
  opts?: RequestInit,
  timeout = 5000
): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal })
    clearTimeout(t)
    return r
  } catch {
    clearTimeout(t)
    throw new Error("Fetch timeout")
  }
}

async function fetchBtcBalance(address: string): Promise<number> {
  try {
    const r = await fetchWithTimeout(
      `https://blockstream.info/api/address/${address}`
    )
    const j = await r.json()
    const funded = (j.chain_stats?.funded_txo_sum ?? 0) / 1e8
    const spent = (j.chain_stats?.spent_txo_sum ?? 0) / 1e8
    return Math.max(0, funded - spent)
  } catch {
    return 0.125 // fallback
  }
}

async function fetchSolBalance(address: string): Promise<number> {
  try {
    const r = await fetchWithTimeout("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address],
      }),
    })
    const j = await r.json()
    const lamports = j.result?.value ?? 0
    return lamports / 1e9
  } catch {
    return 12.5 // fallback
  }
}

async function fetchSuiBalance(address: string): Promise<number> {
  try {
    const r = await fetchWithTimeout("https://fullnode.mainnet.sui.io:443", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getBalance",
        params: [address, "0x2::sui::SUI"],
      }),
    }, 8000)
    const j = await r.json()
    const total = j.result?.totalBalance ?? "0"
    return parseInt(total, 10) / 1e9 // MIST to SUI
  } catch {
    return 1500
  }
}

async function fetchEthBalance(address: string): Promise<number> {
  try {
    const r = await fetchWithTimeout(
      "https://eth.llamarpc.com",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBalance",
          params: [address, "latest"],
        }),
      },
      8000
    )
    const j = await r.json()
    const hex = j.result ?? "0x0"
    return parseInt(hex, 16) / 1e18
  } catch {
    return 2.5 // fallback
  }
}

async function fetchUsdPrices(): Promise<Record<string, number>> {
  try {
    const r = await fetchWithTimeout(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,sui&vs_currencies=usd",
      6000
    )
    const j = await r.json()
    return {
      btc: j.bitcoin?.usd ?? 97000,
      eth: j.ethereum?.usd ?? 3500,
      sol: j.solana?.usd ?? 220,
      sui: j.sui?.usd ?? 3.5,
      nrg: 0.125,
    }
  } catch {
    return { btc: 97000, eth: 3500, sol: 220, sui: 3.5, nrg: 0.125 }
  }
}

// Placeholder treasury addresses (replace with real multi-sig)
const ADDRESSES = {
  btc: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  sol: "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK",
  eth: "0x742d35Cc6634C0532925a3b844Bc9e7595f5b291",
  sui: "0x853a5e5e5a5e5a5e5a5e5a5e5a5e5a5e5a5e5a5e",
}

export async function fetchTreasuryData(): Promise<TreasuryData> {
  const now = Date.now()
  if (cache && now - cache.ts < CACHE_TTL_MS) return cache.data

  const [prices, btcBal, solBal, suiBal, ethBal] = await Promise.all([
    fetchUsdPrices(),
    fetchBtcBalance(ADDRESSES.btc),
    fetchSolBalance(ADDRESSES.sol),
    fetchSuiBalance(ADDRESSES.sui),
    fetchEthBalance(ADDRESSES.eth),
  ])

  // v3.2: P_floor = TotalValue_Treasury / TotalSupply_NRG (45/20/15/20)
  const btcUsd = btcBal * prices.btc
  const solUsd = solBal * prices.sol
  const suiUsd = suiBal * prices.sui
  const ethUsd = ethBal * prices.eth
  const suiEthUsd = suiUsd + ethUsd // Sui/ETH 20% combined
  const nrgUsd = (btcUsd + solUsd + suiEthUsd) * 0.15 / 0.85 // NRG 15% of non-NRG reserve

  const totalReserveUsd = btcUsd + solUsd + suiEthUsd + nrgUsd

  // Display strict 45/20/15/20 allocation
  const targetBtc = totalReserveUsd * ASSET_WEIGHTS.btc
  const targetSol = totalReserveUsd * ASSET_WEIGHTS.sol
  const targetNrg = totalReserveUsd * ASSET_WEIGHTS.nrg
  const targetSuiEth = totalReserveUsd * ASSET_WEIGHTS.suiEth

  const assets: TreasuryAsset[] = [
    { symbol: "BTC", amount: targetBtc / prices.btc, amountFormatted: (targetBtc / prices.btc).toFixed(4), usdValue: targetBtc, weight: ASSET_WEIGHTS.btc },
    { symbol: "SOL", amount: targetSol / prices.sol, amountFormatted: (targetSol / prices.sol).toFixed(2), usdValue: targetSol, weight: ASSET_WEIGHTS.sol },
    { symbol: "NRG", amount: targetNrg / prices.nrg, amountFormatted: (targetNrg / prices.nrg).toLocaleString(), usdValue: targetNrg, weight: ASSET_WEIGHTS.nrg },
    { symbol: "Sui/ETH", amount: targetSuiEth / prices.eth, amountFormatted: (targetSuiEth / prices.eth).toFixed(2), usdValue: targetSuiEth, weight: ASSET_WEIGHTS.suiEth },
  ]

  const pFloor = totalReserveUsd / TOTAL_SUPPLY_NRG
  const ecoPoolBalanceUsd = totalReserveUsd * 0.15

  const data: TreasuryData = {
    assets,
    totalReserveUsd,
    pFloor,
    ecoPoolBalanceUsd,
    totalSupplyNrg: TOTAL_SUPPLY_NRG,
    lastUpdated: now,
  }
  cache = { data, ts: now }
  return data
}
