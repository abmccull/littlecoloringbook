import { getCapiEventById, isDatabaseConfigured, updateCapiEventStatus } from "@littlecolorbook/db";
import { sendCapiEvent } from "@littlecolorbook/meta";
import { CapiSendError } from "@littlecolorbook/meta";
import type { CapiEventInput } from "@littlecolorbook/meta";
import { JobRunnerError } from "./errors";

type ProcessCapiEventInput = {
  capiEventId: string;
};

function isTransientError(error: unknown): boolean {
  if (error instanceof CapiSendError) {
    // Codes 2, 4 = service temporarily unavailable; 613/17 = rate limit.
    const transientCodes = [2, 4, 613, 17, 2446079];
    return transientCodes.includes(error.code);
  }
  // Network errors or unknown errors are treated as transient.
  return !(error instanceof CapiSendError);
}

export async function runProcessCapiEventJob(input: ProcessCapiEventInput) {
  if (!isDatabaseConfigured()) {
    throw new JobRunnerError("Database is not configured", 503);
  }

  const row = await getCapiEventById(input.capiEventId);

  if (!row) {
    // Treat as terminal — if it's not in the DB we can't do anything.
    throw new JobRunnerError(`CAPI event not found: ${input.capiEventId}`, 404);
  }

  if (row.status === "sent") {
    return { skipped: true, reason: "already_sent" };
  }

  await updateCapiEventStatus(row.id, { status: "sending" });

  const event = row.payloadJson as unknown as CapiEventInput;

  try {
    const result = await sendCapiEvent(event);

    await updateCapiEventStatus(row.id, {
      status: "sent",
      metaEventsReceived: result.events_received,
      metaTraceId: result.fbtrace_id,
      sentAt: new Date(),
    });

    return {
      eventId: row.eventId,
      eventsReceived: result.events_received,
      traceId: result.fbtrace_id,
    };
  } catch (error) {
    const newRetryCount = (row.retryCount ?? 0) + 1;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (isTransientError(error)) {
      await updateCapiEventStatus(row.id, {
        status: "queued",
        errorMessage,
        retryCount: newRetryCount,
      });
      // Re-throw so the Postgres worker retries the job (attempt_count
      // increments up to max_attempts, then it lands in `failed`).
      throw error;
    }

    await updateCapiEventStatus(row.id, {
      status: "failed",
      errorMessage,
      retryCount: newRetryCount,
    });

    // Do NOT re-throw for terminal errors — the Postgres worker will
    // mark the job as failed but we've already recorded the final
    // state in DB.
    return { failed: true, reason: errorMessage };
  }
}
