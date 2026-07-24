import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { rbacService } from "../modules/rbac/rbac.service.js";

/**
 * authorize(permission, opts?) — permission gate. Runs AFTER authenticate.
 *
 * 401 vs 403:
 *   401 Unauthorized = we don't trust WHO you are (missing/superseded token).
 *   403 Forbidden    = we know who you are; you're just not ALLOWED.
 *
 * Freshness: token.ver is compared to the user's current tokenVersion. A role
 * change bumps tokenVersion, so a MATCHING ver guarantees the token's embedded
 * role is still current — which is why the coarse role in the JWT is trustworthy.
 *
 * opts.fresh = true → bypass the cache (authoritative DB read) for SENSITIVE
 * actions (e.g. approve/execute a large transaction).
 */
export function authorize(permission: string, opts: { fresh?: boolean } = {}) {
  // async middleware → we forward errors via next(err) ourselves, because
  // Express 4 doesn't catch rejected promises from middleware (see §1 asyncHandler).
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw new UnauthorizedError("not authenticated"); // authenticate must run first

      // 1. Freshness / instant-revocation check.
      const currentVer = await rbacService.getUserTokenVersion(user.id, { fresh: opts.fresh });
      if (currentVer === null) throw new UnauthorizedError("user no longer exists");
      if (currentVer !== user.ver) {
        // tokenVersion was bumped (role change / logout-everywhere) → force re-auth.
        throw new UnauthorizedError("token superseded, please re-authenticate");
      }

      // 2. Permission check. No role ⇒ no permissions ⇒ forbidden.
      if (!user.role) throw new ForbiddenError("no role assigned");
      const allowed = await rbacService.roleHasPermission(user.role, permission, {
        fresh: opts.fresh,
      });
      if (!allowed) throw new ForbiddenError(`missing permission: ${permission}`);

      next();
    } catch (err) {
      next(err);
    }
  };
}
