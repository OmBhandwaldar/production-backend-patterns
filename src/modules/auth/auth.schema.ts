import { z } from "zod";

/** Request-validation schemas for the auth endpoints (controller boundary). */

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1), // presence only — never log or transform it
});

// Note: /auth/refresh and /auth/logout do NOT read the token from the body —
// it arrives in the httpOnly refresh cookie, so there's no body to validate.

export type LoginDTO = z.infer<typeof loginSchema>;
