import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../lib/errors.js";
import { tokenService } from "../modules/auth/token.service.js";

/**
 * authenticate — the real identity gate (replaces the temporary x-demo-user-id).
 *
 * Reads `Authorization: Bearer <token>`, verifies the access JWT's signature +
 * expiry, and attaches a SERVER-VERIFIED identity to req.user. The client cannot
 * forge this: tampering breaks the signature, expiry is enforced by verify().
 *
 * Stateless: no DB hit — identity comes straight from the trusted token. (Roles
 * come in §3, where we decide embed-in-token vs fetch-live.)
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("missing or malformed Authorization header");
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const { sub, role, ver } = tokenService.verifyAccessToken(token);
    // Stateless: identity + coarse role + version come straight from the token.
    // The ver freshness check happens in `authorize` (cached), keeping this path
    // DB-free. (roles come in §3, decided embed-coarse + resolve-live.)
    req.user = { id: sub, role, ver };
    next();
  } catch (err) {
    // Distinguish expired (client should refresh) from otherwise invalid.
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("access token expired");
    }
    throw new UnauthorizedError("invalid access token");
  }
}
