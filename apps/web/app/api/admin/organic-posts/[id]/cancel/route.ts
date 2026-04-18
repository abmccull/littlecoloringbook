import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../../../lib/internal-jobs";
import { cancelOrganicPost, getOrganicPostById } from "@littlecolorbook/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const post = await getOrganicPostById(id);
  if (!post) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: `Organic post ${id} not found` } }, { status: 404 });
  }

  if (post.status === "published" || post.status === "publishing") {
    return NextResponse.json(
      { error: { code: "CANNOT_CANCEL", message: `Cannot cancel a post with status '${post.status}'` } },
      { status: 422 },
    );
  }

  await cancelOrganicPost(id);

  return NextResponse.json({ ok: true });
}
