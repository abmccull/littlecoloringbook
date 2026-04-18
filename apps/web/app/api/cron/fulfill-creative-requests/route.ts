import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import {
  listPendingCreativeRequests,
  markCreativeRequestFulfilled,
  markCreativeRequestRejected,
  incrementCreativeRequestAttempts,
} from "@littlecolorbook/db";
import {
  produceCreative,
  creativeBriefInputSchema,
  ComplianceRejectedError,
  MissingClientError,
} from "@littlecolorbook/creative";
import type { ProduceCreativeOptions, ProduceResult } from "@littlecolorbook/creative";

// ─── Constants ────────────────────────────────────────────────────────────────

const FULFILLMENT_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS_BEFORE_REJECT = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

type FulfilledSummary = {
  requestId: string;
  briefId: string;
  assetIds: string[];
};

type RejectedSummary = {
  requestId: string;
  reason: string;
};

type ErrorSummary = {
  requestId: string;
  error: string;
};

type CronSummary = {
  processed: number;
  fulfilled: FulfilledSummary[];
  rejected: RejectedSummary[];
  retried: number;
  errors: ErrorSummary[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function extractAssetIds(result: ProduceResult): string[] {
  const ids: string[] = [];

  if (result.heroAssetId) ids.push(result.heroAssetId);

  if (result.crops) {
    for (const id of Object.values(result.crops)) {
      ids.push(id);
    }
  }

  if (result.cards) {
    for (const card of result.cards) {
      ids.push(card.heroAssetId);
      for (const id of Object.values(card.cropAssetIds)) {
        ids.push(id);
      }
    }
  }

  if (result.videoAssetId) ids.push(result.videoAssetId);
  if (result.audioAssetId) ids.push(result.audioAssetId);

  return ids;
}

function buildProduceOptions(parsedBrief: ReturnType<typeof creativeBriefInputSchema.parse>): {
  options: ProduceCreativeOptions;
  missingClients: string[];
} {
  const missingClients: string[] = [];
  const options: ProduceCreativeOptions = {
    createdBy: "cron:fulfill-creative-requests",
  };

  // Canva: only if brief has a canvaTemplateId AND CANVA_REFRESH_TOKEN is present
  const canvaRefreshToken = process.env.CANVA_REFRESH_TOKEN;
  if ("canvaTemplateId" in parsedBrief && parsedBrief.canvaTemplateId) {
    if (!canvaRefreshToken) {
      missingClients.push("canvaClient (CANVA_REFRESH_TOKEN absent)");
    }
    // If token present, CanvaClient will self-construct from env inside orchestrator
  }

  // Gamma: required for slideshow_narration_video
  if (parsedBrief.kind === "slideshow_narration_video") {
    if (!process.env.GAMMA_API_KEY) {
      missingClients.push("gammaClient (GAMMA_API_KEY absent)");
    } else {
      // Lazy-construct — we import GammaClient below only if needed
      // The orchestrator accepts the client object; we'll provide it
      // We can't import at top-level without pulling in a large dep unconditionally.
      // The missing-client guard above already handles the "no key" path.
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      missingClients.push("voiceoverClient (ELEVENLABS_API_KEY absent)");
    }
  }

  // ElevenLabs: required for ugc_narrated
  if (parsedBrief.kind === "ugc_narrated") {
    if (!process.env.ELEVENLABS_API_KEY) {
      missingClients.push("voiceoverClient (ELEVENLABS_API_KEY absent)");
    }
  }

  return { options, missingClients };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // 1. Auth
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  // 2. Feature flag
  if (process.env.CREATIVE_FULFILLMENT_ENABLED !== "true") {
    return NextResponse.json({ skipped: true, reason: "disabled" });
  }

  // 3. Mandatory env check
  const mandatoryEnvVars = ["DATABASE_URL", "GEMINI_API_KEY", "GCS_PROJECT_ID", "GCS_BUCKET_EXPORTS"] as const;
  const missingEnvVars = mandatoryEnvVars.filter((key) => !process.env[key]);
  if (missingEnvVars.length > 0) {
    return NextResponse.json(
      { error: { code: "MISCONFIGURED", message: "Missing required environment variables", details: missingEnvVars } },
      { status: 503 },
    );
  }

  // 4. Batch size
  const batchSize = Math.max(1, parseInt(process.env.MAX_FULFILLMENTS_PER_RUN ?? "3", 10) || 3);

  // 5. Fetch pending requests
  const pendingRequests = await listPendingCreativeRequests({ limit: batchSize });

  const summary: CronSummary = {
    processed: 0,
    fulfilled: [],
    rejected: [],
    retried: 0,
    errors: [],
  };

  // 6. Process serially (creative generation is heavy — no concurrency within a tick)
  for (const req of pendingRequests) {
    summary.processed++;
    const requestId = req.id;

    // 6a. Parse briefJson via Zod
    const parsedBriefResult = creativeBriefInputSchema.safeParse(
      (req.briefJson as Record<string, unknown>).brief ?? req.briefJson,
    );

    if (!parsedBriefResult.success) {
      await markCreativeRequestRejected({
        id: requestId,
        reason: `invalid_brief: ${parsedBriefResult.error.message}`,
        rejectedAt: new Date(),
      });
      summary.rejected.push({ requestId, reason: "invalid_brief" });
      continue;
    }

    const parsedBrief = parsedBriefResult.data;

    // 6b. Build options; check for required but missing provider clients
    const { options, missingClients } = buildProduceOptions(parsedBrief);

    if (missingClients.length > 0) {
      await markCreativeRequestRejected({
        id: requestId,
        reason: `missing_provider: ${missingClients.join(", ")}`,
        rejectedAt: new Date(),
      });
      summary.rejected.push({ requestId, reason: "missing_provider" });
      continue;
    }

    // 6c. For video kinds that need clients, construct them lazily
    if (parsedBrief.kind === "slideshow_narration_video") {
      const gammaKey = process.env.GAMMA_API_KEY;
      const elevenKey = process.env.ELEVENLABS_API_KEY;
      if (gammaKey && elevenKey) {
        const [{ GammaClient }, { ElevenLabsClient }] = await Promise.all([
          import("@littlecolorbook/gamma"),
          import("@littlecolorbook/voiceover"),
        ]);
        options.gammaClient = new GammaClient({
          apiKey: gammaKey,
          baseUrl: process.env.GAMMA_API_BASE_URL ?? "https://public-api.gamma.app/v1.0",
        });
        options.voiceoverClient = new ElevenLabsClient({
          apiKey: elevenKey,
          baseUrl: process.env.ELEVENLABS_API_BASE_URL ?? "https://api.elevenlabs.io",
          defaultModelId: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
        });
      }
    }

    if (parsedBrief.kind === "ugc_narrated") {
      const elevenKey = process.env.ELEVENLABS_API_KEY;
      if (elevenKey) {
        const { ElevenLabsClient } = await import("@littlecolorbook/voiceover");
        options.voiceoverClient = new ElevenLabsClient({
          apiKey: elevenKey,
          baseUrl: process.env.ELEVENLABS_API_BASE_URL ?? "https://api.elevenlabs.io",
          defaultModelId: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
        });
      }
    }

    // 6d. Produce creative with 90s timeout
    let result: ProduceResult;
    try {
      result = await withTimeout(produceCreative(parsedBrief, options), FULFILLMENT_TIMEOUT_MS);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Compliance rejection — permanent failure
      if (err instanceof ComplianceRejectedError) {
        const report = err.report;
        const reason = `compliance_rejected: ${JSON.stringify({ status: report.status, errors: report.errors })}`;
        await markCreativeRequestRejected({
          id: requestId,
          reason,
          rejectedAt: new Date(),
        });
        summary.rejected.push({ requestId, reason: "compliance_rejected" });
        continue;
      }

      // Missing client (should be caught above, but guard here too)
      if (err instanceof MissingClientError) {
        await markCreativeRequestRejected({
          id: requestId,
          reason: `missing_provider: ${errorMessage}`,
          rejectedAt: new Date(),
        });
        summary.rejected.push({ requestId, reason: "missing_provider" });
        continue;
      }

      // Transient / retryable error — increment attempt count
      const currentAttempts = (req.attemptCount ?? 0) + 1;
      if (currentAttempts >= MAX_ATTEMPTS_BEFORE_REJECT) {
        await markCreativeRequestRejected({
          id: requestId,
          reason: `max_retries: ${errorMessage}`,
          rejectedAt: new Date(),
        });
        summary.rejected.push({ requestId, reason: "max_retries" });
      } else {
        await incrementCreativeRequestAttempts({ id: requestId, lastError: errorMessage });
        summary.retried++;
      }

      summary.errors.push({ requestId, error: errorMessage });
      continue;
    }

    // 6e. Success — extract asset IDs and mark fulfilled
    const assetIds = extractAssetIds(result);
    await markCreativeRequestFulfilled({
      id: requestId,
      briefId: result.briefId,
      assetIds,
      fulfilledAt: new Date(),
    });

    summary.fulfilled.push({ requestId, briefId: result.briefId, assetIds });
  }

  return NextResponse.json(summary);
}
