import { APP_NAME } from "@littlecolorbook/shared";

// Source copy lives in campaigns/email-stack-v1/emails/**/*.md. When the
// ops team refines copy there, mirror the changes here. The voice guard-
// rails (no "funnel", no "unlock", no exclamation spam, mobile-first
// one-CTA structure) are documented in ./brand/voice-profile.md.

export type SequenceKey = "welcome" | "post_purchase" | "re_engagement" | "abandonment";

export type SequenceVariables = {
  firstName?: string | null;
  childFirstName?: string | null;
  email: string;
  sampleUrl?: string | null;
  sampleUrlNew?: string | null;
  accountUrl: string;
  shopUrl: string;
  orderUrl?: string | null;
  offerCode?: string | null;
  offerLabel?: string | null;
  offerExpiresLabel?: string | null;
  checkoutResumeUrl?: string | null;
  supportEmail: string;
  unsubscribeUrl?: string | null;
};

export type RenderedSequenceEmail = {
  subject: string;
  preheader: string;
  text: string;
  html: string;
};

export type SequenceStep = {
  step: number;
  key: string; // short human-readable key, e.g. "welcome.02.how-it-works"
  subject: string;
  preheader: string;
  /** Delay from enrollment time for step 1, or from previous step for step >=2 */
  delayMs: number;
  render(vars: SequenceVariables): { text: string; html: string };
};

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// -------- Shared HTML scaffolding -----------------------------------

