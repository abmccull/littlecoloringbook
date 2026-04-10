import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputRoot = path.join(repoRoot, "marketing", "assets", "website-proof-photo-library");
const imagesDir = path.join(outputRoot, "images");
const manifestJsonPath = path.join(outputRoot, "manifest.json");
const manifestCsvPath = path.join(outputRoot, "manifest.csv");
const reviewHtmlPath = path.join(outputRoot, "review.html");
const noticePath = path.join(outputRoot, "NOTICE.md");

const targetCounts = {
  family: 18,
  kids: 16,
  pets: 16,
};

const searchPlans = [
  { category: "family", query: "family kids portrait", orientation: "portrait" },
  { category: "family", query: "siblings portrait", orientation: "portrait" },
  { category: "family", query: "family outdoors", orientation: "portrait" },
  { category: "family", query: "family beach", orientation: "portrait" },
  { category: "kids", query: "child portrait", orientation: "portrait" },
  { category: "kids", query: "kid playing", orientation: "portrait" },
  { category: "kids", query: "birthday child", orientation: "portrait" },
  { category: "kids", query: "toddler portrait", orientation: "portrait" },
  { category: "pets", query: "dog portrait", orientation: "portrait" },
  { category: "pets", query: "cat portrait", orientation: "portrait" },
  { category: "pets", query: "family pet", orientation: "portrait" },
  { category: "pets", query: "child dog", orientation: "portrait" },
];

const blockedAltPatterns = [
  /\bwedding\b/i,
  /\bbride\b/i,
  /\bgroom\b/i,
  /\bbeer\b/i,
  /\bwine\b/i,
  /\bcocktail\b/i,
  /\bbar\b/i,
  /\bconcert\b/i,
  /\bprotest\b/i,
  /\bgraduation\b/i,
];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function csvCell(value) {
  const stringValue = String(value ?? "");
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function buildCsv(rows) {
  const header = [
    "index",
    "category",
    "query",
    "photo_id",
    "alt_description",
    "photographer_name",
    "photographer_profile",
    "unsplash_page",
    "download_url",
    "local_file",
    "host",
  ];

  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.index,
        row.category,
        row.query,
        row.photoId,
        row.altDescription,
        row.photographerName,
        row.photographerProfile,
        row.unsplashPage,
        row.downloadUrl,
        row.localFile,
        row.host,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildReviewHtml(rows) {
  const cards = rows
    .map(
      (row) => `
        <article class="card">
          <img src="./images/${encodeURIComponent(row.localFile)}" alt="${escapeHtml(row.altDescription)}" loading="lazy" />
          <div class="meta">
            <span class="pill">${escapeHtml(row.category)}</span>
            <h2>${escapeHtml(row.altDescription)}</h2>
            <p><strong>Query:</strong> ${escapeHtml(row.query)}</p>
            <p><strong>Photographer:</strong> <a href="${escapeHtml(row.photographerProfile)}" target="_blank" rel="noreferrer">${escapeHtml(
              row.photographerName,
            )}</a></p>
            <p><strong>Source:</strong> <a href="${escapeHtml(row.unsplashPage)}" target="_blank" rel="noreferrer">Unsplash photo page</a></p>
            <p><strong>Usage:</strong> Demo example source only. Do not imply customer submission or endorsement.</p>
          </div>
        </article>
      `,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Little Color Book demo proof source review</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6efe5;
        --card: rgba(255, 255, 255, 0.92);
        --ink: #231915;
        --muted: #6a5950;
        --line: rgba(35, 25, 21, 0.12);
        --accent: #dd6b3c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--ink);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(1280px, calc(100% - 32px));
        margin: 0 auto;
        padding: 32px 0 72px;
      }
      h1 { margin: 0 0 10px; font-size: clamp(2rem, 4vw, 3rem); }
      p { margin: 0; line-height: 1.5; color: var(--muted); }
      .intro {
        display: grid;
        gap: 14px;
        margin-bottom: 24px;
        padding: 24px;
        border-radius: 24px;
        background: var(--card);
        border: 1px solid var(--line);
      }
      .pill {
        display: inline-flex;
        width: fit-content;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(221, 107, 60, 0.12);
        color: #8f3d2f;
        font-size: 0.85rem;
        font-weight: 700;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 18px;
      }
      .card {
        display: grid;
        gap: 14px;
        padding: 16px;
        border-radius: 24px;
        background: var(--card);
        border: 1px solid var(--line);
      }
      .card img {
        width: 100%;
        aspect-ratio: 4 / 5;
        object-fit: cover;
        border-radius: 18px;
        background: #efe6d9;
      }
      .meta {
        display: grid;
        gap: 8px;
      }
      .meta h2 {
        margin: 0;
        font-size: 1rem;
        line-height: 1.25;
      }
      .meta a {
        color: inherit;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="intro">
        <span class="pill">Website proof source library</span>
        <h1>Licensed stock demo sources for before-and-after examples</h1>
        <p>
          These images were sourced from Unsplash for demo transformations. Use them as example inputs only. Do not describe them as customer photos or imply any endorsement from the people shown.
        </p>
      </section>
      <section class="grid">
        ${cards}
      </section>
    </main>
  </body>
</html>
`;
}

function shouldKeepPhoto(photo, photographerCounts, selectedIds) {
  const rawUrl = photo?.urls?.raw;
  const altDescription = photo?.alt_description?.trim();
  const photographerName = photo?.user?.name?.trim();

  if (!photo?.id || selectedIds.has(photo.id) || !rawUrl || !altDescription || !photographerName) {
    return false;
  }

  const host = new URL(rawUrl).host;

  if (host !== "images.unsplash.com") {
    return false;
  }

  if (blockedAltPatterns.some((pattern) => pattern.test(altDescription))) {
    return false;
  }

  if ((photographerCounts.get(photographerName) ?? 0) >= 4) {
    return false;
  }

  return true;
}

async function searchUnsplash(query, page, orientation) {
  const url = new URL("https://unsplash.com/napi/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", "30");
  url.searchParams.set("orientation", orientation);

  const response = await fetch(url, {
    headers: {
      "user-agent": "LittleColorBookProofSourcing/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Unsplash search failed for "${query}" page ${page}: ${response.status}`);
  }

  return response.json();
}

async function downloadPhoto(url, destinationPath) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "LittleColorBookProofSourcing/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} for ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(destinationPath, Buffer.from(arrayBuffer));
}

