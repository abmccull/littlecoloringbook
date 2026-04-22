export const maxDuration = 800;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { isJobRunnerError, replacePaidOrderGenerationPage } from "@littlecolorbook/jobs";
import { deliverLifecycleEmail } from "../../../../../../../../lib/lifecycle-email";

const replacePageSchema = z.object({
  uploadId: z.string().trim().min(1),
});

export async function POST(request: NextRequest, context: { params: Promise<{ token: string; pageId: string }> }) {
  const { token, pageId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = replacePageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid replacement request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const pageIssue = summary.pageIssues.find((issue) => issue.id === pageId);

  if (!pageIssue) {
    return NextResponse.json({ error: "Page issue not found" }, { status: 404 });
  }

  try {
    const result = await replacePaidOrderGenerationPage(
      {
        orderId: summary.order.id,
        generationPageId: pageId,
        uploadId: parsed.data.uploadId,
      },
      {
        sendLifecycleEmail: deliverLifecycleEmail,
      },
    );

    return NextResponse.json({
      ok: true,
      finalized: result.finalized,
      finalStatus: result.finalStatus,
      remainingFailedPages: result.remainingFailedPages,
    });
  } catch (error) {
    if (isJobRunnerError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "We could not replace that page yet.",
      },
      { status: 500 },
    );
  }
}
