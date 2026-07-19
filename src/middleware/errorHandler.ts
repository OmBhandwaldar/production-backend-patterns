import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

/**
 * Central error handler — the ONLY place errors become HTTP responses.
 * Express recognizes an error middleware by its 4-arg signature.
 *
 * Mapping strategy:
 *   - ZodError        → 400 with field-level details (bad client input).
 *   - AppError        → its own status/code (domain-defined).
 *   - anything else   → 500, opaque message (never leak internals/stack).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid request", details: err.flatten() },
    });
  }

  if (err instanceof AppError) {
    // 4xx are expected/client errors → log at warn. 5xx would be a bug.
    logger.warn({ code: err.code, status: err.status }, err.message);
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Unknown error = a bug or unexpected failure. Log the full thing server-side,
  // return a generic message client-side.
  logger.error({ err }, "unhandled error");
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
}
