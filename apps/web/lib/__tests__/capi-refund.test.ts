import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@littlecolorbook/db", () => ({
  getCapiEventByEventId: vi.fn(),
  getOrderPortalSummaryByOrderId: vi.fn(async () => null),
  insertCapiEvent: vi.fn(),
  isDatabaseConfigured: vi.fn(() => true),
  updateCapiEventStatus: vi.fn(),
}));

vi.mock("@littlecolorbook/meta", () => ({
  buildNormalizedUserData: vi.fn(() => ({ external_id: ["ord_123"] })),
  sendCapiEvent: vi.fn(),
}));

vi.mock("../internal-jobs", () => ({
  enqueueInternalJob: vi.fn(),
}));

import {
  getCapiEventByEventId,
  insertCapiEvent,
  updateCapiEventStatus,
} from "@littlecolorbook/db";
import { enqueueInternalJob } from "../internal-jobs";
import { enqueueRefundCapiEvent } from "../capi-refund";

describe("enqueueRefundCapiEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCapiEventByEventId).mockResolvedValue(null);
    vi.mocked(insertCapiEvent).mockResolvedValue({
      id: "capi_refund_row",
      status: "queued",
    } as never);
    vi.mocked(enqueueInternalJob).mockResolvedValue({
      accepted: true,
      mode: "direct",
      jobId: null,
      queueName: null,
      status: "sent",
    });
  });

  it("no-ops duplicate refund notifications once the event already exists", async () => {
    const existing = {
      id: "capi_existing_refund",
      status: "queued",
      eventId: "refund_rf_123",
    };
    vi.mocked(getCapiEventByEventId).mockResolvedValue(existing as never);

    const result = await enqueueRefundCapiEvent({
      orderId: "ord_123",
      refundId: "rf_123",
      refundAmountCents: 1900,
    });

    expect(result).toBe(existing);
    expect(insertCapiEvent).not.toHaveBeenCalled();
    expect(enqueueInternalJob).not.toHaveBeenCalled();
    expect(updateCapiEventStatus).not.toHaveBeenCalled();
  });

  it("requeues a previously failed refund event instead of inserting a duplicate", async () => {
    const existing = {
      id: "capi_existing_refund",
      status: "failed",
      eventId: "refund_rf_123",
    };
    vi.mocked(getCapiEventByEventId).mockResolvedValue(existing as never);

    const result = await enqueueRefundCapiEvent({
      orderId: "ord_123",
      refundId: "rf_123",
      refundAmountCents: 1900,
    });

    expect(result).toBe(existing);
    expect(insertCapiEvent).not.toHaveBeenCalled();
    expect(updateCapiEventStatus).toHaveBeenCalledWith("capi_existing_refund", {
      status: "queued",
      errorMessage: null,
    });
    expect(enqueueInternalJob).toHaveBeenCalledWith({
      job: "process-capi-event",
      payload: { capiEventId: "capi_existing_refund" },
      fallbackToDirectOnQueueError: true,
    });
  });

  it("persists a new refund event with a deterministic event id and negative value", async () => {
    await enqueueRefundCapiEvent({
      orderId: "ord_123",
      refundId: "rf_123",
      refundAmountCents: 1900,
      currency: "USD",
      eventSourceUrl: "https://www.littlecolorbook.com/thanks",
    });

    expect(insertCapiEvent).toHaveBeenCalledTimes(1);
    const inserted = vi.mocked(insertCapiEvent).mock.calls[0]?.[0];
    expect(inserted?.eventId).toBe("refund_rf_123");
    expect(inserted?.payloadJson).toMatchObject({
      event_id: "refund_rf_123",
      event_name: "Refund",
      event_source_url: "https://www.littlecolorbook.com/thanks",
      custom_data: {
        value: -19,
        currency: "USD",
        order_id: "ord_123",
        refund_id: "rf_123",
      },
    });
  });
});
