import { z } from "zod"
import { walletAddressSchema, hourlyPriceSchema } from "./common"

/**
 * Validation schemas for miner-related API routes.
 */

/** POST /api/miner/register body */
export const minerRegisterBodySchema = z.object({
  walletAddress: walletAddressSchema,
  pricePerHour: hourlyPriceSchema.default(0.59),
  bandwidth: z.string().max(50).optional(),
  gpuModel: z.string().min(1, "GPU model required").max(100),
  vram: z.string().min(1, "VRAM required").max(20),
  gateway: z.string().url("Invalid gateway URL").optional(),
  /** Client hint only — server performs its own tunnel verification via HTTP ping. */
  tunnelVerified: z.boolean().optional(),
})

export type MinerRegisterBody = z.infer<typeof minerRegisterBodySchema>
