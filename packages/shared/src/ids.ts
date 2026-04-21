import { randomUUID } from "node:crypto";

/**
 * Prefixed, hyphen-free UUID v4 hex. Format: `{prefix}_{32hex}`.
 * Centralized here so every call site produces the same ID shape
 * (previously duplicated in ~8 API routes and lib files).
 */
export function generateId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

/** 24 hours in ms. Use with `new Date(Date.now() + EXPIRY_24H_MS)`. */
export const EXPIRY_24H_MS = 24 * 60 * 60 * 1000;
