import express, { type Express, type Request, type Response } from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { transactionRouter } from "./modules/transactions/transaction.routes.js";

/**
 * buildApp() constructs the Express application WITHOUT starting a listener.
 * Keeping construction separate from `listen()` means tests can import the app
 * and drive it in-memory (supertest) — no port, no race conditions.
 *
 * Middleware/route ORDER matters in Express (it's a pipeline). As we add
 * sections, the order will be:
 *   correlation-id (§7) → metrics (§8) → body parser → routes → error handler.
 */
export function buildApp(): Express {
  const app = express();

  app.use(express.json());

  // Liveness/readiness probe. Kubernetes hits this to decide if the pod is
  // healthy. Keep it cheap and dependency-light (a DB check belongs in a
  // separate /ready readiness probe, not liveness).
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // Section routers get mounted here as we build them:
  app.use("/transactions", transactionRouter); // §1
  // app.use("/auth", authRouter);             // §2

  // Error handler MUST be registered LAST — Express runs middleware in order,
  // and only an error middleware placed after all routes can catch their errors.
  app.use(errorHandler);

  return app;
}
