import { NextResponse } from "next/server";
import { redactCustomerData } from "@littlecolorbook/db";
import { getCustomerSession } from "../../../../lib/auth";
import { removeContactFromAudience } from "../../../../lib/resend-audiences";

export async function POST() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Try to remove from Resend Audience first (best-effort).
  await removeContactFromAudience(session.email).catch(() => null);

  const result = await redactCustomerData(session.customerId);

  // Note: we do NOT auto-revoke the Neon Auth session here. The customer
  // can sign out manually, and their Neon user record will hold a
  // redacted email+link going forward. Hard-delete of the Neon user is
  // an admin-only operation today.

  return NextResponse.json({ ok: true, redacted: result });
}