function mobileShell(body: string, preheader: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#fffaf5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#211915;">
<div style="display:none;opacity:0;visibility:hidden;height:0;overflow:hidden;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:24px 20px;">
  ${body}
</table>
</body></html>`;
}

function footer(vars: SequenceVariables) {
  const unsub = vars.unsubscribeUrl ?? "{{{RESEND_UNSUBSCRIBE_URL}}}";
  return `<tr><td style="padding:28px 0 0;font-size:13px;color:#8f7a68;line-height:1.55;border-top:1px solid #f0e5d6;margin-top:28px;">
    <a href="${vars.accountUrl}" style="color:#8f7a68;">Manage your account</a>
    &nbsp;·&nbsp;
    <a href="mailto:${vars.supportEmail}" style="color:#8f7a68;">${vars.supportEmail}</a>
    &nbsp;·&nbsp;
    ${unsub}
  </td></tr>`;
}

function primaryButton(href: string, label: string) {
  return `<a href="${href}" style="background:#ff6b57;color:#fff;padding:14px 22px;text-decoration:none;border-radius:999px;font-weight:600;display:inline-block;">${label}</a>`;
}

function greeting(vars: SequenceVariables) {
  return vars.firstName && vars.firstName.trim() ? `Hi ${vars.firstName.trim()},` : "Hi,";
}

function paragraph(html: string) {
  return `<tr><td style="padding:0 0 14px;font-size:16px;line-height:1.55;">${html}</td></tr>`;
}

// ==================== WELCOME (5 emails) ============================

const welcome: SequenceStep[] = [
  {
    step: 1,
    key: "welcome.01.sample-delivered",
    subject: "Your sample page is ready",
    preheader: "Plus one photo tip most parents miss.",
    delayMs: 0,
    render(vars) {
      const intro = greeting(vars);
      const sampleLink = vars.sampleUrl ?? vars.accountUrl;
      const newSampleLink = vars.sampleUrlNew ?? vars.shopUrl;
      const text = `${intro}

Your free sample page is ready — grab it here: ${sampleLink}

Print it tonight. Hand it to your kid with a crayon. That's the whole thing.

One tip most parents miss: the best photos for coloring pages are the candids, not the posed ones. A messy breakfast face. Your kid mid-laugh in the backyard. The dog photobombing Christmas morning. Those are the pages kids love.

Want to try another photo? ${newSampleLink}

Over the next couple weeks I'll send a few short notes — how other moms use theirs, what to do if the first one missed, and some ideas for turning more of your camera roll into something worth keeping.

Happy coloring.
— The ${APP_NAME} team

P.S. If your first page didn't come out the way you hoped, hit reply. I read every one.`;

      const body = [
        paragraph(intro),
        paragraph(`Your free sample page is ready — <a href="${sampleLink}" style="color:#ff6b57;">grab it here</a>.`),
        paragraph("Print it tonight. Hand it to your kid with a crayon. That's the whole thing."),
        paragraph(
          "The best photos for coloring pages are the candids, not the posed ones. A messy breakfast face. Your kid mid-laugh. The dog photobombing Christmas morning.",
        ),
        `<tr><td style="padding:12px 0 20px;">${primaryButton(newSampleLink, "Try another photo")}</td></tr>`,
        paragraph("Over the next couple weeks I'll send a few short notes — how other moms use theirs, and ideas for turning more of your camera roll into something worth keeping."),
        paragraph("Happy coloring.<br/>— The Little Color Book team"),
        paragraph(`<strong>P.S.</strong> If your first page didn't come out right, hit reply. I read every one.`),
        footer(vars),
      ].join("");

      return { text, html: mobileShell(body, "Plus one photo tip most parents miss.") };
    },
  },
  {
    step: 2,
    key: "welcome.02.how-it-works",
    subject: "How other moms are using theirs",
    preheader: "Three ways your sample page earns its place on the fridge.",
    delayMs: 2 * DAY,
    render(vars) {
      const intro = greeting(vars);
      const text = `${intro}

A quick look at what other moms are doing with the pages we send them.

Rainy afternoon: hand the printed page over with a fresh box of crayons. Twenty quiet minutes. Screen-free. Done.

Birthday bag: print a few, tuck them in with the party favors. The birthday kid colors their own face in the car ride home.

Grandma copy: mail one to a grandparent with the original photo clipped to it. They keep it.

Try it with a new photo: ${vars.sampleUrlNew ?? vars.shopUrl}

— The Little Color Book team`;
      const body = [
        paragraph(intro),
        paragraph("A quick look at what other moms are doing with the pages we send them."),
        paragraph("<strong>Rainy afternoon.</strong> Hand the printed page over with a fresh box of crayons. Twenty quiet minutes. Screen-free. Done."),
        paragraph("<strong>Birthday bag.</strong> Print a few, tuck them in with the party favors. The birthday kid colors their own face in the car ride home."),
        paragraph("<strong>Grandma copy.</strong> Mail one to a grandparent with the original photo clipped to it. They keep it."),
        `<tr><td style="padding:16px 0 24px;">${primaryButton(vars.sampleUrlNew ?? vars.shopUrl, "Try a new photo")}</td></tr>`,
        paragraph("— The Little Color Book team"),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "Three ways your sample page earns its place on the fridge.") };
    },
  },
  {
    step: 3,
    key: "welcome.03.ideas",
    subject: "Favorite photo types (from real camera rolls)",
    preheader: "What works, what doesn't, and a shortcut for picking.",
    delayMs: 3 * DAY,
    render(vars) {
      const intro = greeting(vars);
      const text = `${intro}

A cheat sheet for picking photos your kid will actually want to color.

Works great: single clear face, candid action shots, pets mid-zoomie, siblings piled on the couch.
Works okay: posed school photos, group shots with the kid front and center.
Skip: dim lighting, very wide landscape shots, anything where faces are tiny.

The magic rule: one photo, one hero. The coloring page zooms into the person or pet. If your camera roll has a blurry laughing shot you almost deleted — send that. They make the best pages.

Try one: ${vars.shopUrl}

— The Little Color Book team`;
      const body = [
        paragraph(intro),
        paragraph("A cheat sheet for picking photos your kid will actually want to color."),
        paragraph("<strong>Works great:</strong> single clear face, candid action shots, pets mid-zoomie, siblings piled on the couch."),
        paragraph("<strong>Works okay:</strong> posed school photos, group shots with the kid front and center."),
        paragraph("<strong>Skip:</strong> dim lighting, very wide landscape shots, anything where faces are tiny."),
        paragraph("The magic rule: one photo, one hero. If your camera roll has a blurry laughing shot you almost deleted — send that. They make the best pages."),
        `<tr><td style="padding:16px 0 24px;">${primaryButton(vars.shopUrl, "Try a new photo")}</td></tr>`,
        paragraph("— The Little Color Book team"),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "What works, what doesn't, and a shortcut for picking.") };
    },
  },
  {
    step: 4,
    key: "welcome.04.first-book-offer",
    subject: "10% off your first book — 14 days",
    preheader: "Turn the rest of your camera roll into a real book.",
    delayMs: 4 * DAY,
    render(vars) {
      const intro = greeting(vars);
      const code = vars.offerCode ?? "FIRSTBOOK10";
      const expiresLabel = vars.offerExpiresLabel ?? "for the next 14 days";
      const text = `${intro}

You saw what one page looks like. Here's the easy next step: turn the rest of your camera roll into a 30-page book.

Use code ${code} at checkout for 10% off your first book. Good ${expiresLabel}.

30 pages is the easiest first book ($24.99 PDF, $49 spiral). 100 pages is the best-value keepsake ($59 PDF, $99 spiral) when your camera roll is already packed.

Start your book: ${vars.shopUrl}

— The Little Color Book team`;
      const body = [
        paragraph(intro),
        paragraph("You saw what one page looks like. Here's the easy next step: turn the rest of your camera roll into a 30-page book."),
        paragraph(`Use code <strong>${code}</strong> at checkout for 10% off your first book. Good ${expiresLabel}.`),
        paragraph("30 pages is the easiest first book. 100 pages is the best-value keepsake when your camera roll is already packed."),
        `<tr><td style="padding:16px 0 24px;">${primaryButton(vars.shopUrl, `Start my book (${code})`)}</td></tr>`,
        paragraph("— The Little Color Book team"),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "Turn the rest of your camera roll into a real book.") };
    },
  },
  {
    step: 5,
    key: "welcome.05.checkin",
    subject: "Still thinking about it?",
    preheader: "No pressure. Just a short check-in.",
    delayMs: 5 * DAY,
    render(vars) {
      const intro = greeting(vars);
      const text = `${intro}

Quick check-in.

If the first sample didn't come out the way you hoped, I'd love to know why. Just hit reply — the real team reads every one.

If you're mulling it over: no hurry. Your account and the free sample are still here when you're ready.

If you're already set: the 30-page book is the easiest first yes. 100 pages is the keepsake option. ${vars.shopUrl}

— The Little Color Book team`;
      const body = [
        paragraph(intro),
        paragraph("Quick check-in."),
        paragraph("If the first sample didn't come out the way you hoped, I'd love to know why. Just hit reply — the real team reads every one."),
        paragraph("If you're mulling it over: no hurry. Your account and the free sample are still here when you're ready."),
        paragraph(`If you're already set: <a href="${vars.shopUrl}" style="color:#ff6b57;">start your book here</a>.`),
        paragraph("— The Little Color Book team"),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "No pressure. Just a short check-in.") };
    },
  },
];

