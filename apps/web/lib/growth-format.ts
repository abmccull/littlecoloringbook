/**
 * Shared formatting helpers for the /admin/growth/* pages.
 * All functions are pure — safe to call in both server and client components.
 */

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const NUM_COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Formats a cent value as "$1,234.56" */
export function formatMoney(cents: number): string {
  return USD.format(cents / 100);
}

/** Formats a cent value as "$1.2K" etc. */
export function formatMoneyCompact(cents: number): string {
  return USD_COMPACT.format(cents / 100);
}

/** Formats a decimal ratio as "12.3%" */
export function formatPct(ratio: number | null | undefined): string {
  if (ratio == null) return "—";
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Formats a ROAS number as "3.4×" */
export function formatRoas(roas: number | null | undefined): string {
  if (roas == null) return "—";
  return `${roas.toFixed(2)}×`;
}

/** Formats a large integer with compact notation */
export function formatNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return NUM_COMPACT.format(n);
}

/** Formats a Date or ISO string as "Apr 17 · 2:30 PM" */
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(typeof d === "string" ? new Date(d) : d);
}

/** Formats a Date or ISO string as "Apr 17" */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(typeof d === "string" ? new Date(d) : d);
}

/** Returns YYYY-MM-DD string for N days ago */
export function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Returns today's YYYY-MM-DD string */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
