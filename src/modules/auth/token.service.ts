import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

/**
 * TOKEN SERVICE — the crypto primitives for auth. Knows HOW to mint/verify
 * tokens; knows nothing about users, login, or the DB (that's auth.service).
 *
 * Access token  = signed JWT (stateless, self-verifying).
 * Refresh token = opaque random string, stored server-side as a SHA-256 hash.
 */

export interface AccessTokenClaims {
  sub: string; // subject = the user id
  role: string | null; // §3: coarse role name for cheap checks (A of the A+B split)
  ver: number; // §3: user.tokenVersion — mismatch ⇒ token superseded (instant revoke)
}

export const tokenService = {
  /** Sign a short-lived access JWT carrying identity + coarse role + version. */
  signAccessToken(claims: AccessTokenClaims): string {
    return jwt.sign(
      { sub: claims.sub, role: claims.role, ver: claims.ver },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_TTL }, // seconds
    );
  },

  /**
   * Verify an access JWT. Throws if the signature is invalid OR it's expired
   * (jsonwebtoken checks `exp` for us). Returns the decoded claims.
   */
  verifyAccessToken(token: string): AccessTokenClaims {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    // `decoded` is string | JwtPayload; narrow to our shape.
    if (typeof decoded === "string" || !decoded.sub) {
      throw new Error("malformed access token");
    }
    return {
      sub: decoded.sub as string,
      role: (decoded.role as string | null) ?? null,
      ver: (decoded.ver as number | undefined) ?? 0,
    };
  },

  /**
   * Generate a new refresh token. Returns BOTH the raw value (given to the
   * client, once) and its hash (stored in the DB). We never store the raw value.
   */
  generateRefreshToken(): { raw: string; hash: string } {
    // 32 random bytes = 256 bits of entropy → unguessable.
    const raw = crypto.randomBytes(32).toString("hex");
    return { raw, hash: this.hashRefreshToken(raw) };
  },

  /**
   * Hash a refresh token with SHA-256 (fast). Correct here because the input is
   * HIGH-entropy random — no brute-force risk — unlike a low-entropy password,
   * which needs deliberately-slow bcrypt. Match hash cost to input entropy.
   * Deterministic (no salt) so we can look up by hash on refresh.
   */
  hashRefreshToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
  },
};
