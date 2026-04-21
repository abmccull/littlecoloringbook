import { APP_NAME, defaultOffer } from "@littlecolorbook/shared";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { startPostgresWorker } from "./postgres-worker";

/**
 * Internal-job worker. Polls the `processing_jobs` Postgres table and
 * runs handlers from packages/jobs.
 */

let stopPostgresWorker: (() => Promise<void>) | null = null;

async function shutdown(reason: string) {
  console.log(`[worker] shutting down: ${reason}`);
  if (stopPostgresWorker) {
    try {
      await stopPostgresWorker();
    } catch (err) {
      console.error("[worker] pg-worker stop error", err);
    }
  }
  process.exit(0);
}

async function main() {
  console.log("[worker] boot", {
    service: `${APP_NAME} worker`,
    defaultOffer,
    integrations: getIntegrationStatus(),
    queueBackend: "postgres",
  });

  try {
    stopPostgresWorker = await startPostgresWorker();
    console.log("[worker] Postgres worker started");
  } catch (err) {
    console.error("[worker] Postgres worker failed to start", err);
    process.exit(1);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  console.log("[worker] ready");
}

main().catch((err) => {
  console.error("[worker] fatal boot error", err);
  process.exit(1);
});
