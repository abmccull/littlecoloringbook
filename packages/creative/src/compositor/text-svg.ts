import { BRAND_COLORS, BRAND_FONTS, type BrandColor, type BrandFont } from "./brand";

export type TextBlock = {
  text: string;
  font: BrandFont;
  sizePx: number;
  weight?: number;
  color: BrandColor;
  /** Horizontal alignment within the block's bounding box. */
  align?: "start" | "middle" | "end";
  /** Line height multiplier (default 1.2). */
  lineHeight?: number;
};

export type RectFill = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: BrandColor;
  /** Border radius in pixels. */
  rx?: number;
  /** 0–1 opacity. */
  opacity?: number;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Naive word-wrap for an SVG <text> block. Splits on spaces, packs
 * words until the visual width exceeds maxWidthPx, then breaks. Width
 * estimation is a rough glyph-average heuristic — good enough for
 * brand-consistent layouts where type is large and padding is generous.
 */
export function wrapTextToLines(text: string, maxWidthPx: number, fontSizePx: number): string[] {
  // Approximate character width at the given font size — tuned for
  // serif/sans-serif display type. Condensed fonts would need ~0.48.
  const avgCharWidth = fontSizePx * 0.55;
  const maxCharsPerLine = Math.max(1, Math.floor(maxWidthPx / avgCharWidth));

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if ((current.length + 1 + word.length) <= maxCharsPerLine) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Render a single text block into an SVG string positioned at (x, y).
 * Returns only the <text>…</text> element — use buildSvg() to compose
 * into a full <svg> document.
 */
export function renderTextBlockSvg(
  block: TextBlock,
  x: number,
  y: number,
  widthPx: number,
): { svg: string; heightPx: number } {
  const lines = wrapTextToLines(block.text, widthPx, block.sizePx);
  const lineHeight = block.sizePx * (block.lineHeight ?? 1.2);
  const fontFamily = BRAND_FONTS[block.font];
  const fill = BRAND_COLORS[block.color];
  const align = block.align ?? "start";
  const weight = block.weight ?? 400;

  const anchorX = align === "middle" ? x + widthPx / 2 : align === "end" ? x + widthPx : x;

  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : lineHeight;
      return `<tspan x="${anchorX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  const anchorAttr = align === "middle" ? "middle" : align === "end" ? "end" : "start";
  const svg = `<text x="${anchorX}" y="${y + block.sizePx}" font-family="${fontFamily}" font-size="${block.sizePx}" font-weight="${weight}" fill="${fill}" text-anchor="${anchorAttr}" dominant-baseline="alphabetic">${tspans}</text>`;

  return {
    svg,
    heightPx: block.sizePx + lineHeight * Math.max(0, lines.length - 1),
  };
}

/**
 * Build a full <svg> document from a set of rect fills + text blocks.
 * Returns a Buffer ready for sharp.composite({ input: svg }).
 */
export function buildSvg({
  width,
  height,
  rects = [],
  texts = [],
}: {
  width: number;
  height: number;
  rects?: RectFill[];
  texts?: Array<{ block: TextBlock; x: number; y: number; widthPx: number }>;
}): Buffer {
  const rectSvg = rects
    .map(
      (r) =>
        `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${BRAND_COLORS[r.color]}" rx="${r.rx ?? 0}" opacity="${r.opacity ?? 1}"/>`,
    )
    .join("");

  const textSvg = texts.map((t) => renderTextBlockSvg(t.block, t.x, t.y, t.widthPx).svg).join("");

  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rectSvg}${textSvg}</svg>`;
  return Buffer.from(doc);
}
