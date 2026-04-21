import "server-only";

import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import {
  assets,
  broadcastSends,
  customers,
  generationPages,
  getDatabase,
  isDatabaseConfigured,
  orders,
} from "@littlecolorbook/db";
import { generateId } from "@littlecolorbook/shared";

const SUNDAY_LOOKBACK_DAYS = 7;
const THURSDAY_LOOKBACK_DAYS = 14;
const FAMILY_COOLDOWN_DAYS = 56;
const PAGE_COOLDOWN_DAYS = 28;
const SUNDAY_MIN_QA_SCORE = 0.85;
const THURSDAY_MIN_QA_SCORE = 0.78;
const THURSDAY_MIN_PAGES = 4;
const THURSDAY_MAX_PAGES = 6;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Next UTC date at the given day-of-week (0=Sun, 6=Sat) and hour where
 * the returned timestamp is at least `minLeadHours` in the future.
 */
export function nextUtcWeekdayAt({
  dayOfWeek,
  hourUtc,
  minLeadHours,
}: {
  dayOfWeek: number;
  hourUtc: number;
  minLeadHours: number;
}): Date {
  const now = new Date();
  const candidate = new Date(now);
  candidate.setUTCHours(hourUtc, 0, 0, 0);
  // Move forward to the next matching day-of-week
  const dayDiff = (dayOfWeek - candidate.getUTCDay() + 7) % 7;
  if (dayDiff > 0) candidate.setUTCDate(candidate.getUTCDate() + dayDiff);
  // If still not far enough ahead, jump a week
  while (candidate.getTime() - now.getTime() < minLeadHours * 60 * 60 * 1000) {
    candidate.setUTCDate(candidate.getUTCDate() + 7);
  }
  return candidate;
}

export type FamilyFeatureCandidate = {
  orderId: string;
  customerId: string;
  customerEmail: string;
  childFirstName: string | null;
  assetObjectPath: string;
  pageNumber: number;
  qaScore: number;
  deliveredAt: Date;
};

export type GalleryPageCandidate = {
  orderId: string;
  customerId: string;
  assetObjectPath: string;
  qaScore: number;
  childFirstName: string | null;
};

async function getRecentlyFeaturedIds() {
  if (!isDatabaseConfigured()) {
    return { customerIds: new Set<string>(), pageObjectPaths: new Set<string>() };
  }

  const db = getDatabase();
  const recent = await db
    .select({ selection: broadcastSends.selection, createdAt: broadcastSends.createdAt })
    .from(broadcastSends)
    .where(gte(broadcastSends.createdAt, daysAgo(FAMILY_COOLDOWN_DAYS)));

  const customerIds = new Set<string>();
  const pageObjectPaths = new Set<string>();

  for (const row of recent) {
    const selection = row.selection as
      | { familyCustomerId?: string; pageObjectPaths?: string[] }
      | null;
    if (!selection) continue;
    if (selection.familyCustomerId) customerIds.add(selection.familyCustomerId);
    if (Array.isArray(selection.pageObjectPaths)) {
      for (const path of selection.pageObjectPaths) {
        if (daysAgo(PAGE_COOLDOWN_DAYS) <= row.createdAt) pageObjectPaths.add(path);
      }
    }
  }

  return { customerIds, pageObjectPaths };
}

/**
 * Pick the Sunday Show-Off family. Returns null if nothing qualifies —
 * caller should skip the send or fall back to evergreen library.
 */
export async function selectSundayFamily(): Promise<FamilyFeatureCandidate | null> {
  if (!isDatabaseConfigured()) return null;

  const db = getDatabase();
  const { customerIds: cooldownCustomers } = await getRecentlyFeaturedIds();

  const whereClauses = [
    eq(orders.status, "delivered"),
    gte(orders.updatedAt, daysAgo(SUNDAY_LOOKBACK_DAYS)),
    eq(customers.marketingOptIn, true),
    eq(customers.featureConsent, true),
    gte(generationPages.qaScore, SUNDAY_MIN_QA_SCORE),
    isNotNull(generationPages.assetId),
  ];

  if (cooldownCustomers.size > 0) {
    whereClauses.push(sql`${orders.customerId} NOT IN (${sql.raw([...cooldownCustomers].map((id) => `'${id.replace(/'/g, "''")}'`).join(","))})`);
  }

  const rows = await db
    .select({
      orderId: orders.id,
      customerId: orders.customerId,
      customerEmail: customers.email,
      childFirstName: orders.childFirstName,
      assetObjectPath: assets.objectPath,
      pageNumber: generationPages.pageNumber,
      qaScore: generationPages.qaScore,
      deliveredAt: orders.updatedAt,
    })
    .from(generationPages)
    .innerJoin(assets, eq(generationPages.assetId, assets.id))
    .innerJoin(orders, eq(assets.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...whereClauses))
    .orderBy(desc(generationPages.qaScore))
    .limit(1);

  const row = rows[0];
  if (!row?.customerId || !row.qaScore) return null;

  return {
    orderId: row.orderId,
    customerId: row.customerId,
    customerEmail: row.customerEmail,
    childFirstName: row.childFirstName,
    assetObjectPath: row.assetObjectPath,
    pageNumber: row.pageNumber,
    qaScore: row.qaScore,
    deliveredAt: row.deliveredAt,
  };
}

