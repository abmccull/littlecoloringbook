import "server-only";

import Stripe from "stripe";
import { getAppUrlEnv } from "@littlecolorbook/shared/env";

const stripeApiVersion = "2026-02-25.clover";

let stripeClient: Stripe | undefined;
let stripeAccountIdPromise: Promise<string> | undefined;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && getStripePublishableKey() && process.env.APP_URL);
}

export function getAppUrl() {
  if (process.env.APP_URL) {
    return getAppUrlEnv().appUrl;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL must be configured in production.");
  }

  return "http://localhost:3000";
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET;
}

export function getStripePublishableKey() {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY ?? null;
}

export function getExpectedStripeAccountId() {
  return process.env.STRIPE_ACCOUNT_ID ?? null;
}

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: stripeApiVersion,
    });
  }

  return stripeClient;
}

export async function getVerifiedStripeAccountId() {
  if (!stripeAccountIdPromise) {
    stripeAccountIdPromise = getStripe()
      .accounts.retrieve(null)
      .then((account) => account.id);
  }

  const liveAccountId = await stripeAccountIdPromise;
  const expectedAccountId = getExpectedStripeAccountId();

  if (expectedAccountId && liveAccountId !== expectedAccountId) {
    throw new Error(`Stripe account mismatch. Expected ${expectedAccountId}, received ${liveAccountId}.`);
  }

  return liveAccountId;
}