// ==================== POST-PURCHASE (5 emails) ======================

const postPurchase: SequenceStep[] = [
  {
    step: 1,
    key: "post_purchase.01.thank-you",
    subject: "Thanks — and one thing to try tonight",
    preheader: "Rainy afternoons, birthday bags, grandma copies.",
    delayMs: 1 * DAY,
    render(vars) {
      const intro = greeting(vars);
      const text = `${intro}

Thanks for your order. Your book is either on the way or already in your downloads — either way, here's one small idea to make tonight feel earned:

Hand the book over with a fresh box of crayons. Then sit down too, pick a page, and color with your kid for ten minutes. The colored page goes on the fridge. The memory lasts longer than the book.

If you want to look at your order: ${vars.accountUrl}

— The Little Color Book team`;
      const body = [
        paragraph(intro),
        paragraph("Thanks for your order. Your book is either on the way or already in your downloads — either way, here's one small idea for tonight:"),
        paragraph("Hand it over with a fresh box of crayons. Sit down too, pick a page, color with your kid for ten minutes. The colored page goes on the fridge. The memory lasts longer than the book."),
        `<tr><td style="padding:16px 0 24px;">${primaryButton(vars.accountUrl, "View my order")}</td></tr>`,
        paragraph("— The Little Color Book team"),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "Rainy afternoons, birthday bags, grandma copies.") };
    },
  },
  {
    step: 2,
    key: "post_purchase.02.review",
    subject: "How did it turn out?",
    preheader: "One reply, one line. Tell me what your kid did.",
    delayMs: 4 * DAY,
    render(vars) {
      const intro = greeting(vars);
      const text = `${intro}

Did your kid actually color it?

I ask because the best pages come from parents who tell me what happened. The messy ones. The ones where the dog got scribbled in. The one a grandma cried over.

Just hit reply with a photo or a sentence. If you loved it, say so — I'll feature a few favorites in our newsletter (only with your okay).

— The Little Color Book team

P.S. You can opt-in to being featured from your account settings: ${vars.accountUrl}/settings`;
      const body = [
        paragraph(intro),
        paragraph("Did your kid actually color it?"),
        paragraph("I ask because the best pages come from parents who tell me what happened. The messy ones. The ones where the dog got scribbled in. The one a grandma cried over."),
        paragraph("Just hit reply — a photo, a sentence. If you loved it, say so. I'll feature a few favorites in our newsletter (only with your okay)."),
        paragraph("— The Little Color Book team"),
        paragraph(`<strong>P.S.</strong> You can opt-in to being featured from <a href="${vars.accountUrl}/settings" style="color:#ff6b57;">your account settings</a>.`),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "One reply, one line. Tell me what your kid did.") };
    },
  },
  {
    step: 3,
    key: "post_purchase.03.use-cases",
    subject: "Six ways moms are using their books",
    preheader: "Rainy afternoon, birthday bag, road trip, grandma copy.",
    delayMs: 9 * DAY,
    render(vars) {
      const intro = greeting(vars);
      const text = `${intro}

The pages you already paid for can do more than one shift. A short list from other moms:

1. Rainy afternoon — the classic.
2. Birthday bag — tuck a page into party favors.
3. Road trip — swap the tablet for a small stack and a crayon caddy.
4. Grandma copy — mail one page with the original photo.
5. Restaurant quiet time — bring three pages and a pencil.
6. Sibling gift — if it's coming up, you already have the book.

— The Little Color Book team`;
      const body = [
        paragraph(intro),
        paragraph("The pages you already paid for can do more than one shift. A short list from other moms:"),
        paragraph("1. <strong>Rainy afternoon</strong> — the classic.<br/>2. <strong>Birthday bag</strong> — tuck a page into party favors.<br/>3. <strong>Road trip</strong> — swap the tablet for a crayon caddy.<br/>4. <strong>Grandma copy</strong> — mail a page with the original photo.<br/>5. <strong>Restaurant quiet time</strong> — three pages and a pencil.<br/>6. <strong>Sibling gift</strong> — if it's coming up, you already have the book."),
        paragraph("— The Little Color Book team"),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "Rainy afternoon, birthday bag, road trip, grandma copy.") };
    },
  },
  {
    step: 4,
    key: "post_purchase.04.sibling-grandma",
    subject: `A sibling copy or a grandma copy?`,
    preheader: "15% off your second book for the next 14 days.",
    delayMs: 16 * DAY,
    render(vars) {
      const intro = greeting(vars);
      const code = vars.offerCode ?? "REPEAT15";
      const text = `${intro}

Two of the most-requested follow-up orders we see:

A sibling copy — same photos, different kid's name on the cover. They feel equally seen.

A grandma copy — same book, mailed straight to her. Every grandparent we've ever shipped to has texted about it.

Use code ${code} for 15% off your second book. Good for 14 days.

Start it: ${vars.shopUrl}

— The Little Color Book team`;
      const body = [
        paragraph(intro),
        paragraph("Two of the most-requested follow-up orders we see:"),
        paragraph("<strong>A sibling copy.</strong> Same photos, different kid's name on the cover. They feel equally seen."),
        paragraph("<strong>A grandma copy.</strong> Same book, mailed straight to her. Every grandparent we've ever shipped to has texted about it."),
        paragraph(`Use code <strong>${code}</strong> for 15% off your second book. Good for 14 days.`),
        `<tr><td style="padding:16px 0 24px;">${primaryButton(vars.shopUrl, `Start my second book (${code})`)}</td></tr>`,
        paragraph("— The Little Color Book team"),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "15% off your second book for the next 14 days.") };
    },
  },
  {
    step: 5,
    key: "post_purchase.05.second-book-nudge",
    subject: "Your next book, from the other kid's perspective",
    preheader: "Your camera roll has a sequel.",
    delayMs: 30 * DAY,
    render(vars) {
      const intro = greeting(vars);
      const text = `${intro}

You probably took a hundred more photos since your last book. Some of them are the sequel.

A first day of school. A vacation. A new haircut. A sibling finally tall enough to stand next to the older one.

Thirty more pages turns the last two months into a real keepsake. Hundred pages is a year-in-review.

Start your next book: ${vars.shopUrl}

— The Little Color Book team`;
      const body = [
        paragraph(intro),
        paragraph("You probably took a hundred more photos since your last book. Some of them are the sequel."),
        paragraph("A first day of school. A vacation. A new haircut. A sibling finally tall enough to stand next to the older one."),
        paragraph("Thirty more pages turns the last two months into a real keepsake. A hundred pages is a year-in-review."),
        `<tr><td style="padding:16px 0 24px;">${primaryButton(vars.shopUrl, "Start my next book")}</td></tr>`,
        paragraph("— The Little Color Book team"),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "Your camera roll has a sequel.") };
    },
  },
];

