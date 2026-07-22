import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { authController } from "./auth.controller.js";

/**
 * AUTH ROUTES — PUBLIC (no authenticate middleware). You must be able to log in
 * and refresh BEFORE you hold a valid access token. These are the endpoints
 * where unauthenticated access is correct by design.
 */
export const authRouter = Router();

authRouter.post("/login", asyncHandler(authController.login));
authRouter.post("/refresh", asyncHandler(authController.refresh));
authRouter.post("/logout", asyncHandler(authController.logout));