/**
 * Pick 4-6 distinct family pages for the Thursday Gallery. Returns empty
 * list if fewer than THURSDAY_MIN_PAGES qualify.
 */
export async function selectThursdayGallery(): Promise<GalleryPageCandidate[]> {
  if (!isDatabaseConfigured()) return [];

  const db = getDatabase();
  const { pageObjectPaths: cooldownPages } = await getRecentlyFeaturedIds();

  const whereClauses = [
    eq(orders.status, "delivered"),
    gte(orders.updatedAt, daysAgo(THURSDAY_LOOKBACK_DAYS)),
    eq(customers.marketingOptIn, true),
    eq(customers.featureConsent, true),
    gte(generationPages.qaScore, THURSDAY_MIN_QA_SCORE),
    isNotNull(generationPages.assetId),
  ];

  const rows = await db
    .select({
      orderId: orders.id,
      customerId: orders.customerId,
      assetObjectPath: assets.objectPath,
      qaScore: generationPages.qaScore,
      childFirstName: orders.childFirstName,
    })
    .from(generationPages)
    .innerJoin(assets, eq(generationPages.assetId, assets.id))
    .innerJoin(orders, eq(assets.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...whereClauses))
    .orderBy(desc(generationPages.qaScore))
    .limit(40);

  const seenCustomers = new Set<string>();
  const chosen: GalleryPageCandidate[] = [];

  for (const row of rows) {
    if (!row.customerId || !row.qaScore) continue;
    if (cooldownPages.has(row.assetObjectPath)) continue;
    if (seenCustomers.has(row.customerId)) continue;
    seenCustomers.add(row.customerId);
    chosen.push({
      orderId: row.orderId,
      customerId: row.customerId,
      assetObjectPath: row.assetObjectPath,
      qaScore: row.qaScore,
      childFirstName: row.childFirstName,
    });
    if (chosen.length >= THURSDAY_MAX_PAGES) break;
  }

  return chosen.length >= THURSDAY_MIN_PAGES ? chosen : [];
}

export async function recordBroadcastDraft(input: {
  archetype: "sunday_show_off" | "thursday_gallery";
  resendBroadcastId: string | null;
  resendAudienceId: string | null;
  subject: string;
  preheader: string;
  scheduledFor: Date;
  contactsCount: number | null;
  selection: Record<string, unknown>;
  payload: Record<string, unknown>;
}): Promise<string> {
  if (!isDatabaseConfigured()) return "demo";

  const db = getDatabase();
  const id = generateId("bsd");
  await db.insert(broadcastSends).values({
    id,
    archetype: input.archetype,
    status: input.resendBroadcastId ? "scheduled" : "drafted",
    resendBroadcastId: input.resendBroadcastId,
    resendAudienceId: input.resendAudienceId,
    subject: input.subject,
    preheader: input.preheader,
    scheduledFor: input.scheduledFor,
    contactsCount: input.contactsCount,
    selection: input.selection,
    payload: input.payload,
  });
  return id;
}

/**
 * Guard: don't fire the same archetype twice within a short window.
 * Checks the most-recent broadcast_sends row for this archetype and
 * returns true if the system already scheduled or sent one recently.
 */
export async function hasRecentBroadcast(input: {
  archetype: "sunday_show_off" | "thursday_gallery";
  windowHours: number;
}): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;

  const db = getDatabase();
  const threshold = new Date(Date.now() - input.windowHours * 60 * 60 * 1000);

  const rows = await db
    .select({ id: broadcastSends.id })
    .from(broadcastSends)
    .where(
      and(
        eq(broadcastSends.archetype, input.archetype),
        gte(broadcastSends.createdAt, threshold),
        inArray(broadcastSends.status, ["scheduled", "sent", "sending"]),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
