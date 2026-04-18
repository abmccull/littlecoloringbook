import { NextRequest, NextResponse } from "next/server";
import {
  createUploadPlaceholder,
  getOrderById,
  getOrderPortalSummary,
  isDatabaseConfigured,
} from "@littlecolorbook/db";
import { z } from "zod";
import { buildAssetPath, createSignedUploadUrl, sanitizeObjectName } from "@littlecolorbook/shared/storage";
import { getIntegrationStatus, getStorageEnvIssues } from "@littlecolorbook/shared/env";
import { getCustomerSession } from "../../../../lib/auth";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_FILENAME_LENGTH = 200;

const presignRequestSchema = z.object({
  entityType: z.enum(["sample", "order"]),
  entityId: z.string().min(1).max(120),
  uploadKind: z.enum(["original", "reference"]).default("original"),
  fileName: z.string().min(1).max(MAX_FILENAME_LENGTH),
  contentType: z.string().min(1),
  portalToken: z.string().min(1).max(200).optional(),
});

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = presignRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid upload request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const normalizedContentType = parsed.data.contentType.toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(normalizedContentType)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a JPG, PNG, WebP, or HEIC photo." },
      { status: 400 },
    );
  }

  const integrations = getIntegrationStatus();

  if (!isDatabaseConfigured() && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  if (!integrations.gcsConfigured) {
    return NextResponse.json(
      {
        error: "Google Cloud Storage is not configured correctly.",
        issues: getStorageEnvIssues(),
      },
      { status: 503 },
    );
  }

  // Authorization: the caller must prove they own the entityId. Three
  // accepted mechanisms:
  //  1. Portal token attached to this order (magic-link flow)
  //  2. Signed-in customer whose customer_id matches the order's
  //  3. The order/sample is still in `draft` status — allowed because
  //     the builder flow presigns BEFORE checkout, and drafts haven't
  //     been paid for yet so there's no material harm from a stray
  //     upload. We still require the order row to exist — no writing
  //     into a path tied to an unknown id.
  if (isDatabaseConfigured()) {
    const order = await getOrderById(parsed.data.entityId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    let authorized = false;

    if (parsed.data.portalToken) {
      const portalSummary = await getOrderPortalSummary(parsed.data.portalToken);
      if (portalSummary && portalSummary.order.id === order.id) {
        authorized = true;
      }
    }

    if (!authorized) {
      const session = await getCustomerSession().catch(() => null);
      if (session && session.customerId === order.customerId) {
        authorized = true;
      }
    }

    // Pre-checkout builder flow: drafts with no customer attached yet
    // are still presigning so the user can upload photos before paying.
    // We gate this on `status === 'draft'` ONLY — once an order is in
    // any other state, auth via token or session is required.
    if (!authorized && order.status === "draft") {
      authorized = true;
    }

    if (!authorized) {
      return unauthorized("You don't have permission to upload to this order.");
    }
  }

  const safeFileName = sanitizeObjectName(parsed.data.fileName);
  const objectPath = buildAssetPath([
    parsed.data.entityType === "sample" ? "samples" : "orders",
    parsed.data.entityId,
    parsed.data.uploadKind,
    `${Date.now()}-${safeFileName}`,
  ]);

  try {
    await createUploadPlaceholder({
      orderId: parsed.data.entityId,
      fileName: parsed.data.fileName,
      contentType: normalizedContentType,
      objectPath,
      kind: parsed.data.uploadKind,
    });

    const signedUpload = await createSignedUploadUrl({
      bucket: "uploads",
      objectPath,
      contentType: normalizedContentType,
      maxBytes: MAX_UPLOAD_BYTES,
    });

    return NextResponse.json({
      objectPath,
      bucket: "uploads",
      databaseConfigured: isDatabaseConfigured(),
      ...signedUpload,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Google Cloud Storage configuration is invalid.",
          issues: error.issues.map((issue) => ({
            path: issue.path.join(".") || "root",
            message: issue.message,
          })),
        },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : "Could not create an upload URL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