async function main() {
  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(imagesDir, { recursive: true });

  const selected = [];
  const selectedIds = new Set();
  const photographerCounts = new Map();
  const categoryCounts = new Map(Object.entries(targetCounts).map(([category]) => [category, 0]));

  for (const plan of searchPlans) {
    if ((categoryCounts.get(plan.category) ?? 0) >= targetCounts[plan.category]) {
      continue;
    }

    for (let page = 1; page <= 3; page += 1) {
      if ((categoryCounts.get(plan.category) ?? 0) >= targetCounts[plan.category]) {
        break;
      }

      const payload = await searchUnsplash(plan.query, page, plan.orientation);

      for (const photo of payload.results ?? []) {
        if ((categoryCounts.get(plan.category) ?? 0) >= targetCounts[plan.category]) {
          break;
        }

        if (!shouldKeepPhoto(photo, photographerCounts, selectedIds)) {
          continue;
        }

        const rawUrl = new URL(photo.urls.raw);
        rawUrl.searchParams.set("w", "1600");
        rawUrl.searchParams.set("fit", "max");
        rawUrl.searchParams.set("fm", "jpg");
        rawUrl.searchParams.set("q", "80");
        rawUrl.searchParams.set("auto", "format");

        const index = selected.length + 1;
        const localFile = `${String(index).padStart(2, "0")}-${plan.category}-${photo.id}.jpg`;

        selected.push({
          index,
          category: plan.category,
          query: plan.query,
          photoId: photo.id,
          altDescription: photo.alt_description.trim(),
          photographerName: photo.user.name.trim(),
          photographerProfile: photo.user.links.html,
          unsplashPage: photo.links.html,
          downloadUrl: rawUrl.toString(),
          localFile,
          host: rawUrl.host,
        });

        selectedIds.add(photo.id);
        photographerCounts.set(photo.user.name.trim(), (photographerCounts.get(photo.user.name.trim()) ?? 0) + 1);
        categoryCounts.set(plan.category, (categoryCounts.get(plan.category) ?? 0) + 1);
      }
    }
  }

  const totalTarget = Object.values(targetCounts).reduce((sum, value) => sum + value, 0);

  if (selected.length < totalTarget) {
    throw new Error(`Only sourced ${selected.length} photos out of ${totalTarget}. Add more queries or pages and re-run.`);
  }

  for (const row of selected) {
    const destinationPath = path.join(imagesDir, row.localFile);
    await downloadPhoto(row.downloadUrl, destinationPath);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "Unsplash public search endpoint",
    note: "Demo example sources only. Do not imply customer submission or endorsement.",
    pexelsStatus: "Automated fetch unavailable during this run due anti-bot challenge page.",
    unsplashFilterNote:
      "Only assets hosted on images.unsplash.com were included. plus.unsplash.com results were excluded as a conservative filter against Unsplash+ inventory.",
    categoryCounts: Object.fromEntries(categoryCounts),
    photos: selected,
  };

  const notice = `# Website Proof Source Library

Generated: ${manifest.generatedAt}

## What this is

This folder contains licensed stock photos sourced from Unsplash for demo before-and-after transformations on the Little Color Book website.

## What this is not

- Not customer-submitted imagery
- Not testimonials
- Not proof of real customer outcomes

## Usage rule

Present these as demo examples or example transformations only.

Recommended labels:

- "Example transformation"
- "Demo example from licensed source photo"
- "Sample output using licensed stock input"

Do not use labels like:

- "Customer result"
- "Real family who ordered"
- "What our customers got"

## License notes

- Unsplash license allows free download, modification, and commercial use without permission or required attribution.
- Images cannot be sold without significant modification.
- Do not imply endorsement by the people shown.
- This library intentionally excludes image URLs hosted on plus.unsplash.com as a conservative filter against Unsplash+ results.

## Review files

- manifest.json
- manifest.csv
- review.html
`;

  await fs.writeFile(manifestJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(manifestCsvPath, buildCsv(selected));
  await fs.writeFile(reviewHtmlPath, buildReviewHtml(selected));
  await fs.writeFile(noticePath, notice);

  console.log(`Sourced ${selected.length} images into ${outputRoot}`);
  console.log(`Category counts: ${JSON.stringify(Object.fromEntries(categoryCounts))}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