// ==================== RE-ENGAGEMENT (3 emails) ======================

const reEngagement: SequenceStep[] = [
  {
    step: 1,
    key: "re_engagement.01.miss-you",
    subject: "Hey — it's been a minute",
    preheader: "Your account's still here, and your book is too.",
    delayMs: 0,
    render(vars) {
      const intro = greeting(vars);
      const text = `${intro}

It's been a while since your last order. Nothing formal — just thought I'd wave.

Your account is still here: ${vars.accountUrl}

If your camera roll has picked up another few hundred photos since then (it probably has), your next book might already be writing itself.

— The Little Color Book team`;
      const body = [
        paragraph(intro),
        paragraph("It's been a while since your last order. Nothing formal — just thought I'd wave."),
        paragraph(`Your account is <a href="${vars.accountUrl}" style="color:#ff6b57;">still right here</a>.`),
        paragraph("If your camera roll has picked up another few hundred photos since then (it probably has), your next book might already be writing itself."),
        paragraph("— The Little Color Book team"),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "Your account's still here, and your book is too.") };
    },
  },
  {
    step: 2,
    key: "re_engagement.02.seasonal",
    subject: "Perfect seasonal gift hiding on your phone",
    preheader: "Birthdays, Mother's Day, Thanksgiving visits, Christmas morning.",
    delayMs: 4 * DAY,
    render(vars) {
      const intro = greeting(vars);
      const text = `${intro}

Quick thought for you.

The best gifts don't come from stores. They come from your camera roll. A spiral coloring book made from this year's favorite photos, shipped straight to a grandparent — that's the one that gets saved.

This works especially well for: birthdays, Mother's Day, Father's Day, Thanksgiving table, Christmas morning.

Start a gift book: ${vars.shopUrl}

— The Little Color Book team`;
      const body = [
        paragraph(intro),
        paragraph("Quick thought for you."),
        paragraph("The best gifts don't come from stores. They come from your camera roll. A spiral coloring book made from this year's favorite photos — that's the one that gets saved."),
        paragraph("Works for birthdays, Mother's Day, Father's Day, Thanksgiving, and Christmas morning."),
        `<tr><td style="padding:16px 0 24px;">${primaryButton(vars.shopUrl, "Start a gift book")}</td></tr>`,
        paragraph("— The Little Color Book team"),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "Birthdays, Mother's Day, Thanksgiving visits, Christmas morning.") };
    },
  },
  {
    step: 3,
    key: "re_engagement.03.comeback-offer",
    subject: "20% off if you come back this week",
    preheader: "Real deadline, real discount. Expires Sunday.",
    delayMs: 6 * DAY,
    render(vars) {
      const intro = greeting(vars);
      const code = vars.offerCode ?? "COMEBACK20";
      const text = `${intro}

One-time nudge — 20% off any book, code ${code}. Expires Sunday.

If you're not coming back, no hard feelings. If you are, you can use it on the 100-page keepsake and it actually makes a dent.

${vars.shopUrl}

— The Little Color Book team

P.S. If you want to stop hearing from me, there's a one-click unsubscribe at the bottom. I won't take it personally.`;
      const body = [
        paragraph(intro),
        paragraph(`One-time nudge — <strong>20% off any book</strong>, code <strong>${code}</strong>. Expires Sunday.`),
        paragraph("If you're not coming back, no hard feelings. If you are, use it on the 100-page keepsake — it actually makes a dent."),
        `<tr><td style="padding:16px 0 24px;">${primaryButton(vars.shopUrl, `Come back (${code})`)}</td></tr>`,
        paragraph("— The Little Color Book team"),
        paragraph(`<strong>P.S.</strong> If you want to stop hearing from me, there's a one-click unsubscribe at the bottom. I won't take it personally.`),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "Real deadline, real discount. Expires Sunday.") };
    },
  },
];

