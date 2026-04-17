import "server-only";

import { createSignedDownloadUrl } from "@littlecolorbook/shared/storage";
import type { FamilyFeatureCandidate, GalleryPageCandidate } from "./newsletter-curator";

const BRAND_NAME = "Little Color Book";

async function signOrNull(objectPath: string | null | undefined): Promise<string | null> {
  if (!objectPath) return null;
  try {
    const signed = await createSignedDownloadUrl({
      bucket: "exports",
      objectPath,
      expiresInMinutes: 60 * 24 * 7,
    });
    return signed.url;
  } catch (error) {
    console.error("newsletter-render: sign failed for", objectPath, error);
    return null;
  }
}

function greetingName(firstName: string | null | undefined) {
  return firstName && firstName.trim() ? firstName.trim() : "a little reader";
}

export type RenderedNewsletter = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

/**
 * Sunday Show-Off — one family, narrative-forward, warm evening tone.
 * Matches the archetype spec in campaigns/newsletter-v1/archetype-a.
 */
export async function renderSundayShowOff(input: {
  candidate: FamilyFeatureCandidate;
  accountUrl: string;
  shopUrl: string;
  unsubscribeToken?: string;
}): Promise<RenderedNewsletter> {
  const pageUrl = await signOrNull(input.candidate.assetObjectPath);
  const childName = greetingName(input.candidate.childFirstName);
  const subject = `This week's featured page — ${childName}`;
  const preheader = "One family's photo turned into something they'll hang on the fridge.";

  const text = `${childName}'s family sent in a photo we could not stop looking at.

This week's Sunday Show-Off — a favorite moment turned into a coloring page they'll actually color.

${pageUrl ? `See the page: ${pageUrl}` : ""}

Want yours? ${input.shopUrl}

Manage your account: ${input.accountUrl}`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#fffaf5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#211915;">
<div style="display:none;opacity:0;visibility:hidden;height:0;overflow:hidden;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:24px;">
  <tr><td style="padding-bottom:16px;font-size:14px;color:#8f7a68;">Sunday Show-Off — ${BRAND_NAME}</td></tr>
  <tr><td><h1 style="font-size:28px;line-height:1.15;margin:0 0 12px;font-family:Georgia,serif;">This week's featured page — ${childName}</h1></td></tr>
  <tr><td style="padding:12px 0;">
    ${pageUrl ? `<img src="${pageUrl}" alt="Coloring page featuring ${childName}" style="width:100%;max-width:552px;border-radius:12px;display:block;"/>` : `<div style="padding:40px;background:#f3ece1;border-radius:12px;text-align:center;color:#8f7a68;">Preview unavailable</div>`}
  </td></tr>
  <tr><td style="padding:8px 0 16px;font-size:16px;line-height:1.55;">
    One family's favorite photo, now a coloring page they'll actually color tonight.
  </td></tr>
  <tr><td style="padding:20px 0;">
    <a href="${input.shopUrl}" style="background:#ff6b57;color:#fff;padding:14px 22px;text-decoration:none;border-radius:999px;font-weight:600;display:inline-block;">Make yours tonight</a>
  </td></tr>
  <tr><td style="padding:24px 0 8px;font-size:13px;color:#8f7a68;line-height:1.55;">
    P.S. — new pages went out to families all week. Know a mom who'd love this? Forward it.<br/><br/>
    <a href="${input.accountUrl}" style="color:#8f7a68;">Manage your account</a>
    &nbsp;·&nbsp;
    {{{RESEND_UNSUBSCRIBE_URL}}}
  </td></tr>
</table>
</body></html>`;

  return { subject, preheader, html, text };
}

/**
 * Thursday Gallery — 4-6 page grid, snackier morning tone.
 */
export async function renderThursdayGallery(input: {
  candidates: GalleryPageCandidate[];
  accountUrl: string;
  shopUrl: string;
  promptOfTheWeek: string;
}): Promise<RenderedNewsletter> {
  const imageUrls = await Promise.all(input.candidates.map((c) => signOrNull(c.assetObjectPath)));
  const usable = imageUrls.filter((u): u is string => Boolean(u)).slice(0, 6);

  const subject = "New pages. Tell us what to color next.";
  const preheader = `${usable.length} favorites from this week + one prompt for tonight.`;

  const cells = usable
    .map(
      (url) =>
        `<td style="width:33.3%;padding:4px;"><img src="${url}" alt="Recent coloring page" style="width:100%;border-radius:8px;display:block;"/></td>`,
    )
    .join("");

  const rows: string[] = [];
  for (let i = 0; i < usable.length; i += 3) {
    const slice = usable.slice(i, i + 3);
    rows.push(
      `<tr>${slice
        .map(
          (u) =>
            `<td style="width:33.3%;padding:4px;"><img src="${u}" alt="Recent coloring page" style="width:100%;border-radius:8px;display:block;"/></td>`,
        )
        .join("")}</tr>`,
    );
  }

  const text = `Gallery — this week's favorites.

Try this tonight: ${input.promptOfTheWeek}

Shop: ${input.shopUrl}
Account: ${input.accountUrl}`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#fffaf5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#211915;">
<div style="display:none;opacity:0;visibility:hidden;height:0;overflow:hidden;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:24px;">
  <tr><td style="padding-bottom:8px;font-size:14px;color:#8f7a68;">Thursday Gallery — ${BRAND_NAME}</td></tr>
  <tr><td><h1 style="font-size:24px;line-height:1.2;margin:0 0 16px;">This week's favorite pages</h1></td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("") || `<tr><td style="padding:32px;color:#8f7a68;text-align:center;">Fresh pages coming next week.</td></tr>`}</table></td></tr>
  <tr><td style="padding:24px 0 8px;">
    <div style="background:#fff5e4;border-radius:12px;padding:18px;">
      <strong style="display:block;margin-bottom:6px;">Try this tonight</strong>
      <span style="font-size:15px;line-height:1.5;">${input.promptOfTheWeek}</span>
    </div>
  </td></tr>
  <tr><td style="padding:20px 0;">
    <a href="${input.shopUrl}" style="color:#ff6b57;text-decoration:underline;font-weight:600;">Start your book →</a>
  </td></tr>
  <tr><td style="padding:20px 0 0;font-size:13px;color:#8f7a68;line-height:1.55;">
    <a href="${input.accountUrl}" style="color:#8f7a68;">Manage your account</a>
    &nbsp;·&nbsp;
    {{{RESEND_UNSUBSCRIBE_URL}}}
  </td></tr>
</table>
</body></html>`;

  return { subject, preheader, html, text };
}

const DEFAULT_PROMPTS = [
  "Take a photo of your kid doing their favorite messy thing. We'll turn it into a page.",
  "Snap the real morning chaos. It makes the best coloring page.",
  "Catch them in their pajamas with their favorite toy. That's the page.",
  "Photograph whatever small thing made them laugh today. That's the page.",
  "Get the shot of the sibling pile on the couch. The fridge page you'll actually keep.",
  "That blurry photo you almost deleted? Send it. Our pipeline loves candid.",
];

export function pickPromptOfTheWeek(seed?: number) {
  const index = (seed ?? Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7))) % DEFAULT_PROMPTS.length;
  return DEFAULT_PROMPTS[index];
}
