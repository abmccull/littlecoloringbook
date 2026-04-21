import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enqueueProcessingJob = vi.fn();
const isDatabaseConfigured = vi.fn();

vi.mock("@littlecolorbook/db", () => ({
  enqueueProcessingJob,
  isDatabaseConfigured,
}));

vi.mock("server-only", () => ({}));

function createJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: vi.fn().mockResolvedValue(body),
  };
}

describe("enqueueInternalJob", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();

    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("FORCE_ASYNC_INTERNAL_JOBS_IN_DEV", "");

    isDatabaseConfigured.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("prefers direct dispatch in development when direct fallback is allowed", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ accepted: true, status: "sent" }));
    vi.stubGlobal("fetch", fetchMock);

    const { enqueueInternalJob } = await import("../internal-jobs");

    const result = await enqueueInternalJob({
      job: "process-sample",
      payload: { orderId: "ord_sample" },
      fallbackToDirectOnQueueError: true,
    });

    expect(enqueueProcessingJob).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://127.0.0.1:3000/api/internal/jobs/process-sample");
    expect(result).toMatchObject({
      accepted: true,
      mode: "direct",
      queueName: null,
      status: "sent",
    });
  });

  it("falls back to direct dispatch when the Postgres enqueue fails", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://littlecolorbook.com");
    vi.stubEnv("VERCEL_URL", "littlecolorbook-3sw1xff48-abmcculls-projects.vercel.app");
    enqueueProcessingJob.mockRejectedValue(new Error("relation processing_jobs does not exist"));
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({ accepted: true, status: "started" }));
    vi.stubGlobal("fetch", fetchMock);

    const { enqueueInternalJob } = await import("../internal-jobs");

    const result = await enqueueInternalJob({
      job: "process-sample",
      payload: { orderId: "ord_sample" },
      fallbackToDirectOnQueueError: true,
    });

    expect(enqueueProcessingJob).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://littlecolorbook-3sw1xff48-abmcculls-projects.vercel.app/api/internal/jobs/process-sample");
    expect(result).toMatchObject({
      accepted: true,
      mode: "direct",
      queueName: null,
      status: "started",
    });
  });

  it("uses the Postgres queue when the enqueue succeeds", async () => {
    vi.stubEnv("NODE_ENV", "production");
    enqueueProcessingJob.mockResolvedValue({
      id: "job_123",
      created: true,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { enqueueInternalJob } = await import("../internal-jobs");

    const result = await enqueueInternalJob({
      job: "process-sample",
      payload: { orderId: "ord_sample" },
      fallbackToDirectOnQueueError: true,
    });

    expect(enqueueProcessingJob).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      accepted: true,
      mode: "postgres",
      queueName: "processing_jobs",
      jobId: "job_123",
      created: true,
    });
  });
});
