import sharp from "sharp";

export type ColoringPageQcViolation =
  | "color_present"
  | "gray_wash_present"
  | "solid_black_region_present"
  | "not_line_art";

export type ColoringPageQcResult = {
  ok: boolean;
  violations: ColoringPageQcViolation[];
  metrics: {
    colorSaturationRatio: number;
    grayMidtoneRatio: number;
    solidBlackRegionRatio: number;
    lineArtRatio: number;
  };
  correctionLine: string | null;
};

const THRESHOLDS = {
  colorSaturationRatio: 0.005,
  grayMidtoneRatio: 0.07,
  solidBlackRegionRatio: 0.008,
  lineArtRatioMin: 0.7,
} as const;

const VIOLATION_CORRECTIONS: Record<ColoringPageQcViolation, string> = {
  color_present:
    "The previous output contained color pixels. Output MUST be pure black and white only — no blue, green, red, yellow, brown, tan, or any hue. Every pixel must be either black ink or white paper.",
  gray_wash_present:
    "The previous output filled faces, skin, fur, or clothing with gray tonal wash or halftone shading. Remove ALL gray fill. These areas must be clean white paper bounded by black outline strokes only — no gray fill anywhere on the page.",
  solid_black_region_present:
    "The previous output filled a region solid black (T-shirt, fur patch, eye mask, clothing, or similar). Break that region into open colorable shapes bounded by thin black outlines. Even dark clothing and dark fur markings must be colorable white spaces with only outlines, not solid black fills.",
  not_line_art:
    "The previous output looked like a pencil sketch or photo-filter of the source photograph, not clean coloring book line art. Redo as clean continuous black outline strokes on plain white paper — no photographic texture, no soft gradients, no pencil shading, no sketchy hatching. Every mark must be a deliberate closed contour.",
};

export async function assertColoringPageQC(buffer: Buffer): Promise<ColoringPageQcResult> {
  const sampleSize = 512;
  const img = sharp(buffer).resize(sampleSize, sampleSize, { fit: "inside" });

  const [rgb, gray] = await Promise.all([
    img.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    img.clone().removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true }),
  ]);

  const rgbPixels = rgb.data;
  const rgbChannels = rgb.info.channels;
  const pxCount = rgb.info.width * rgb.info.height;
  const grayPixels = gray.data;

  let coloredPixels = 0;
  let midtonePixels = 0;
  let pureBlackPixels = 0;
  let pureWhitePixels = 0;
  let nearBlackPixels = 0;

  for (let i = 0, p = 0; i < rgbPixels.length; i += rgbChannels, p += 1) {
    const r = rgbPixels[i];
    const g = rgbPixels[i + 1];
    const b = rgbPixels[i + 2];

    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
    if (sat > 0.08 && maxC > 30) coloredPixels += 1;

    const y = grayPixels[p];
    if (y <= 20) { nearBlackPixels += 1; pureBlackPixels += 1; }
    else if (y >= 240) pureWhitePixels += 1;
    else if (y > 80 && y < 200) midtonePixels += 1;
  }

  const colorSaturationRatio = coloredPixels / pxCount;
  const grayMidtoneRatio = midtonePixels / pxCount;
  const lineArtRatio = (pureBlackPixels + pureWhitePixels) / pxCount;

  const solidBlackRegionRatio = await detectLargestSolidBlackRegion(grayPixels, gray.info.width, gray.info.height);

  const violations: ColoringPageQcViolation[] = [];
  if (colorSaturationRatio > THRESHOLDS.colorSaturationRatio) violations.push("color_present");
  if (grayMidtoneRatio > THRESHOLDS.grayMidtoneRatio) violations.push("gray_wash_present");
  if (solidBlackRegionRatio > THRESHOLDS.solidBlackRegionRatio) violations.push("solid_black_region_present");
  if (lineArtRatio < THRESHOLDS.lineArtRatioMin) violations.push("not_line_art");

  const correctionLine =
    violations.length === 0 ? null : violations.map((v) => VIOLATION_CORRECTIONS[v]).join(" ");

  return {
    ok: violations.length === 0,
    violations,
    metrics: { colorSaturationRatio, grayMidtoneRatio, solidBlackRegionRatio, lineArtRatio },
    correctionLine,
  };
}

async function detectLargestSolidBlackRegion(
  grayPixels: Buffer,
  width: number,
  height: number,
): Promise<number> {
  const total = width * height;
  const visited = new Uint8Array(total);
  const isBlack = (idx: number) => grayPixels[idx] <= 25 && visited[idx] === 0;
  let largestRegion = 0;
  const stack: number[] = [];

  for (let i = 0; i < total; i += 1) {
    if (!isBlack(i)) continue;
    let size = 0;
    stack.length = 0;
    stack.push(i);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited[cur] === 1) continue;
      if (grayPixels[cur] > 25) continue;
      visited[cur] = 1;
      size += 1;
      const x = cur % width;
      const y = (cur - x) / width;
      if (x > 0) stack.push(cur - 1);
      if (x < width - 1) stack.push(cur + 1);
      if (y > 0) stack.push(cur - width);
      if (y < height - 1) stack.push(cur + width);
    }
    if (size > largestRegion) largestRegion = size;
  }

  return largestRegion / total;
}
