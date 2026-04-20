import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  countSamplesByEmail,
  countSamplesByIp,
  countSamplesByVisitor,
  createPortalAccessForOrder,
  createOrderDraft,
  findSampleResumeCandidate,
  getOrderPortalSummaryByOrderId,
  isDatabaseConfigured,
} from "@littlecolorbook/db";
import { readAttributionSnapshot } from "../../../lib/attribution-cookies";
import { extractClientIp } from "../../../lib/request-ip";
import { getSampleIpWindowStart, getSampleResumeUrl } from "../../../lib/sample-funnel";
import { evaluateSampleLimit, getSampleLimitPolicy } from "../../../lib/sample-limits";
import { updateOrderFeatureConsent } from "@littlecolorbook/db";

const createSampleSchema = z.object({
  email: z.string().email(),
  childFirstName: z.string().trim().min(1).max(80).optional(),
  acquisitionPath: z.string().trim().optional(),
  entrySource: z.string().trim().optional(),
  utmSource: z.string().trim().optional(),
  utmMedium: z.string().trim().optional(),
  utmCampaign: z.string().trim().optional(),
  utmContent: z.string().trim().optional(),
  utmTerm: z.string().trim().optional(),
  /**
   * Opt-in consent to feature the resulting source photo + coloring
   * page in the creative library, ads, gallery, emails. False when
   * omitted — consent is strictly opt-in.
   */
  featureConsent: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSampleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid sample request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured() && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const attribution = readAttributionSnapshot(request);
  const clientIp = extractClientIp(request);
  const policy = getSampleLimitPolicy();

  const resumeCandidate = await findSampleResumeCandidate({
    email: parsed.data.email,
    visitorId: attribution.visitorId,
  });

  if (resumeCandidate) {
    const [portalAccess, summary] = await Promise.all([
      createPortalAccessForOrder(resumeCandidate.orderId),
      getOrderPortalSummaryByOrderId(resumeCandidate.orderId),
    ]);

    if (!portalAccess || !summary) {
      return NextResponse.json(
        { error: "Could not resume the existing free sample." },
        { status: 500 },
      );
    }

    const processingUrl = `/sample/processing?token=${encodeURIComponent(portalAccess.portalToken)}`;
    const readyUrl = `/sample/${portalAccess.portalToken}`;
    const resumeUrl = getSampleResumeUrl({
      orderId: summary.order.id,
      portalToken: portalAccess.portalToken,
      status: summary.order.status,
      hasPreviewAsset: Boolean(summary.assets.previewPath),
    });

    return NextResponse.json({
      id: summary.order.id,
      status: summary.order.status,
      type: summary.order.orderType,
      email: summary.customer?.email ?? parsed.data.email,
      childFirstName: summary.order.childFirstName,
      portalToken: portalAccess.portalToken,
      portalUrl: portalAccess.portalHref,
      processingUrl,
      readyUrl,
      resumeUrl,
      resumed: true,
      resumedBy: resumeCandidate.matchedBy,
      reason: "resume_existing_sample",
      databaseConfigured: portalAccess.databaseConfigured,
      jobQueued: false,
    });
  }

  const ipWindowStart =
    clientIp !== "unknown" ? getSampleIpWindowStart(policy.ipWindowDays) : null;

  // Abuse protection: 1 sample per email, 1 active sample per browser, capped per IP in a rolling window.
  const [emailCount, visitorCount, ipCount] = await Promise.all([
    countSamplesByEmail(parsed.data.email),
    attribution.visitorId ? countSamplesByVisitor(attribution.visitorId) : Promise.resolve(0),
    clientIp !== "unknown"
      ? countSamplesByIp(clientIp, { createdAfter: ipWindowStart })
      : Promise.resolve(0),
  ]);

  const limitEvaluation = evaluateSampleLimit({
    email: parsed.data.email,
    visitorId: attribution.visitorId,
    clientIp,
    counts: {
      emailCount,
      visitorCount,
      ipCount,
    },
    policy,
  });

  if (limitEvaluation.blocked) {
    return NextResponse.json(
      {
        blocked: true,
        reason: "sample_limit_reached",
        blockedBy: limitEvaluation.blockedBy,
        limits: limitEvaluation.limits,
      },
      { status: 429 },
    );
  }

  const lastTouch = attribution.lastTouch ?? attribution.firstTouch;
  const result = await createOrderDraft({
    email: parsed.data.email,
    orderType: "sample",
    deliveryMode: "sample",
    visitorId: attribution.visitorId,
    sessionId: attribution.sessionId,
    acquisitionPath: parsed.data.acquisitionPath ?? "sample_first",
    entrySource: parsed.data.entrySource ?? null,
    landingPath: attribution.firstTouch?.landingPath ?? lastTouch?.landingPath ?? null,
    firstTouch: attribution.firstTouch,
    lastTouch,
    utmSource: lastTouch?.utmSource ?? parsed.data.utmSource ?? null,
    utmMedium: lastTouch?.utmMedium ?? parsed.data.utmMedium ?? null,
    utmCampaign: lastTouch?.utmCampaign ?? parsed.data.utmCampaign ?? null,
    utmContent: lastTouch?.utmContent ?? parsed.data.utmContent ?? null,
    utmTerm: lastTouch?.utmTerm ?? parsed.data.utmTerm ?? null,
    selectedOfferCode: "sample-free",
    designCount: 1,
    childFirstName: parsed.data.childFirstName ?? null,
    dedicationText: null,
    subtotalCents: 0,
    shippingCents: 0,
    totalCents: 0,
    clientIp,
  });

  if (parsed.data.featureConsent && result.order.id) {
    try {
      await updateOrderFeatureConsent(result.order.id, true);
    } catch (error) {
      console.error("samples: failed to record feature consent", error);
    }
  }

  return NextResponse.json({
    id: result.order.id,
    status: result.order.status,
    type: result.order.orderType,
    email: result.customer.email,
    childFirstName: result.order.childFirstName,
    portalToken: result.portalToken,
    portalUrl: result.portalUrl,
    processingUrl: `/sample/processing?token=${encodeURIComponent(result.portalToken)}`,
    readyUrl: `/sample/${result.portalToken}`,
    databaseConfigured: result.databaseConfigured,
    jobQueued: false,
  });
}
