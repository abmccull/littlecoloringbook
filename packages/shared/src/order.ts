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
  return designCount * 2 + 4;
}
