import type { Request, Response } from "express";
import type { Transaction } from "@prisma/client";
import { UnauthorizedError } from "../../lib/errors.js";
import { createTransactionSchema } from "./transaction.schema.js";
import { transactionService } from "./transaction.service.js";

/**
 * CONTROLLER LAYER — the ONLY transactions layer aware of HTTP.
 * Responsibilities: parse+validate input, resolve the caller, call the service,
 * shape the response. No business rules, no DB.
 */

// BigInt is not JSON-serializable, so we shape rows into a wire-safe object.
// This "presenter"/DTO mapping is an HTTP concern → it belongs in the controller.
function toResponse(tx: Transaction) {
  return {
    id: tx.id,
    amount: tx.amount.toString(), // BigInt → string
    currency: tx.currency,
    reference: tx.reference,
    status: tx.status,
    makerId: tx.makerId,
    createdAt: tx.createdAt,
  };
}

// TEMPORARY identity source. In §2 this becomes req.user.id from the verified
// JWT. Identity must come from the auth layer, NEVER the request body.
function currentUserId(req: Request): string {
  const id = req.header("x-demo-user-id");
  if (!id) throw new UnauthorizedError("missing x-demo-user-id (temporary until §2 JWT auth)");
  return id;
}

export const transactionController = {
  async create(req: Request, res: Response) {
    const dto = createTransactionSchema.parse(req.body); // throws ZodError → 400
    const makerId = currentUserId(req);

    const tx = await transactionService.create({
      amount: dto.amount,
      currency: dto.currency,
      reference: dto.reference ?? null,
      makerId,
    });

    res.status(201).json(toResponse(tx)); // 201 Created for a new resource
  },

  async getById(req: Request, res: Response) {
    const tx = await transactionService.getById(req.params.id);
    res.json(toResponse(tx));
  },

  async listMine(req: Request, res: Response) {
    const makerId = currentUserId(req);
    const rows = await transactionService.listByMaker(makerId);
    res.json(rows.map(toResponse));
  },
};
