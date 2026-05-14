import { PublicKey } from "@solana/web3.js"

/** NeuroGrid Multi-sig Treasury Vault (Solana). Receives 5% protocol fee on every Deploy. */
const TREASURY_WALLET_ADDRESS_STR =
  process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "AmKdMDFTYRXUHPxcXjvJxMM1xZeAmR6rmeNj2t2cWH3h"

export const TREASURY_WALLET_ADDRESS = new PublicKey(TREASURY_WALLET_ADDRESS_STR)

/**
 * Dedicated Admin Wallet that owns and manages the Alpha-01 Genesis Node.
 * Any node with this minerWalletAddress is displayed as "[FOUNDATION GENESIS]".
 * When this wallet connects on the Miner page, "Genesis Command Center" view is shown.
 */
export const ADMIN_WALLET_ADDRESS =
  process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "8KRqwem4WFs1JtTK7oQSDvEKqB8e1DkqygSLbb9StBva"

/**
 * USDT mint used by the protocol — 95/5 SPL token split (miner 95%, treasury 5%).
 * Env-driven so devnet can use a test mint; falls back to mainnet USDT.
 */
const USDT_MINT_ADDRESS_STR =
  process.env.NEXT_PUBLIC_USDT_MINT ?? "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"

export const USDT_MINT_ADDRESS = new PublicKey(USDT_MINT_ADDRESS_STR)

/** USDT uses 6 decimals on Solana. Use Math.floor(X * 10^6) for raw amounts. */
export const USDT_DECIMALS = 6
