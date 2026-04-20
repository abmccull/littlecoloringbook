/**
 * Lulu POD cost model for the coloring-book SKU.
 *
 * Numbers below come from real /print-job-cost-calculations/ API quotes
 * (POD 0850X1100BWSTDCO060UW444GXX, 8.5x11 coil-bound, B&W interior,
 * 60# uncoated white, gloss cover). Quoted 2026-04-19 for a US ship-to.
 *
 *   30 pages  -> $7.79 production + $0.75 fulfillment
 *   50 pages  -> $8.53 production + $0.75 fulfillment
 *   100 pages -> $10.38 production + $0.75 fulfillment
 *
 * Production cost fits a clean linear model across these three points:
 *   production = $6.68 base + $0.037 per page
 *
 * Use this helper only when a real per-job cost isn't available
 * (fulfillment_jobs.cost_cents is null, or we're pre-quoting before
 * the print job exists). Always prefer the persisted actual cost.
 */
export const LULU_COST_FORMULA_VERSION = "2026-04-19.a";
export const LULU_COST_BASE_CENTS = 668;
export const LULU_COST_PER_PAGE_CENTS_TIMES_TEN = 37;
export const LULU_FULFILLMENT_CENTS = 75;

export function estimateLuluBookProductionCents(pageCount: number): number {
  if (!Number.isFinite(pageCount) || pageCount <= 0) return 0;
  return Math.round(LULU_COST_BASE_CENTS + (LULU_COST_PER_PAGE_CENTS_TIMES_TEN * pageCount) / 10);
}

export function estimateLuluBookCostCents(pageCount: number, quantity = 1): number {
  if (!Number.isFinite(pageCount) || pageCount <= 0) return 0;
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const perBook = estimateLuluBookProductionCents(pageCount) + LULU_FULFILLMENT_CENTS;
  return perBook * quantity;
}
