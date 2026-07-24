import { logger } from "../../lib/logger.js";
import { redis } from "../../lib/redis.js";
import { rbacRepository } from "./rbac.repository.js";

/**
 * RBAC SERVICE — resolves a role's permissions and a user's token version, with
 * a Redis cache in front of the DB.
 *
 * Caching policy:
 *  - Short TTL → staleness is bounded even if we forget to invalidate.
 *  - { fresh: true } bypasses the cache for SENSITIVE actions (authoritative
 *    read straight from the DB) — the A+B "verify sensitive live" carve-out.
 *  - Cache is an OPTIMIZATION, not the source of truth: any Redis error falls
 *    back to the DB (fail-open on the cache) so a Redis blip can't break authz.
 */

const PERMS_TTL_SECONDS = 60;
const VER_TTL_SECONDS = 60;
const permsKey = (role: string) => `rbac:perms:${role}`;
const verKey = (userId: string) => `rbac:ver:${userId}`;

interface ResolveOpts {
  fresh?: boolean;
}

export const rbacService = {
  async getPermissionsForRole(role: string, opts: ResolveOpts = {}): Promise<string[]> {
    if (!opts.fresh) {
      try {
        const cached = await redis.get(permsKey(role));
        if (cached) return JSON.parse(cached) as string[];
      } catch (err) {
        logger.warn({ err, role }, "rbac cache read failed; falling back to DB");
      }
    }

    const perms = await rbacRepository.findPermissionsForRole(role);

    // Best-effort cache write (ignore failures).
    try {
      await redis.set(permsKey(role), JSON.stringify(perms), "EX", PERMS_TTL_SECONDS);
    } catch {
      /* cache write is best-effort */
    }
    return perms;
  },

  async getUserTokenVersion(userId: string, opts: ResolveOpts = {}): Promise<number | null> {
    if (!opts.fresh) {
      try {
        const cached = await redis.get(verKey(userId));
        if (cached !== null) return Number(cached);
      } catch (err) {
        logger.warn({ err, userId }, "rbac ver cache read failed; falling back to DB");
      }
    }

    const ver = await rbacRepository.findUserTokenVersion(userId);
    if (ver !== null) {
      try {
        await redis.set(verKey(userId), String(ver), "EX", VER_TTL_SECONDS);
      } catch {
        /* best-effort */
      }
    }
    return ver;
  },

  /** Does this role include the given permission? */
  async roleHasPermission(role: string, permission: string, opts: ResolveOpts = {}): Promise<boolean> {
    const perms = await this.getPermissionsForRole(role, opts);
    return perms.includes(permission);
  },

  /** Bust caches when the underlying data changes. */
  async invalidateRole(role: string): Promise<void> {
    await redis.del(permsKey(role)).catch(() => undefined);
  },
  async invalidateUserVersion(userId: string): Promise<void> {
    await redis.del(verKey(userId)).catch(() => undefined);
  },
};
