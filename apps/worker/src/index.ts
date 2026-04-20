import { APP_NAME, defaultOffer } from "@littlecolorbook/shared";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { createInternalJobWorker, closeInternalQueueConnections, isQueueConfigured } from "@littlecolorbook/queue";
import type { InternalJobName } from "@littlecolorbook/queue";
import {
  runProcessSampleJob,
  runProcessPaidOrderJob,
  runProcessCapiEventJob,
} from "@littlecolorbook/jobs";
import type { Worker } from "bullmq";
import { startPostgresWorker } from "./postgres-worker";

/**
 * Default queue backend is Postgres (processing_jobs table). BullMQ
 * path runs alongside only when LEGACY_BULLMQ_WORKER=true, used as a
 * rollback valve during the migration.
 *
 * With the default config:
 *   - Vercel enqueues by INSERTing a row into processing_jobs
 *   - The Postgres worker below polls every 2s and runs handlers
 *   - BullMQ and Redis are untouched
 */
const LEGACY_BULLMQ_ENABLED = process.env.LEGACY_BULLMQ_WORKER === "true";

const JOBS: ReadonlyArray<InternalJobName> = [
  "process-sample",
  "process-paid-order",
  "submit-lulu",
  "sync-lulu-status",
  "process-capi-event",
];

type ProcessorMap = Partial<Record<InternalJobName, (data: unknown) => Promise<unknown>>>;

const processors: ProcessorMap = {
  "process-sample": (data) => runProcessSampleJob(data as Parameters<typeof runProcessSampleJob>[0], {}),
  "process-paid-order": (data) => runProcessPaidOrderJob(data as Parameters<typeof runProcessPaidOrderJob>[0], {}),
  "process-capi-event": (data) => runProcessCapiEventJob(data as Parameters<typeof runProcessCapiEventJob>[0]),
};

const bullmqWorkers: Worker[] = [];
let stopPostgresWorker: (() => Promise<void>) | null = null;

async function shutdown(reason: string) {
  console.log(`[worker] shutting down: ${reason}`);
  if (stopPostgresWorker) {
    try { await stopPostgresWorker(); } catch (err) { console.error("[worker] pg-worker stop error", err); }
  }
  await Promise.allSettled(bullmqWorkers.map((w) => w.close()));
  if (LEGACY_BULLMQ_ENABLED) {
    await closeInternalQueueConnections();
  }
  process.exit(0);
}

async function main() {
  console.log("[worker] boot", {
    service: `${APP_NAME} worker`,
    defaultOffer,
    integrations: getIntegrationStatus(),
    jobs: JOBS,
    queueBackend: LEGACY_BULLMQ_ENABLED ? "postgres + bullmq (dual)" : "postgres",
  });

  // ── Postgres worker (default path) ─────────────────────────────────
  try {
    stopPostgresWorker = await startPostgresWorker();
    console.log("[worker] Postgres worker started");
  } catch (err) {
    console.error("[worker] Postgres worker failed to start", err);
    process.exit(1);
  }

  // ── BullMQ workers (optional legacy fallback) ──────────────────────
  if (LEGACY_BULLMQ_ENABLED) {
    if (!isQueueConfigured()) {
      console.warn("[worker] LEGACY_BULLMQ_WORKER=true but REDIS_URL is not set — skipping BullMQ workers");
    } else {
      for (const jobName of JOBS) {
        const processor = processors[jobName];
        if (!processor) {
          console.log(`[worker] no BullMQ processor for ${jobName} yet — skipping`);
          continue;
        }

        const worker = createInternalJobWorker(
          jobName,
          async (job) => {
            const started = Date.now();
            try {
              const result = await processor(job.data);
              console.log(`[worker] bullmq ${jobName} ok`, { jobId: job.id, ms: Date.now() - started });
              return result;
            } catch (err) {
              console.error(`[worker] bullmq ${jobName} failed`, { jobId: job.id, ms: Date.now() - started, err: String(err) });
              throw err;
            }
          },
        );

        worker.on("failed", (job, err) => {
          console.error(`[worker] bullmq ${jobName} final failure`, { jobId: job?.id, err: String(err) });
        });

        bullmqWorkers.push(worker);
        console.log(`[worker] bullmq ${jobName} listening`);
      }
    }
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  console.log(`[worker] ready — postgres: on, bullmq: ${LEGACY_BULLMQ_ENABLED ? "on" : "off"}`);
}

main().catch((err) => {
  console.error("[worker] fatal boot error", err);
  process.exit(1);
});