// ==================== ABANDONMENT (3 emails) ========================

const abandonment: SequenceStep[] = [
  {
    step: 1,
    key: "abandonment.01.tab-closed",
    subject: "Looks like the tab closed on you",
    preheader: "Your book is still in draft. Finish it in two clicks.",
    delayMs: 1 * HOUR,
    render(vars) {
      const intro = greeting(vars);
      const resumeUrl = vars.checkoutResumeUrl ?? vars.accountUrl;
      const text = `${intro}

Looks like the tab closed on you mid-checkout. Happens to everyone — babies, phone calls, a dog, a sibling.

Your book is still in draft. You can pick up where you left off: ${resumeUrl}

If anything didn't look right, hit reply. We'll sort it out.

— The Little Color Book team`;
      const body = [
        paragraph(intro),
        paragraph("Looks like the tab closed on you mid-checkout. Happens to everyone — babies, phone calls, a dog, a sibling."),
        paragraph("Your book is still in draft. You can pick up right where you left off."),
        `<tr><td style="padding:16px 0 24px;">${primaryButton(resumeUrl, "Finish my book")}</td></tr>`,
        paragraph("If anything didn't look right, hit reply. We'll sort it out."),
        paragraph("— The Little Color Book team"),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "Your book is still in draft. Finish it in two clicks.") };
    },
  },
  {
    step: 2,
    key: "abandonment.02.still-there",
    subject: "Still there? Two small things",
    preheader: "One question people ask. One shortcut if you're picky about photos.",
    delayMs: 23 * HOUR,
    render(vars) {
      const intro = greeting(vars);
      const resumeUrl = vars.checkoutResumeUrl ?? vars.accountUrl;
      const text = `${intro}

Checking back in.

Two things worth saying:

1. The question people ask before checking out: "what if a page doesn't turn out?" Easy answer — if a page doesn't work, we regenerate it free until it does. No hoops.

2. If you're stuck picking photos, the candids win. A blurry laughing shot beats a posed school photo every time.

Pick up where you left off: ${resumeUrl}

— The Little Color Book team`;
      const body = [
        paragraph(intro),
        paragraph("Checking back in. Two things worth saying:"),
        paragraph("<strong>1.</strong> Question people ask before checkout: \"what if a page doesn't turn out?\" Easy answer — if one doesn't work, we regenerate it free until it does. No hoops."),
        paragraph("<strong>2.</strong> Stuck picking photos? Candids win. A blurry laughing shot beats a posed school photo every time."),
        `<tr><td style="padding:16px 0 24px;">${primaryButton(resumeUrl, "Pick up where I left off")}</td></tr>`,
        paragraph("— The Little Color Book team"),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "One question people ask. One shortcut if you're picky about photos.") };
    },
  },
  {
    step: 3,
    key: "abandonment.03.finish-order",
    subject: "Finish your book — 10% off for 48 hours",
    preheader: "Real discount, real deadline.",
    delayMs: 2 * DAY,
    render(vars) {
      const intro = greeting(vars);
      const code = vars.offerCode ?? "FINISHORDER10";
      const resumeUrl = vars.checkoutResumeUrl ?? vars.shopUrl;
      const text = `${intro}

Last one from me on this.

Code ${code} is 10% off if you finish your order in the next 48 hours.

${resumeUrl}

If this isn't the right time, no worries — your draft will stay here for when it is.

— The Little Color Book team`;
      const body = [
        paragraph(intro),
        paragraph("Last one from me on this."),
        paragraph(`Code <strong>${code}</strong> is 10% off if you finish your order in the next 48 hours.`),
        `<tr><td style="padding:16px 0 24px;">${primaryButton(resumeUrl, `Finish my book (${code})`)}</td></tr>`,
        paragraph("If this isn't the right time, no worries — your draft will stay here for when it is."),
        paragraph("— The Little Color Book team"),
        footer(vars),
      ].join("");
      return { text, html: mobileShell(body, "Real discount, real deadline.") };
    },
  },
];

