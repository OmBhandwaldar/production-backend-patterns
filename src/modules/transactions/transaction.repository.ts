import { prisma } from "../../lib/prisma.js";

/**
 * REPOSITORY LAYER (a.k.a. DAL — Data Access Layer).
 * The only place Prisma is used for transactions. Methods express intent, not
 * SQL. No business rules live here — pure persistence.
 *
 * Note we accept a plain input object, not an HTTP body — the repository has no
 * idea HTTP exists. That's the boundary.
 */
export interface CreateTransactionInput {
  amount: bigint;
  currency: string;
  reference?: string | null;
  makerId: string;
}

export const transactionRepository = {
  create(input: CreateTransactionInput) {
    return prisma.transaction.create({
      data: {
        amount: input.amount,
        currency: input.currency,
        reference: input.reference ?? null,
        makerId: input.makerId,
        status: "DRAFT",
      },
    });
  },

  findById(id: string) {
    return prisma.transaction.findUnique({ where: { id } });
  },

  listByMaker(makerId: string) {
    return prisma.transaction.findMany({
      where: { makerId },
      orderBy: { createdAt: "desc" },
    });
  },
};
