import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { transactionRepository } from "./transaction.repository.js";

/**
 * SERVICE LAYER — business rules & orchestration.
 * HTTP-agnostic: no req/res/status. It throws typed domain errors; the error
 * middleware maps them to HTTP later.
 *
 * The maker-checker workflow (approve/reject/execute) lands here in §4 — this
 * is exactly the layer that will own the state-machine transitions.
 */
export interface CreateTransactionCommand {
  amount: bigint;
  currency: string;
  reference?: string | null;
  makerId: string;
}

export const transactionService = {
  async create(cmd: CreateTransactionCommand) {
    // Business invariant beyond what the schema enforces: money must be > 0.
    if (cmd.amount <= 0n) {
      throw new ValidationError("amount must be a positive integer (minor units)");
    }
    // (Future §3/§4: check the maker has permission, enforce daily limits, etc.)
    return transactionRepository.create(cmd);
  },

  async getById(id: string) {
    const tx = await transactionRepository.findById(id);
    if (!tx) throw new NotFoundError(`transaction ${id} not found`);
    return tx;
  },

  async listByMaker(makerId: string) {
    return transactionRepository.listByMaker(makerId);
  },
};
