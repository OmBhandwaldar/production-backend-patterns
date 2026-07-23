import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Deterministic, idempotent seed (upsert-based).
 *
 * Order matters due to FK dependencies:
 *   1. Permissions  →  2. Roles (link permissions)  →  3. Users (assign a role)
 *
 * §3 RBAC policy:
 *   admin   → all permissions
 *   maker   → create + read                    (can propose, cannot approve)
 *   checker → read + approve/reject/execute     (can approve, cannot propose)
 *   Alice = maker, Bob = checker → sets up §4 maker-checker cleanly.
 */

const PERMISSIONS = [
  "transaction:create",
  "transaction:read",
  "transaction:approve",
  "transaction:reject",
  "transaction:execute",
];

// Object mapping role name → its permission list.
const ROLES: Record<string, string[]> = {
  admin: PERMISSIONS,
  maker: ["transaction:create", "transaction:read"],
  checker: ["transaction:read", "transaction:approve", "transaction:reject", "transaction:execute"],
};

async function main() {
  // 1. Permissions — independent of each other, so run all upserts CONCURRENTLY:
  //    .map builds an array of Promises (all started at once); Promise.all waits
  //    for every one to finish (and fails fast if any rejects). upsert = create
  //    if missing, do nothing if present → idempotent.
  await Promise.all(
    PERMISSIONS.map((name) =>
      prisma.permission.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

  // 2. Roles. Object.entries(ROLES) → [ ["admin", [...]], ["maker", [...]], ... ];
  //    destructured into [roleName, perms]. perms.map(name => ({ name })) shapes
  //    the list so Prisma can identify existing Permission rows by unique name.
  //    On update we use `set` (replace the role's permissions with EXACTLY this
  //    list) — that's what makes a re-seed idempotent (converges to desired state,
  //    unlike `connect` which only adds / can error on duplicates).
  for (const [roleName, perms] of Object.entries(ROLES)) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: { permissions: { set: perms.map((name) => ({ name })) } },
      create: { name: roleName, permissions: { connect: perms.map((name) => ({ name })) } },
    });
  }

  // 3. Users, each assigned a role. findUniqueOrThrow (not findUnique) because
  //    these roles MUST exist now (we just made them) — crash loudly if not, and
  //    it narrows the type to Role (no null check needed for .id).
  const passwordHash = await bcrypt.hash("password123", 12);
  const maker = await prisma.role.findUniqueOrThrow({ where: { name: "maker" } });
  const checker = await prisma.role.findUniqueOrThrow({ where: { name: "checker" } });

  // update.roleId re-assigns on re-seed so the seed always lands in the intended
  // state; create sets it for a fresh user.
  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: { roleId: maker.id },
    create: { email: "alice@example.com", passwordHash, roleId: maker.id },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: { roleId: checker.id },
    create: { email: "bob@example.com", passwordHash, roleId: checker.id },
  });

  // eslint-disable-next-line no-console
  console.log("Seeded:", {
    alice: { id: alice.id, role: "maker" },
    bob: { id: bob.id, role: "checker" },
    roles: Object.keys(ROLES),
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
