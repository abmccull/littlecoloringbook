import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import {
  listDmThreads,
  dmPlatformValues,
  dmThreadStatusValues,
} from "@littlecolorbook/db";
import type { DmPlatform, DmThreadStatus } from "@littlecolorbook/db";

const listQuerySchema = z.object({
  platform: z.enum(dmPlatformValues).optional(),
  status: z.enum(dmThreadStatusValues).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const { platform, status, limit, offset } = parsed.data;

  const threads = await listDmThreads({
    platform: platform as DmPlatform | undefined,
    status: status as DmThreadStatus | undefined,
    limit,
    offset,
  });

  return NextResponse.json({ threads, count: threads.length, limit, offset });
}
