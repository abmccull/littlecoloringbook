import { NextResponse } from "next/server";
import { requireAdminApiSession } from "../../../../lib/auth";
import { provisionMissingSequenceCoupons } from "../../../../lib/stripe-coupons";

export async function POST() {
  const session = await requireAdminApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await provisionMissingSequenceCoupons();
  return NextResponse.json({ results });
}
