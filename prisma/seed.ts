import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Deterministic seed. Two users so §4's maker-checker has a maker (Alice) and a
 * distinct checker (Bob). Passwords hashed now (bcrypt) so §2 login works
 * without reseeding. `upsert` makes the seed idempotent — safe to re-run:
 * on a re-run it matches the existing row by unique email and updates nothing,
 * instead of `create` which would throw a P2002 unique-constraint error.
 *
 * The returned objects are full User rows including the DB-generated UUID `id`;
 * we log those ids so you can use them as the temporary `x-demo-user-id` header
 * when testing §1 (replaced by JWT-derived identity in §2).
 */
async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: { email: "alice@example.com", passwordHash },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: { email: "bob@example.com", passwordHash },
  });

  // eslint-disable-next-line no-console
  console.log("Seeded users:", { alice: alice.id, bob: bob.id });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
