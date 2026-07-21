import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

/**
 * AUTH REPOSITORY (DAL) — only place Prisma is used for users + refresh tokens.
 * Pure persistence; no business decisions. Methods accept an optional `client`
 * so the service can run several of them in one transaction (Unit of Work).
 */
type Db = PrismaClient | Prisma.TransactionClient;

export interface CreateRefreshTokenInput {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  replacedById?: string | null;
}

export const authRepository = {
  findUserByEmail(email: string, client: Db = prisma) {
    return client.user.findUnique({ where: { email } });
  },

  findUserById(id: string, client: Db = prisma) {
    return client.user.findUnique({ where: { id } });
  },

  createRefreshToken(input: CreateRefreshTokenInput, client: Db = prisma) {
    return client.refreshToken.create({
      data: {
        tokenHash: input.tokenHash,
        userId: input.userId,
        expiresAt: input.expiresAt,
        replacedById: input.replacedById ?? null,
      },
    });
  },

  findRefreshTokenByHash(tokenHash: string, client: Db = prisma) {
    return client.refreshToken.findUnique({ where: { tokenHash } });
  },

  /** Mark one token revoked, optionally recording which token replaced it. */
  revokeRefreshToken(id: string, replacedById: string | null, client: Db = prisma) {
    return client.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedById },
    });
  },

  /**
   * Revoke EVERY still-active refresh token for a user. Used on reuse detection
   * (nuke the whole session family) and on "logout everywhere". Bulk update →
   * returns a count, not rows.
   */
  revokeAllForUser(userId: string, client: Db = prisma) {
    return client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