export const SEQUENCES: Record<SequenceKey, SequenceStep[]> = {
  welcome,
  post_purchase: postPurchase,
  re_engagement: reEngagement,
  abandonment,
};

export function getSequenceSteps(sequence: SequenceKey): SequenceStep[] {
  return SEQUENCES[sequence];
}

export function getSequenceStep(sequence: SequenceKey, step: number): SequenceStep | null {
  return SEQUENCES[sequence].find((s) => s.step === step) ?? null;
}

export function renderSequenceEmail(
  sequence: SequenceKey,
  step: number,
  vars: SequenceVariables,
): RenderedSequenceEmail | null {
  const entry = getSequenceStep(sequence, step);
  if (!entry) return null;
  const { text, html } = entry.render(vars);
  return { subject: entry.subject, preheader: entry.preheader, text, html };
}

/**
 * Compute the next-send-at for a sequence enrollment at the given step
 * index. Step 1 uses delayMs as offset from enrolledAt. Step >= 2 uses
 * delayMs as offset from lastSendAt.
 */
export function computeNextSendAt(
  sequence: SequenceKey,
  nextStep: number,
  anchor: Date,
): Date | null {
  const entry = getSequenceStep(sequence, nextStep);
  if (!entry) return null;
  return new Date(anchor.getTime() + entry.delayMs);
}

export function getLastStep(sequence: SequenceKey): number {
  return SEQUENCES[sequence][SEQUENCES[sequence].length - 1]?.step ?? 0;
}
