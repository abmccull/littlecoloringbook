import type { OrderStatus } from "@littlecolorbook/db";

type SampleResumeDestinationInput = {
  orderId: string;
  portalToken: string;
  status: OrderStatus;
  hasPreviewAsset: boolean;
};

export function getSampleIpWindowStart(windowDays: number, now = new Date()) {
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);
  return windowStart;
}

export function getSampleResumeUrl(input: SampleResumeDestinationInput) {
  if (input.status === "pdf_ready" && input.hasPreviewAsset) {
    return `/sample/${encodeURIComponent(input.portalToken)}`;
  }

  const params = new URLSearchParams({
    token: input.portalToken,
    orderId: input.orderId,
  });
  return `/sample/processing?${params.toString()}`;
}
