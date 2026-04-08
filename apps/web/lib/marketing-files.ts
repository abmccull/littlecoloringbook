import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

let cachedRepoRoot: string | null = null;

function isRepoRoot(candidate: string) {
  const packageJsonPath = path.join(candidate, "package.json");

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string };
    return parsed.name === "littlecolorbook";
  } catch {
    return false;
  }
}

function getRepoRoot() {
  if (cachedRepoRoot) {
    return cachedRepoRoot;
  }

  let candidate = process.cwd();

  for (let depth = 0; depth < 5; depth += 1) {
    if (isRepoRoot(candidate)) {
      cachedRepoRoot = candidate;
      return cachedRepoRoot;
    }

    const parent = path.dirname(candidate);

    if (parent === candidate) {
      break;
    }

    candidate = parent;
  }

  cachedRepoRoot = path.resolve(process.cwd(), "..", "..");
  return cachedRepoRoot;
}

export function getMarketingRoot() {
  return path.join(getRepoRoot(), "marketing");
}

export function resolveMarketingPath(relativePath: string) {
  return path.join(getMarketingRoot(), relativePath);
}

async function ensureParentDirectory(targetFilePath: string) {
  await mkdir(path.dirname(targetFilePath), { recursive: true });
}

export async function writeMarketingJson(relativePath: string, payload: unknown) {
  const filePath = resolveMarketingPath(relativePath);
  await ensureParentDirectory(filePath);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

export async function readMarketingJson<T>(relativePath: string) {
  const filePath = resolveMarketingPath(relativePath);

  try {
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function writeMarketingMarkdown(relativePath: string, markdown: string) {
  const filePath = resolveMarketingPath(relativePath);
  await ensureParentDirectory(filePath);
  await writeFile(filePath, `${markdown.trimEnd()}\n`, "utf8");
  return filePath;
}

export async function queueMarketingPayload(queueName: string, fileId: string, payload: unknown) {
  return writeMarketingJson(path.join("queues", queueName, `${fileId}.json`), payload);
}

export function formatIsoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
