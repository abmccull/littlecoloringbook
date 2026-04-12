import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { renderCoverPdf } from "@littlecolorbook/pdf-templates/render";
import {
  getTrim,
  getSpineWidth,
  ensurePageCountParity,
  getOccasion,
  interpolate,
} from "@littlecolorbook/pdf-templates";
import type { BookPayload, OccasionId, StyleId } from "@littlecolorbook/pdf-templates";

export const runtime = "nodejs";

const VALID_STYLE_IDS = new Set<string>(["sunshine", "crayon", "storybook", "minimal"]);

const previewSchema = z.object({
  style: z.string().default("storybook"),
  occasion: z.string().default("everyday"),
  childName: z.string().default("My"),
  title: z.string().optional(),
  pageCount: z.number().int().min(24).max(300).default(30),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid preview request.",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const { style, occasion, childName, title, pageCount } = parsed.data;

  // Validate style ID against the known enum values.
  const styleId: StyleId = VALID_STYLE_IDS.has(style) ? (style as StyleId) : "storybook";

  // Validate occasion ID — fall back to "everyday" if unknown.
  let occasionId: OccasionId;
  let resolvedTitle: string;
  try {
    const occasionModule = getOccasion(occasion as OccasionId);
    occasionId = occasionModule.id;
    resolvedTitle =
      title ?? interpolate(occasionModule.titleTemplate, { childName });
  } catch {
    // Unknown or unimplemented occasion — fall back gracefully.
    occasionId = "everyday";
    resolvedTitle = title ?? `${childName}'s Coloring Book`;
  }

  const safePageCount = ensurePageCountParity(pageCount);
  const trim = getTrim();
  const spineWidthIn = getSpineWidth(safePageCount);

  const payload: BookPayload = {
    trim,
    spineWidthIn,
    pageCount: safePageCount,
    style: styleId,
    occasion: occasionId,
    occasionContext: { childName },
    meta: {
      title: resolvedTitle,
      subtitle: "A little coloring book",
      createdOn: new Date().toISOString().slice(0, 10),
    },
    cover: { type: "stock-art", stockArtId: "rainbow-clouds" },
    // Cover render does not require interior pages.
    pages: [],
  };

  try {
    const pdfBuffer = await renderCoverPdf(payload);
    // NextResponse expects a BodyInit-compatible value; convert Node.js Buffer to Uint8Array.
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown render error.";
    console.error("[preview] renderCoverPdf failed:", message);
    return NextResponse.json(
      { error: { code: "RENDER_ERROR", message: "Failed to render cover preview." } },
      { status: 500 },
    );
  }
}
