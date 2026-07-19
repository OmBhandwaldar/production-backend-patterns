import { PrismaClient } from "@prisma/client";

/**
 * A SINGLE PrismaClient instance for the whole process.
 * Each PrismaClient owns a connection pool; creating one per request would
 * exhaust Postgres connections fast. This is the "singleton" pattern.
 *
 * The globalThis guard prevents creating a new client on every hot-reload in
 * dev (tsx watch re-imports modules), which otherwise leaks connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
