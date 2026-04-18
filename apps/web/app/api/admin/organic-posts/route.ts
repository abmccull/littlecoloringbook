import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import {
  insertOrganicPost,
  listOrganicPosts,
  organicPostStatusValues,
  organicPostPlatformValues,
  organicPostFormatValues,
} from "@littlecolorbook/db";
import type { OrganicPostStatus, OrganicPostPlatform, OrganicPostFormat } from "@littlecolorbook/db";

const createSchema = z.object({
  platform: z.enum(organicPostPlatformValues),
  format: z.enum(organicPostFormatValues),
  caption: z.string().min(1).max(5000),
  imageAssetIds: z.array(z.string().min(1)).min(1).max(10),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  firstComment: z.string().max(2200).optional(),
  createdBy: z.string().max(255).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(organicPostStatusValues).optional(),
  platform: z.enum(organicPostPlatformValues).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const payload = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } }, { status: 400 });
  }

  const { platform, format, caption, imageAssetIds, scheduledAt, firstComment, createdBy } = parsed.data;

  const post = await insertOrganicPost({
    id: randomUUID(),
    platform: platform as OrganicPostPlatform,
    format: format as OrganicPostFormat,
    caption,
    imageAssetIds,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    firstComment: firstComment ?? null,
    createdBy: createdBy ?? null,
  });

  return NextResponse.json({ ok: true, post }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid query params", details: parsed.error.flatten() } }, { status: 400 });
  }

  const { status, platform, limit, offset } = parsed.data;

  const posts = await listOrganicPosts({
    status: status as OrganicPostStatus | undefined,
    platform: platform as OrganicPostPlatform | undefined,
    limit,
    offset,
  });

  return NextResponse.json({ posts });
}
