import "server-only";

import {
  enrollCustomerInSequence,
  type EmailSequenceKey,
} from "@littlecolorbook/db";
import { computeNextSendAt, type SequenceKey } from "@littlecolorbook/email";
import { getAppUrl } from "./stripe";

function isSequenceKey(value: string): value is SequenceKey {
  return value === "welcome" || value === "post_purchase" || value === "re_engagement" || value === "abandonment";
}

export async function enrollInWelcome(input: {
  customerId: string;
  sampleUrl?: string | null;
}) {
  const sequence: EmailSequenceKey = "welcome";
  const nextSendAt = computeNextSendAt(sequence, 1, new Date());
  if (!nextSendAt) return null;
  return enrollCustomerInSequence({
    customerId: input.customerId,
    sequence,
    nextSendAt,
    metadata: {
      sampleUrl: input.sampleUrl ?? null,
      sampleUrlNew: `${getAppUrl()}/sample`,
      shopUrl: `${getAppUrl()}/create?source=welcome`,
      accountUrl: `${getAppUrl()}/account`,
      offerCode: "FIRSTBOOK10",
      offerLabel: "10% off your first book",
      offerExpiresLabel: "for the next 14 days",
    },
  });
}

export async function enrollInPostPurchase(input: {
  customerId: string;
  orderId: string;
}) {
  const sequence: EmailSequenceKey = "post_purchase";
  const nextSendAt = computeNextSendAt(sequence, 1, new Date());
  if (!nextSendAt) return null;
  return enrollCustomerInSequence({
    customerId: input.customerId,
    sequence,
    nextSendAt,
    metadata: {
      orderId: input.orderId,
      orderUrl: `${getAppUrl()}/account/orders/${input.orderId}`,
      accountUrl: `${getAppUrl()}/account`,
      shopUrl: `${getAppUrl()}/create?source=post-purchase`,
      offerCode: "REPEAT15",
      offerLabel: "15% off your second book",
      offerExpiresLabel: "for the next 14 days",
    },
  });
}

export async function enrollInReEngagement(input: { customerId: string }) {
  const sequence: EmailSequenceKey = "re_engagement";
  const nextSendAt = computeNextSendAt(sequence, 1, new Date());
  if (!nextSendAt) return null;
  return enrollCustomerInSequence({
    customerId: input.customerId,
    sequence,
    nextSendAt,
    metadata: {
      accountUrl: `${getAppUrl()}/account`,
      shopUrl: `${getAppUrl()}/create?source=re-engagement`,
      offerCode: "COMEBACK20",
      offerLabel: "20% off any book",
      offerExpiresLabel: "through Sunday",
    },
  });
}

export async function enrollInAbandonment(input: {
  customerId: string;
  orderId: string;
  checkoutResumeUrl?: string | null;
}) {
  const sequence: EmailSequenceKey = "abandonment";
  const nextSendAt = computeNextSendAt(sequence, 1, new Date());
  if (!nextSendAt) return null;
  return enrollCustomerInSequence({
    customerId: input.customerId,
    sequence,
    nextSendAt,
    metadata: {
      orderId: input.orderId,
      checkoutResumeUrl: input.checkoutResumeUrl ?? `${getAppUrl()}/create?resume=${input.orderId}`,
      accountUrl: `${getAppUrl()}/account`,
      shopUrl: `${getAppUrl()}/create?source=abandonment`,
      offerCode: "FINISHORDER10",
      offerLabel: "10% off finish-your-order",
      offerExpiresLabel: "for 48 hours",
    },
    // Re-enroll if the customer starts + abandons a second checkout.
    resetIfExists: true,
  });
}

export { isSequenceKey };
