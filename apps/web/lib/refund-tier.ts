import "server-only";

import type { PortalSummary } from "@littlecolorbook/db";
import { estimateLuluBookCostCents } from "@littlecolorbook/shared";

export type RefundPolicyTier =
  | "full_pre_lulu"
  | "full_digital"
  | "partial_in_production"
  | "full_shipped_quality"
  | "replacement_shipped_quality"
  | "replacement_shipping_damage"
  | "store_credit_change_of_mind"
  | "manual";

export type RefundCategory =
  | "customer_request_no_questions"
  | "print_quality"
  | "shipping_damage"
  | "shipping_lost"
  | "duplicate_charge"
  | "fraud"
  | "admin_discretion"
  | "other";

export type RefundTierDecision = {
  tier: RefundPolicyTier;
  amountCents: number;
  autoApprove: boolean;
  cancelLulu: boolean;
  customerFacingSummary: string;
  requiresPhoto?: boolean;
  replacementOnly?: boolean;
};

/**
 * Resolve the Lulu production cost for an order. Prefers the actual cost
 * passed in by the caller (looked up server-side from fulfillment_jobs
 * or shipping_quotes). Falls back to the shared cost formula using the
 * order's real page count and quantity — never to a flat percentage of
 * revenue. Lulu cost is cost-of-goods data that must not leak to the
 * customer-facing PortalSummary, so we accept it as a separate arg.
 */
function resolveLuluProductionCents(
  summary: PortalSummary,
  luluProductionCostCents: number | null | undefined,
): number {
  if (typeof luluProductionCostCents === "number" && luluProductionCostCents > 0) {
    return luluProductionCostCents;
  }
  return estimateLuluBookCostCents(summary.order.designCount, summary.order.quantity);
}

function fullAmountRemaining(summary: PortalSummary, alreadyRefundedCents: number): number {
  return Math.max(0, summary.order.totalCents - alreadyRefundedCents);
}

/**
 * Map an order's current state + the customer's requested reason into a
 * concrete refund tier with amount + approval policy.
 *
 * This is pure/deterministic. Admins can override the decision with
 * `admin_discretion` or pick a different tier manually.
 */
export function computeRefundTier(input: {
  summary: PortalSummary;
  reason: RefundCategory;
  alreadyRefundedCents: number;
  /**
   * Real Lulu production cost for this order in cents, resolved server-
   * side (fulfillment_jobs.cost_cents > shipping_quotes.quote_payload).
   * Pass null/undefined to fall back to the shared cost formula. This
   * field is server-only — do not echo it back to the customer.
   */
  luluProductionCostCents?: number | null;
}): RefundTierDecision {
  const { summary, reason } = input;
  const status = summary.order.status;
  const deliveryMode = summary.order.deliveryMode;
  const full = fullAmountRemaining(summary, input.alreadyRefundedCents);

  // Pre-Lulu: full refund + cancel the pipeline. Safe default for any
  // order that hasn't reached the printer yet.
  if (["paid", "preprocessing", "generating", "qa_review", "assembling_pdf"].includes(status)) {
    return {
      tier: "full_pre_lulu",
      amountCents: full,
      autoApprove: true,
      cancelLulu: false,
      customerFacingSummary:
        "Full refund. Your book hasn't been sent to the printer yet, so we'll cancel the job and refund in full.",
    };
  }

  // PDF-ready, PDF-only order → full refund. PDF stays theirs (can't
  // un-deliver digital goods meaningfully).
  if (status === "pdf_ready" && deliveryMode === "pdf") {
    return {
      tier: "full_digital",
      amountCents: full,
      autoApprove: true,
      cancelLulu: false,
      customerFacingSummary: "Full refund. The PDF is still yours to keep.",
    };
  }

  // PDF-ready but print — we can still cancel the Lulu submission.
  if (status === "pdf_ready" && deliveryMode === "print") {
    return {
      tier: "full_pre_lulu",
      amountCents: full,
      autoApprove: true,
      cancelLulu: false,
      customerFacingSummary:
        "Full refund. Pages are generated but we haven't submitted the print job yet, so we'll cancel before it goes to press.",
    };
  }

  // Awaiting print submission → same as pre-Lulu.
  if (status === "awaiting_print_submission") {
    return {
      tier: "full_pre_lulu",
      amountCents: full,
      autoApprove: true,
      cancelLulu: false,
      customerFacingSummary: "Full refund. The print job hasn't been submitted yet.",
    };
  }

  // Submitted to Lulu — within the 2h cancel window Lulu gives us.
  // We don't track exact submission time here (could be added), but if
  // status is `submitted_to_lulu` we optimistically try to cancel.
  if (status === "submitted_to_lulu") {
    return {
      tier: "full_pre_lulu",
      amountCents: full,
      autoApprove: false,
      cancelLulu: true,
      customerFacingSummary:
        "We're trying to cancel with the printer. If we catch it in time, full refund. If production started, refund minus the printing cost already incurred.",
    };
  }

  // In production — past the Lulu cancel window. Partial refund only,
  // unless it's a print quality complaint (which gets a replacement
  // OR a full refund per §2 of the spec).
  if (status === "in_production") {
    if (reason === "print_quality") {
      return {
        tier: "replacement_shipped_quality",
        amountCents: 0,
        autoApprove: false,
        cancelLulu: false,
        customerFacingSummary:
          "Replacement book at our cost. Send a photo of the page that missed when you receive the current book and we'll reprint.",
        requiresPhoto: true,
        replacementOnly: true,
      };
    }
    const partial = Math.max(0, full - resolveLuluProductionCents(summary, input.luluProductionCostCents));
    return {
      tier: "partial_in_production",
      amountCents: partial,
      autoApprove: false,
      cancelLulu: false,
      customerFacingSummary:
        "Partial refund. The book is being printed, so we'll refund everything minus the production cost already paid.",
    };
  }

  // Shipped or delivered. Tier depends on reason.
  if (status === "shipped" || status === "delivered") {
    if (reason === "shipping_damage") {
      return {
        tier: "replacement_shipping_damage",
        amountCents: 0,
        autoApprove: false,
        cancelLulu: false,
        customerFacingSummary:
          "Replacement book at our cost. Send a photo if you have one — shipping damage isn't your problem.",
        replacementOnly: true,
      };
    }
    if (reason === "print_quality") {
      return {
        tier: "full_shipped_quality",
        amountCents: full,
        autoApprove: false,
        cancelLulu: false,
        customerFacingSummary:
          "Full refund, or a free replacement — your pick. Send a photo of what went wrong within 30 days of delivery.",
        requiresPhoto: true,
      };
    }
    if (reason === "customer_request_no_questions") {
      return {
        tier: "store_credit_change_of_mind",
        amountCents: 0,
        autoApprove: false,
        cancelLulu: false,
        customerFacingSummary:
          "We don't take returns on custom printed books, but we can refund the PDF portion on request and usually offer 25% store credit on the print. Reply and we'll sort it.",
      };
    }
  }

  // Failed / support_required — assume we botched it; full refund.
  if (status === "failed" || status === "support_required") {
    return {
      tier: "full_pre_lulu",
      amountCents: full,
      autoApprove: true,
      cancelLulu: false,
      customerFacingSummary: "Full refund. Something went wrong on our end and we'll make it right.",
    };
  }

  return {
    tier: "manual",
    amountCents: full,
    autoApprove: false,
    cancelLulu: false,
    customerFacingSummary:
      "This one we'll look at by hand — support will follow up within 24 hours with the next step.",
  };
}
