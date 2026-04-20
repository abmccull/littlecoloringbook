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

const workers: Worker[] = [];

async function shutdown(reason: string) {
  console.log(`[worker] shutting down: ${reason}`);
  await Promise.allSettled(workers.map((w) => w.close()));
  await closeInternalQueueConnections();
  process.exit(0);
}

async function main() {
  console.log("[worker] boot", {
    service: `${APP_NAME} worker`,
    defaultOffer,
    integrations: getIntegrationStatus(),
    jobs: JOBS,
  });

  if (!isQueueConfigured()) {
    console.error("[worker] REDIS_URL / RAILWAY_REDIS_URL is not set. Worker cannot start.");
    process.exit(1);
  }

  for (const jobName of JOBS) {
    const processor = processors[jobName];
    if (!processor) {
      console.log(`[worker] no processor for ${jobName} yet — skipping (queue will still accept jobs)`);
      continue;
    }

    const worker = createInternalJobWorker(
      jobName,
      async (job) => {
        const started = Date.now();
        try {
          const result = await processor(job.data);
          console.log(`[worker] ${jobName} ok`, { jobId: job.id, ms: Date.now() - started });
          return result;
        } catch (err) {
          console.error(`[worker] ${jobName} failed`, { jobId: job.id, ms: Date.now() - started, err: String(err) });
          throw err;
        }
      },
    );

    worker.on("failed", (job, err) => {
      console.error(`[worker] ${jobName} final failure`, { jobId: job?.id, err: String(err) });
    });

    workers.push(worker);
    console.log(`[worker] ${jobName} listening`);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  console.log(`[worker] ready — ${workers.length} processors listening`);
}

main().catch((err) => {
  console.error("[worker] fatal boot error", err);
  process.exit(1);
});
