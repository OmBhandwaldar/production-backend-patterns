import { prisma } from "../../lib/prisma.js";

/**
 * RBAC REPOSITORY (DAL) — the only place Prisma is touched for roles/permissions.
 */
export const rbacRepository = {
  /** All permission names granted by a role (empty if the role is missing). */
  async findPermissionsForRole(roleName: string): Promise<string[]> {
    const role = await prisma.role.findUnique({
      where: { name: roleName },
      include: { permissions: { select: { name: true } } },
    });
    return role ? role.permissions.map((p) => p.name) : [];
  },

  /** The user's current tokenVersion (for the instant-revocation check). */
  async findUserTokenVersion(userId: string): Promise<number | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });
    return user ? user.tokenVersion : null;
  },
};
