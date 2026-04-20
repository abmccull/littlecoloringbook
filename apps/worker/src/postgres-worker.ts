import {
  claimNextProcessingJobs,
  completeProcessingJob,
  failProcessingJob,
  resetStuckClaimedJobs,
  type ProcessingJob,
  type ProcessingJobKind,
} from "@littlecolorbook/db";
import {
  runProcessSampleJob,
  runProcessPaidOrderJob,
  runProcessCapiEventJob,
} from "@littlecolorbook/jobs";
import crypto from "node:crypto";

type JobHandler = (payload: Record<string, unknown>) => Promise<unknown>;

const HANDLERS: Partial<Record<ProcessingJobKind, JobHandler>> = {
  "process-sample": (p) => runProcessSampleJob(p as Parameters<typeof runProcessSampleJob>[0], {}),
  "process-paid-order": (p) => runProcessPaidOrderJob(p as Parameters<typeof runProcessPaidOrderJob>[0], {}),
  "process-capi-event": (p) => runProcessCapiEventJob(p as Parameters<typeof runProcessCapiEventJob>[0]),
  // submit-lulu and sync-lulu-status don't have worker-side handlers
  // in the current codebase (they run via HTTP internal-job routes).
  // The Postgres worker treats them as no-ops until handlers exist.
};

const POLL_INTERVAL_MS = Number(process.env.PG_WORKER_POLL_MS ?? 2000);
const CONCURRENCY_PER_KIND = Number(process.env.PG_WORKER_CONCURRENCY ?? 3);
const CLAIM_TIMEOUT_SECONDS = Number(process.env.PG_WORKER_CLAIM_TIMEOUT_SECONDS ?? 15 * 60);
const STUCK_RESET_EVERY_N_POLLS = 30; // ~every minute at 2s poll

const WORKER_ID = `pg-${process.env.HOSTNAME ?? "local"}-${crypto.randomBytes(3).toString("hex")}`;

let running = true;
let pollCount = 0;

async function processOneJob(job: ProcessingJob): Promise<void> {
  const handler = HANDLERS[job.kind];
  if (!handler) {
    console.log(`[pg-worker] no handler for kind=${job.kind}, marking complete (no-op)`);
    await completeProcessingJob(job.id);
    return;
  }

  const started = Date.now();
  try {
    await handler(job.payload);
    await completeProcessingJob(job.id);
    console.log(`[pg-worker] ${job.kind} ok`, { jobId: job.id, ms: Date.now() - started });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const outcome = await failProcessingJob({ jobId: job.id, error: message });
    console.error(`[pg-worker] ${job.kind} failed`, {
      jobId: job.id,
      ms: Date.now() - started,
      attempt: outcome?.nextAttempt,
      willRetry: outcome?.willRetry,
      err: message,
    });
  }
}

async function pollKind(kind: ProcessingJobKind): Promise<number> {
  const claimed = await claimNextProcessingJobs({
    kind,
    limit: CONCURRENCY_PER_KIND,
    claimedBy: WORKER_ID,
  });
  if (claimed.length === 0) return 0;
  await Promise.all(claimed.map(processOneJob));
  return claimed.length;
}

async function pollCycle(): Promise<void> {
  pollCount++;

  // Self-healing: reset any claimed-but-orphaned jobs. Cheap partial
  // index + it's a no-op most of the time.
  if (pollCount % STUCK_RESET_EVERY_N_POLLS === 0) {
    try {
      const reset = await resetStuckClaimedJobs({ timeoutSeconds: CLAIM_TIMEOUT_SECONDS });
      if (reset > 0) console.log(`[pg-worker] reset ${reset} stuck claimed jobs`);
    } catch (err) {
      console.error("[pg-worker] resetStuckClaimedJobs failed", err);
    }
  }

  const kinds: ProcessingJobKind[] = Object.keys(HANDLERS) as ProcessingJobKind[];
  try {
    const results = await Promise.all(kinds.map((k) => pollKind(k).catch((err) => {
      console.error(`[pg-worker] poll ${k} errored`, err);
      return 0;
    })));
    const total = results.reduce((a, b) => a + b, 0);
    if (total > 0) console.log(`[pg-worker] cycle processed ${total} jobs across ${kinds.length} kinds`);
  } catch (err) {
    console.error("[pg-worker] pollCycle fatal error (continuing)", err);
  }
}

export async function startPostgresWorker(): Promise<() => Promise<void>> {
  console.log(`[pg-worker] starting — id=${WORKER_ID}, poll=${POLL_INTERVAL_MS}ms, concurrency=${CONCURRENCY_PER_KIND}`);

  // Fire immediate first poll so we don't wait for interval on cold boot
  await pollCycle().catch((err) => console.error("[pg-worker] initial poll errored", err));

  const interval = setInterval(() => {
    if (!running) return;
    void pollCycle();
  }, POLL_INTERVAL_MS);

  return async () => {
    running = false;
    clearInterval(interval);
    console.log("[pg-worker] stopped");
  };
}
