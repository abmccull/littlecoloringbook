import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalJobRequest } from "../../../../../lib/internal-jobs";
import { getOrganicPostById } from "@littlecolorbook/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const post = await getOrganicPostById(id);
  if (!post) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: `Organic post ${id} not found` } }, { status: 404 });
  }

  return NextResponse.json({ post });
}
