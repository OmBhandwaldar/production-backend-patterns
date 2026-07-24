import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authorize } from "../../middleware/authorize.js";
import { transactionController } from "./transaction.controller.js";

/**
 * ROUTE LAYER — wiring only. `authenticate` runs at the mount (app.ts); each
 * route then declares the PERMISSION it requires via `authorize`. A route's
 * full security posture is readable in one line.
 *
 * maker has create+read, checker has read+approve/reject/execute → with the seed,
 * Alice (maker) can create, Bob (checker) cannot; both can read.
 */
export const transactionRouter = Router();

transactionRouter.post(
  "/",
  authorize("transaction:create"),
  asyncHandler(transactionController.create),
);
transactionRouter.get(
  "/",
  authorize("transaction:read"),
  asyncHandler(transactionController.listMine),
);
transactionRouter.get(
  "/:id",
  authorize("transaction:read"),
  asyncHandler(transactionController.getById),
);
