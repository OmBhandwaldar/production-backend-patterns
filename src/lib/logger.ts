import { pino } from "pino";
import { env } from "../config/env.js";

/**
 * Structured JSON logger.
 *
 * WHY pino over console.log:
 *  - Emits one JSON object per line → log aggregators (Datadog, Loki,
 *    CloudWatch, ELK) can index/filter on any field (userId, txId, etc.).
 *  - Extremely low overhead (logging is on the hot path of every request).
 *  - Supports `mixin` — a function whose return value is merged into EVERY log
 *    line. In Section 7 we use this to auto-attach the correlation ID pulled
 *    from AsyncLocalStorage, so we never have to pass it manually.
 *
 * In production we emit raw JSON (the log pipeline formats it). In dev we route
 * through pino-pretty for human-readable output.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  // redact secrets/tokens if they ever end up in a logged object.
  redact: {
    paths: ["req.headers.authorization", "*.password", "*.refreshToken"],
    censor: "[REDACTED]",
  },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
      : undefined,
});
