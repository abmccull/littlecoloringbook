export const maxDuration = 800;

import { NextResponse } from "next/server";
import { approvePaidOrderGenerationPage, isJobRunnerError } from "@littlecolorbook/jobs";
import { getOrderPortalSummary } from "@littlecolorbook/db";
import { deliverLifecycleEmail } from "../../../../../../../../lib/lifecycle-email";

export async function POST(_request: Request, context: { params: Promise<{ token: string; pageId: string }> }) {
  const { token, pageId } = await context.params;
  const summary = await getOrderPortalSummary(token);

  if (!summary) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const pageIssue = summary.pageIssues.find((issue) => issue.id === pageId);

  if (!pageIssue) {
    return NextResponse.json({ error: "Page issue not found" }, { status: 404 });
  }

  try {
    const result = await approvePaidOrderGenerationPage(
      {
        orderId: summary.order.id,
        generationPageId: pageId,
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
        error: error instanceof Error ? error.message : "We could not approve that page yet.",
      },
      { status: 500 },
    );
  }
}
