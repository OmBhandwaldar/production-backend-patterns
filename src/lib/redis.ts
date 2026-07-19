import Redis from "ioredis";
import { env } from "../config/env.js";

/**
 * Single shared Redis connection (ioredis multiplexes commands over one socket).
 * Used later for idempotency keys (SETNX) and available for rate limiting /
 * refresh-token denylists.
 *
 * maxRetriesPerRequest: 3 — fail a command after a few retries instead of
 * buffering forever, so a Redis outage surfaces as a fast error, not a hang.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

// Redis is an AUXILIARY store here, not the source of truth. A transient blip
// must NOT crash the process — log it and let the specific command reject.
redis.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("Redis error:", err.message);
});
