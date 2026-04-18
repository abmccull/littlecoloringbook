import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../../lib/internal-jobs";
import { getDmThreadWithMessages } from "@littlecolorbook/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const result = await getDmThreadWithMessages(id, { messageLimit: 50, messageOffset: 0 });
  if (!result) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `DM thread ${id} not found` } },
      { status: 404 },
    );
  }

  // Return messages oldest-first for the inbox UI.
  const messages = [...result.messages].sort(
    (a, b) => a.sentAt.getTime() - b.sentAt.getTime(),
  );

  return NextResponse.json({ thread: result.thread, messages });
}
