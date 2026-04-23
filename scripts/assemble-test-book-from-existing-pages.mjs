import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { coverDesigns, featuredCoverDesigns, getCoverDesign } from "@littlecolorbook/shared";
import { renderInteriorPdf } from "@littlecolorbook/pdf-templates/render";

const DEFAULT_INPUT_DIR = "tmp/eval-run-eval-2026-04-21-local";
const DEFAULT_OUTPUT_DIR = "tmp/premium-cover-test-books";
const DIGITAL_TRIM = { widthIn: 8.5, heightIn: 11, bleedIn: 0, safeIn: 0.25 };

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function scoreImagePath(filePath) {
  const base = path.basename(filePath).toLowerCase();
  const ext = path.extname(base);
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return -100;
  if (base === "new_pro_minimal.png") return 100;
  if (base === "generated.png") return 90;
  if (base.includes("new_pro")) return 80;
  if (base.includes("line") || base.includes("coloring")) return 70;
  if (base.includes("source") || base.includes("old") || base.includes("flash") || base.includes("preview")) return -20;
  return 10;
}

async function imageEntry(filePath) {
  const normalized = sharp(filePath)
    .flatten({ background: "#ffffff" })
    .grayscale()
    .png({ compressionLevel: 9, palette: true });
  const [buffer, metadata] = await Promise.all([
    normalized.toBuffer(),
    sharp(filePath).metadata(),
  ]);

  return {
    lineArt: {
      url: `data:image/png;base64,${buffer.toString("base64")}`,
      widthPx: metadata.width ?? 2550,
      heightPx: metadata.height ?? 3300,
    },
  };
}

function resolveDesigns() {
  if (hasFlag("--all")) {
    return coverDesigns;
  }

  if (hasFlag("--featured")) {
    return featuredCoverDesigns;
  }

  const designArg = getArg("--design", "signature-linen");
  return [getCoverDesign(designArg)];
}

const inputDir = path.resolve(getArg("--input", DEFAULT_INPUT_DIR));
const outputDir = path.resolve(getArg("--out", DEFAULT_OUTPUT_DIR));
const limit = Number.parseInt(getArg("--limit", "30"), 10);
const childName = getArg("--name", "Mila");

const allFiles = await collectFiles(inputDir);
const imageFiles = allFiles
  .map((filePath) => ({ filePath, score: scoreImagePath(filePath) }))
  .filter((item) => item.score > 0)
  .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath))
  .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 30)
  .map((item) => item.filePath);

if (imageFiles.length === 0) {
  throw new Error(`No existing generated page images found in ${inputDir}`);
}

await mkdir(outputDir, { recursive: true });

const pages = [];
for (const filePath of imageFiles) {
  pages.push(await imageEntry(filePath));
}

const designs = resolveDesigns();
const manifest = {
  generatedAt: new Date().toISOString(),
  inputDir,
  outputDir,
  pageCount: pages.length,
  sourceImages: imageFiles,
  books: [],
};

for (const design of designs) {
  const payload = {
    trim: DIGITAL_TRIM,
    spineWidthIn: 0,
    pageCount: pages.length + 3,
    style: design.id,
    occasion: "everyday",
    occasionContext: { childName },
    meta: {
      title: `${childName}'s Coloring Book`,
      subtitle: "A Little Color Book",
      dedication: "For favorite memories, rainy afternoons, and pages worth coloring twice.",
      createdOn: new Date().toISOString().slice(0, 10),
    },
    cover: { type: "stock-art", stockArtId: design.id },
    pages,
    renderOptions: {
      forceEvenPages: false,
      includeCoverPage: true,
    },
  };

  const pdf = await renderInteriorPdf(payload);
  const outputPath = path.join(outputDir, `${slug(design.id)}-test-book.pdf`);
  await writeFile(outputPath, pdf);
  manifest.books.push({ coverDesign: design.id, outputPath, bytes: pdf.length });
  console.log(`Rendered ${design.id}: ${outputPath} (${pdf.length} bytes)`);
}

await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Used ${pages.length} existing images. No generation APIs were called.`);
