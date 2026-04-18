import IORedis from "ioredis";
import { Queue, Worker, type JobsOptions, type Processor } from "bullmq";

export type InternalJobName = "process-sample" | "process-paid-order" | "submit-lulu" | "sync-lulu-status" | "batch-submit-lulu" | "process-capi-event";

export type ProcessSamplePayload = {
  orderId: string;
  uploadIds?: string[];
};

export type ProcessPaidOrderPayload = {
  orderId: string;
  uploadIds?: string[];
};

export type SubmitLuluPayload = {
  orderId: string;
  interiorUrl?: string;
  coverUrl?: string;
  quantity?: number;
  lineItems?: Array<{
    coverUrl: string;
    interiorUrl: string;
    quantity: number;
    title: string;
  }>;
  title?: string;
  contactEmail?: string;
  productionDelay?: number;
};

export type SyncLuluStatusPayload = {
  orderId?: string;
  providerJobId?: string;
};

export type BatchSubmitLuluPayload = {
  dryRun?: boolean;
};

export type ProcessCapiEventPayload = {
  capiEventId: string;
};

export type InternalJobPayloadMap = {
  "process-sample": ProcessSamplePayload;
  "process-paid-order": ProcessPaidOrderPayload;
  "submit-lulu": SubmitLuluPayload;
  "sync-lulu-status": SyncLuluStatusPayload;
  "batch-submit-lulu": BatchSubmitLuluPayload;
  "process-capi-event": ProcessCapiEventPayload;
};

const queueNames: Record<InternalJobName, string> = {
  "process-sample": "sample-high",
  "process-paid-order": "paid-default",
  "submit-lulu": "print-submit",
  "sync-lulu-status": "lulu-sync",
  "batch-submit-lulu": "lulu-batch",
  "process-capi-event": "capi-events",
};

const defaultJobOptions: Record<InternalJobName, JobsOptions> = {
  "process-sample": {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: 200,
    removeOnFail: 500,
    priority: 1,
  },
  "process-paid-order": {
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: 200,
    removeOnFail: 500,
    priority: 5,
  },
  "submit-lulu": {
    attempts: 5,
    backoff: { type: "exponential", delay: 15_000 },
    removeOnComplete: 200,
    removeOnFail: 500,
    priority: 3,
  },
  "sync-lulu-status": {
    attempts: 5,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: 500,
    removeOnFail: 500,
    priority: 10,
  },
  "batch-submit-lulu": {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: 100,
    removeOnFail: 200,
    priority: 8,
  },
  "process-capi-event": {
    attempts: 5,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
    priority: 4,
  },
};

let queueConnection: IORedis | null = null;
let workerConnection: IORedis | null = null;
const queueCache = new Map<InternalJobName, Queue>();

function getRedisUrl() {
  return process.env.REDIS_URL ?? process.env.RAILWAY_REDIS_URL ?? null;
}

export function isQueueConfigured() {
  return Boolean(getRedisUrl());
}

function buildRedisConnection() {
  const redisUrl = getRedisUrl();

  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured.");
  }

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}

function getQueueConnection() {
  if (!queueConnection) {
    queueConnection = buildRedisConnection();
  }

  return queueConnection;
}

function getWorkerConnection() {
  if (!workerConnection) {
    workerConnection = buildRedisConnection();
  }

  return workerConnection;
}

export function getInternalQueueName(jobName: InternalJobName) {
  return queueNames[jobName];
}

export function getInternalJobOptions(jobName: InternalJobName) {
  return defaultJobOptions[jobName];
}

export function getInternalQueue(jobName: InternalJobName) {
  const cached = queueCache.get(jobName);

  if (cached) {
    return cached;
  }

  const queue = new Queue(getInternalQueueName(jobName), {
    connection: getQueueConnection(),
    defaultJobOptions: getInternalJobOptions(jobName),
  });

  queueCache.set(jobName, queue);
  return queue;
}

export async function enqueueInternalJob<TName extends InternalJobName>(
  jobName: TName,
  payload: InternalJobPayloadMap[TName],
  options?: JobsOptions,
) {
  const queue = getInternalQueue(jobName);
  const jobId =
    "orderId" in payload && typeof payload.orderId === "string" && payload.orderId
      ? `${jobName}:${payload.orderId}`
      : undefined;

  return queue.add(jobName, payload, {
    ...getInternalJobOptions(jobName),
    ...options,
    jobId: options?.jobId ?? jobId,
  });
}

export function createInternalJobWorker<TName extends InternalJobName>(
  jobName: TName,
  processor: Processor<InternalJobPayloadMap[TName], unknown, string>,
  concurrency = 1,
) {
  return new Worker(getInternalQueueName(jobName), processor, {
    connection: getWorkerConnection(),
    concurrency,
  });
}

export async function enqueueCapiEvent(capiEventId: string) {
  return enqueueInternalJob("process-capi-event", { capiEventId }, {
    jobId: `capi:${capiEventId}`,
  });
}

export async function closeInternalQueueConnections() {
  await Promise.allSettled(Array.from(queueCache.values()).map((queue) => queue.close()));
  queueCache.clear();

  if (queueConnection) {
    await queueConnection.quit();
    queueConnection = null;
  }

  if (workerConnection) {
    await workerConnection.quit();
    workerConnection = null;
  }
}
