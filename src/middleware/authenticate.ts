import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../lib/errors.js";
import { tokenService } from "../modules/auth/token.service.js";

/**
 * authenticate — the real identity gate (replaces the temporary tmar).
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

  //why there's a try/catch at all
  // jwt.verify(token, secret) doesn't return an error — it throws when a token is bad. So you wrap it.
  try {
    const { sub, role, ver } = tokenService.verifyAccessToken(token);
    // Stateless: identity + coarse role + version come straight from the token.
    // The ver freshness check happens in `authorize` (cached), keeping this path
    // DB-free. (roles come in §3, decided embed-coarse + resolve-live.)
    req.user = { id: sub, role, ver };
    next();

    //The catch block's job: figure out why verification failed and respond appropriately.
  } catch (err) {
    // Distinguish expired (client should refresh) from otherwise invalid.
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("access token expired");
    }
    throw new UnauthorizedError("invalid access token");
  }
}

/*
jsonwebtoken throws different error classes depending on what went wrong:

jwt.TokenExpiredError — the signature was valid, but the token's exp time has passed. The token was genuine; it just aged out.
jwt.JsonWebTokenError (and subclasses) — the token is malformed or the signature doesn't match (garbage, tampered, signed with the wrong secret). This one is suspicious — it can mean forgery.
--------------------------------------------
Order matters: you check the specific case (TokenExpiredError) before the general one. TokenExpiredError actually extends JsonWebTokenError, so if you checked the general one first, expired tokens would match it and you'd lose the distinction.
--------------------------------------------
Why distinguish them — the practical payoff
Both return 401, so why bother? Because the client should react differently:

"expired" → this is normal and expected. The client should silently call /auth/refresh, get a new access token, and retry — the user never notices. Expiry happens every 15 minutes by design.
"invalid" → this is abnormal. A malformed/tampered token means something's wrong (a bug, a forged token, a corrupted store). The client should not try to refresh — it should send the user back to login (or flag it).
*/
