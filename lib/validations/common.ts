import { z } from "zod"

/**
 * Common validation schemas shared across API routes.
 */

/** Solana wallet address — Base58 string, 32-44 chars */
export const walletAddressSchema = z
  .string()
  .min(32, "Wallet address too short")
  .max(44, "Wallet address too long")
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Invalid Base58 characters")

/** Positive USD amount with USDT-level precision (6 decimals) */
export const usdAmountSchema = z
  .number()
  .positive("Amount must be positive")
  .max(1_000_000, "Amount exceeds maximum")

/** Hourly price — positive, reasonable range */
export const hourlyPriceSchema = z
  .number()
  .positive("Price must be positive")
  .max(10_000, "Hourly price exceeds maximum ($10,000/hr)")

/** Expected rental hours — integer, 1-8760 (1 year max) */
export const expectedHoursSchema = z
  .number()
  .int("Hours must be a whole number")
  .min(1, "Minimum 1 hour")
  .max(8760, "Maximum 8,760 hours (1 year)")

/** Node ID — alphanumeric with hyphens */
export const nodeIdSchema = z
  .string()
  .min(1, "Node ID required")
  .max(64, "Node ID too long")
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid node ID format")

/** Solana transaction signature — Base58, 87-88 chars */
export const txSignatureSchema = z
  .string()
  .min(80, "Transaction signature too short")
  .max(100, "Transaction signature too long")

/** Rental phase enum */
export const rentalPhaseSchema = z.enum(["ACTIVE", "RECLAIMING", "DISPUTED", "COMPLETED"])

/** Node lifecycle status enum */
export const lifecycleStatusSchema = z.enum(["IDLE", "LOCKED", "OFFLINE_VIOLATION", "VIOLATED"])
