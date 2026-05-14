import { z } from "zod"
import {
  walletAddressSchema,
  hourlyPriceSchema,
  expectedHoursSchema,
  nodeIdSchema,
  txSignatureSchema,
} from "./common"

/**
 * Validation schemas for deploy-related API routes.
 */

/** GET /api/deploy/escrow-breakdown query params */
export const escrowBreakdownQuerySchema = z.object({
  expected_hours: z.coerce
    .number()
    .int()
    .min(1, "Minimum 1 hour")
    .max(8760, "Maximum 8,760 hours")
    .default(1),
  hourly_price_usd: z.coerce
    .number()
    .positive("Price must be positive")
    .max(10_000, "Price exceeds maximum")
    .default(0.59),
})

/** POST /api/deploy/assign body */
export const deployAssignBodySchema = z.object({
  nodeId: nodeIdSchema,
  renterWalletAddress: walletAddressSchema,
  transactionSignature: txSignatureSchema.optional(),
  /** Session ID as 32-char hex (16 bytes) — must match the createEscrow IX session_id. */
  sessionIdHex: z
    .string()
    .regex(/^[0-9a-f]{32}$/i, "sessionIdHex must be 32 hex chars (16 bytes)")
    .optional(),
  expected_hours: expectedHoursSchema.default(1),
  hourly_price_usd: hourlyPriceSchema.default(0.59),
})

export type DeployAssignBody = z.infer<typeof deployAssignBodySchema>
export type EscrowBreakdownQuery = z.infer<typeof escrowBreakdownQuerySchema>
