import { z } from "zod"
import {
  walletAddressSchema,
  hourlyPriceSchema,
  nodeIdSchema,
  usdAmountSchema,
} from "./common"

/**
 * Validation schemas for rental-related API routes.
 */

/** POST /api/rental/settle body */
export const settleBodySchema = z.object({
  session_id: z.string().uuid("Invalid session ID"),
  node_id: nodeIdSchema,
  hourly_price_usd: hourlyPriceSchema,
  miner_wallet: walletAddressSchema,
  current_buffer_usd: z
    .number()
    .min(0, "Buffer cannot be negative")
    .max(1_000_000, "Buffer exceeds maximum")
    .default(0),
  opt_in_buffer_routing: z.boolean().default(false),
  session_started_at: z.string().datetime({ message: "Invalid ISO datetime for session_started_at" }),
})

/** POST /api/rental/reclaim body */
export const reclaimBodySchema = z.object({
  session_id: z.string().uuid("Invalid session ID"),
})

/** POST /api/rental/dispute body */
export const disputeBodySchema = z.object({
  session_id: z.string().uuid("Invalid session ID"),
  /** hours_used is now validated server-side, not trusted from client.
   *  This field is kept for the initial report but the server will verify
   *  against settlement_logs before processing. */
  hours_used: z
    .number()
    .int("Hours must be a whole number")
    .min(0, "Hours used cannot be negative")
    .optional(),
})

export type SettleBody = z.infer<typeof settleBodySchema>
export type ReclaimBody = z.infer<typeof reclaimBodySchema>
export type DisputeBody = z.infer<typeof disputeBodySchema>
