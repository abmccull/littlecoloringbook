import { createHash } from "node:crypto";

const HEX_64_RE = /^[0-9a-f]{64}$/i;

function isAlreadyHashed(value: string): boolean {
  return HEX_64_RE.test(value);
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function hashIfNeeded(normalized: string): string {
  return isAlreadyHashed(normalized) ? normalized.toLowerCase() : sha256Hex(normalized);
}

export function normalizeEmail(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return undefined;
  return hashIfNeeded(trimmed);
}

export function normalizePhone(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (isAlreadyHashed(trimmed)) return trimmed.toLowerCase();
  // Strip all non-digits, then require at least 11 digits (country code + number).
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 11) return undefined;
  return sha256Hex(digits);
}

export function normalizeName(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return undefined;
  return hashIfNeeded(trimmed);
}

export function normalizeDob(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (isAlreadyHashed(trimmed)) return trimmed.toLowerCase();
  // Accept YYYYMMDD or YYYY-MM-DD; normalize to YYYYMMDD.
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length !== 8) return undefined;
  return sha256Hex(digits);
}

export function normalizeGender(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (isAlreadyHashed(trimmed)) return trimmed;
  // Meta expects 'm' or 'f'.
  const mapped = trimmed === "male" ? "m" : trimmed === "female" ? "f" : trimmed;
  if (mapped !== "m" && mapped !== "f") return undefined;
  return sha256Hex(mapped);
}

export function normalizeLocation(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return undefined;
  return hashIfNeeded(trimmed);
}
