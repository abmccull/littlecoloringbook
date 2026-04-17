import "server-only";

import {
  findCustomerUserLinkByCustomerId,
  type CustomerUserLinkSource,
} from "@littlecolorbook/db";
import { isAuthConfigured } from "./auth-client";
import { sendSignInOtp } from "./neon-auth";

export type EnsureAccountResult = {
  status: "created" | "already_linked" | "skipped" | "error";
  magicLinkSent: boolean;
  reason?: string;
};

/**
 * Post-checkout auto-account creation.
 *
 * We cannot pre-create a user server-side without triggering an email on
 * Neon Auth today (admin plugin not exposed in the beta), so this function
 * kicks off the magic-link sign-in flow. Better Auth creates the user on
 * the first magic-link request. The customer_user_links row is written
 * later, when they click the link and first sign in (see
 * getCustomerSession → linkStackUserToCustomerByEmail).
 */
export async function ensureCustomerAccount(input: {
  email: string;
  customerId: string;
  displayName?: string | null;
  source?: CustomerUserLinkSource;
  sendMagicLink?: boolean;
  callbackURL?: string;
}): Promise<EnsureAccountResult> {
  if (!isAuthConfigured()) {
    return { status: "skipped", magicLinkSent: false, reason: "auth_not_configured" };
  }

  const existingLink = await findCustomerUserLinkByCustomerId(input.customerId);
  if (existingLink) {
    return { status: "already_linked", magicLinkSent: false };
  }

  if (input.sendMagicLink === false) {
    return { status: "skipped", magicLinkSent: false, reason: "magic_link_disabled" };
  }

  const result = await sendSignInOtp({ email: input.email });

  if (!result.ok) {
    console.error("ensureCustomerAccount: magic link failed", result);
    return { status: "error", magicLinkSent: false, reason: result.error };
  }

  return { status: "created", magicLinkSent: true };
}
