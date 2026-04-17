import { NextRequest, NextResponse } from "next/server";
import { findInactiveCustomersSince } from "@littlecolorbook/db";
import { authorizeInternalJobRequest } from "../../../../lib/internal-jobs";
import { enrollInReEngagement } from "../../../../lib/sequence-enrollment";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const LAPSED_DAYS = 90;

export async function GET(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);
  if (unauthorized) return unauthorized;

  const cutoff = new Date(Date.now() - LAPSED_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await findInactiveCustomersSince({ lastOrderBefore: cutoff, limit: 100 });

  let enrolled = 0;
  for (const c of candidates) {
    try {
      await enrollInReEngagement({ customerId: c.customerId });
      enrolled += 1;
    } catch (error) {
      console.error("re-engagement-sweep: enroll failed", c.customerId, error);
    }
  }

  return NextResponse.json({
    accepted: true,
    candidatesFound: candidates.length,
    enrolled,
    cutoff: cutoff.toISOString(),
  });
}
