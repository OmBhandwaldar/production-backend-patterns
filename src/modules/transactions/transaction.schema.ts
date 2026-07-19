import { z } from "zod";

/**
 * Request-validation schema. Validation happens at the CONTROLLER boundary so
 * malformed input is rejected before touching business logic or the DB.
 *
 * amount is money in MINOR units (cents), typed as bigint. We accept a JSON
 * number or numeric string and coerce, then assert it's a positive integer.
 */
export const createTransactionSchema = z.object({
  amount: z
    .union([z.number(), z.string()])
    .transform((v) => BigInt(v))
    .refine((v) => v > 0n, "amount must be positive"),
  currency: z.string().length(3).toUpperCase().default("USD"),
  reference: z.string().max(140).optional(),
});

export type CreateTransactionDTO = z.infer<typeof createTransactionSchema>;
