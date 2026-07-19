// Load .env into process.env in dev/local. In production the platform injects
// env directly and no .env file exists, so this simply no-ops.
import "dotenv/config";
import { z } from "zod";

/**
 * WHY validate env at boot:
 * A missing/malformed env var should crash the process immediately on startup
 * ("fail fast"), not surface as a confusing runtime error on request #4000.
 * We parse ONCE here and export a typed, frozen config object. Nothing else in
 * the app reads process.env directly — that keeps config access centralized and
 * type-safe.
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(1209600),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
