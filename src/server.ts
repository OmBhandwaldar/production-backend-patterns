import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";

/**
 * Process entry point: start the HTTP listener and manage lifecycle.
 *
 * GRACEFUL SHUTDOWN is the important production concept here. When an
 * orchestrator (Kubernetes, ECS, `docker stop`) wants to stop this process it
 * sends SIGTERM. If we exit immediately we:
 *   - drop in-flight HTTP requests (users see 502s during every deploy),
 *   - leave DB/Redis connections half-open.
 * So we: stop accepting NEW connections, let in-flight requests finish, then
 * close infra, then exit. A hard timeout guards against a hung request.
 */
const app = buildApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "🚀 server listening");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "shutdown initiated");

  // Force-exit if graceful drain takes too long (deploy can't hang forever).
  const forceTimer = setTimeout(() => {
    logger.error("graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000);
  // Passive watchdog: the timer can still force-exit a hung shutdown at 10s, but
  // unref() means it won't keep the process alive on its own — a clean shutdown
  // that finishes early exits immediately instead of stalling until the timer fires.
  forceTimer.unref();

  server.close(async () => {
    try {
      await prisma.$disconnect();
      redis.disconnect();
      logger.info("clean shutdown complete");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "error during shutdown");
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
