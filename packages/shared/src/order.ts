export const orderStatuses = [
  "draft",
  "awaiting_payment",
  "paid",
  "preprocessing",
  "generating",
  "qa_review",
  "assembling_pdf",
  "pdf_ready",
  "awaiting_print_submission",
  "submitted_to_lulu",
  "in_production",
  "shipped",
  "delivered",
  "failed",
  "support_required",
  "refunded",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export type DeliveryMode = "pdf" | "print";

export type OrderType = "sample" | "pdf" | "print";

export function estimateInteriorPageCount(designCount: number) {
  const contentPages = Math.max(1, Math.trunc(designCount)) + 2;
  return contentPages % 2 === 0 ? contentPages : contentPages + 1;
}
