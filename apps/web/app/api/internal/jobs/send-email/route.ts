import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deliverLifecycleEmail } from "../../../../../lib/lifecycle-email";
import { authorizeInternalJobRequest } from "../../../../../lib/internal-jobs";

const sendEmailSchema = z.object({
  orderId: z.string().trim().min(1),
  template: z.enum(["order-paid", "order-processing", "pdf-ready", "print-submitted", "order-shipped", "order-delivered"]),
  force: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const unauthorized = authorizeInternalJobRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = sendEmailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid lifecycle email request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await deliverLifecycleEmail(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lifecycle email failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
