import { NextRequest, NextResponse } from "next/server";
import {
  getDownloadAssetForOrder,
  getOrderPortalSummaryByOrderId,
  getOrderPortalSummary,
  isDatabaseConfigured,
} from "@littlecolorbook/db";
import { getIntegrationStatus } from "@littlecolorbook/shared/env";
import { createSignedDownloadUrl } from "@littlecolorbook/shared/storage";

const DOWNLOAD_URL_TTL_MINUTES = 24 * 60; // 24 hours

export async function GET(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  // Validate requester owns this order via portal token.
  // The portal token is passed as ?token=<value> and must resolve to this orderId.
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Portal token is required." } },
      { status: 401 },
    );
  }

  const portal = await getOrderPortalSummary(token);

  if (!portal) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or expired portal token." } },
      { status: 401 },
    );
  }

  if (portal.order.id !== orderId) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "This token does not belong to the requested order." } },
      { status: 403 },
    );
  }

  if (portal.order.status !== "pdf_ready" && portal.order.deliveryMode !== "print") {
    return NextResponse.json(
      { error: { code: "NOT_READY", message: "PDF is not ready yet." } },
      { status: 404 },
    );
  }

  const asset = await getDownloadAssetForOrder(orderId);

  if (!asset) {
    // Fall back to interior PDF path from portal summary if download_pdf not yet recorded
    const objectPath = portal.assets.downloadPdfPath ?? portal.assets.interiorPdfPath;

    if (!objectPath) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "PDF asset is not available yet." } },
        { status: 404 },
      );
    }

    if (!getIntegrationStatus().gcsConfigured) {
      return NextResponse.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Storage is not configured." } },
        { status: 503 },
      );
    }

    const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_MINUTES * 60 * 1000);
    const signed = await createSignedDownloadUrl({
      bucket: "exports",
      objectPath,
      expiresInMinutes: DOWNLOAD_URL_TTL_MINUTES,
    });

    return NextResponse.json({
      downloadUrl: signed.url,
      expiresAt: expiresAt.toISOString(),
    });
  }

  if (!getIntegrationStatus().gcsConfigured) {
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: "Storage is not configured." } },
      { status: 503 },
    );
  }

  const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_MINUTES * 60 * 1000);
  const signed = await createSignedDownloadUrl({
    bucket: "exports",
    objectPath: asset.objectPath,
    expiresInMinutes: DOWNLOAD_URL_TTL_MINUTES,
  });

  return NextResponse.json({
    downloadUrl: signed.url,
    expiresAt: expiresAt.toISOString(),
  });
}
