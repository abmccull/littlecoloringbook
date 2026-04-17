import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateMarketingConsent } from "@littlecolorbook/db";
import { getCustomerSession } from "../../../../lib/auth";
import { syncCustomerToAudience, isResendAudiencesConfigured } from "../../../../lib/resend-audiences";

const consentSchema = z.object({
  marketingOptIn: z.boolean().optional(),
  featureConsent: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = consentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  // If featureConsent is on, marketingOptIn must also be on.
  const marketingOptIn = parsed.data.marketingOptIn ?? undefined;
  const featureConsent = parsed.data.featureConsent ?? undefined;
  const effectiveFeatureConsent =
    featureConsent !== undefined && marketingOptIn === false ? false : featureConsent;

  const updated = await updateMarketingConsent({
    customerId: session.customerId,
    marketingOptIn,
    featureConsent: effectiveFeatureConsent,
  });

  if (isResendAudiencesConfigured() && updated) {
    await syncCustomerToAudience({
      customerId: session.customerId,
      email: session.email,
      firstName: updated.firstName ?? session.displayName ?? null,
      marketingOptIn: Boolean(updated.marketingOptIn),
    });
  }

  return NextResponse.json({
    ok: true,
    marketingOptIn: updated?.marketingOptIn ?? null,
    featureConsent: updated?.featureConsent ?? null,
  });
}
