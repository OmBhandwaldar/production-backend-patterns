import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { transactionController } from "./transaction.controller.js";

/**
 * ROUTE LAYER — wiring only. URL + method → (future middleware) → controller.
 * In §2/§3 auth + RBAC middleware slot in here, e.g.:
 *   router.post("/", authenticate, authorize("tx:create"), asyncHandler(...))
 * so a route's full security posture is readable at a glance.
 */
export const transactionRouter = Router();

transactionRouter.post("/", asyncHandler(transactionController.create));
transactionRouter.get("/", asyncHandler(transactionController.listMine));
transactionRouter.get("/:id", asyncHandler(transactionController.getById));
