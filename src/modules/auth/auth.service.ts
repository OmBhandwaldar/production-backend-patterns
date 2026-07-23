import bcrypt from "bcrypt";
import { UnauthorizedError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { authRepository } from "./auth.repository.js";
import { tokenService } from "./token.service.js";

/**
 * AUTH SERVICE — business logic for login / refresh / logout.
 * HTTP-agnostic (throws typed errors). Owns the refresh-token rotation and
 * reuse-detection rules; the repository just persists what it's told.
 */

export interface TokenPair {
  accessToken: string;
  refreshToken: string; // RAW value — returned to the client exactly once
}

export const authService = {
  /**
   * Verify credentials and issue the first token pair (a NEW chain).
   * On any failure we throw the SAME error to avoid user enumeration.
   */
  async login(email: string, password: string): Promise<TokenPair & { userId: string }> {
    const user = await authRepository.findUserByEmail(email);
    // Generic message whether the user is missing OR the password is wrong.
    const invalid = new UnauthorizedError("invalid credentials");
    if (!user) throw invalid;

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw invalid;

    // First token of a fresh chain: expiry = now + refresh TTL (the chain budget).
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL * 1000);
    const { raw, hash } = tokenService.generateRefreshToken();
    await authRepository.createRefreshToken({ tokenHash: hash, userId: user.id, expiresAt });

    return {
      // Embed coarse role + current tokenVersion (the "A" of A+B).
      accessToken: tokenService.signAccessToken({
        sub: user.id,
        role: user.role?.name ?? null,
        ver: user.tokenVersion,
      }),
      refreshToken: raw,
      userId: user.id,
    };
  },

  /**
   * Exchange a refresh token for a new pair (ROTATION), with reuse detection.
   */
  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const hash = tokenService.hashRefreshToken(rawRefreshToken);
    const existing = await authRepository.findRefreshTokenByHash(hash);

    // Unknown token → reject (could be forged or already deleted).
    if (!existing) throw new UnauthorizedError("invalid refresh token");

    // REUSE DETECTION: a revoked (single-use) token presented again = theft.
    // Nuke the whole family so attacker AND victim must re-authenticate.
    if (existing.revokedAt) {
      logger.warn({ userId: existing.userId, tokenId: existing.id }, "refresh token reuse detected");
      await authRepository.revokeAllForUser(existing.userId);
      throw new UnauthorizedError("refresh token reuse detected");
    }

    // Expired chain → reject.
    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError("refresh token expired");
    }

    // Re-read the user so the NEW access token reflects the CURRENT role +
    // tokenVersion (a role change since login is picked up on refresh).
    const user = await authRepository.findUserById(existing.userId);
    if (!user) throw new UnauthorizedError("user no longer exists");

    // ROTATE atomically: create the successor (inheriting the chain's expiry),
    // then revoke the old one pointing at the successor. All-or-nothing.
    const { raw, hash: newHash } = tokenService.generateRefreshToken();
    await prisma.$transaction(async (tx) => {
      const created = await authRepository.createRefreshToken(
        { tokenHash: newHash, userId: existing.userId, expiresAt: existing.expiresAt },
        tx,
      );
      await authRepository.revokeRefreshToken(existing.id, created.id, tx);
    });

    return {
      accessToken: tokenService.signAccessToken({
        sub: user.id,
        role: user.role?.name ?? null,
        ver: user.tokenVersion,
      }),
      refreshToken: raw,
    };
  },

  /** Revoke a single refresh token (this session). Idempotent-ish. */
  async logout(rawRefreshToken: string): Promise<void> {
    const hash = tokenService.hashRefreshToken(rawRefreshToken);
    const existing = await authRepository.findRefreshTokenByHash(hash);
    if (existing && !existing.revokedAt) {
      await authRepository.revokeRefreshToken(existing.id, null);
    }
    // No error if already gone/revoked — logout should be safe to call twice.
  },
};
