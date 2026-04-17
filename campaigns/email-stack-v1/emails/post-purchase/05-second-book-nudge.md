---
email: 5
sequence: post-purchase
purpose: 60-day soft nudge — tie a second book to the new season of photos that has accumulated
send_day: 60
send_time: "Day 60 post-delivery, Wednesday at 7:30 AM ET"
subject_line_a: "A new season of photos is hiding in your phone"
subject_line_b: "It's been two months. Time for volume two?"
subject_line_c: "what's in your camera roll now?"
recommended_subject: "a"
preview_text: "Summer, birthday, new haircut, new puppy — a new book"
cta: "Turn the last two months into a book"
status: draft
---

# Email 5: 60-Day New-Season Nudge

## Subject Line Variants

### A: "A new season of photos is hiding in your phone" — recommended
Outcome-first, evocative, brand-vocab ("camera roll" implied, "new season" is fresh). Opens a mental scroll of recent photos. 47 chars — at the edge of mobile truncation but intentional.

### B: "It's been two months. Time for volume two?"
Direct, friendly, casual urgency. Treats the customer like a book-series subscriber, which is an emotional upgrade. 42 chars.

### C: "what's in your camera roll now?"
Lowercase, question, personal. Lowest pressure. Works well for quieter segments.

**Recommended A/B test:** A vs B
**Reason:** Tests evocative-imagery against friendly-direct-question. Informs whether 60-day customers respond more to inspiration or to framed cadence.

## Preview Text
"Summer, birthday, new haircut, new puppy — a new book"

## Send Timing
Day 60 post-delivery — Wednesday at 7:30 AM ET.
Two months is a natural "accumulation window" for new photos. Wednesday morning hits a clean inbox.

---

## Email Copy (Plain Text)

{{first_name | default:"Hi"}},

Two months in. Pull up your camera roll for a second.

What's in there now that wasn't there last time?

A first day of something. A haircut. A new puppy or a visiting cousin. The vacation you forgot you even took. A grandparent visit. One really good backyard afternoon.

Books work best as a series. One for now. One for next season. One for every birthday. The whole thing becomes a family library over a few years.

If you want to make volume two, here's where to start: {{builder_url}}

No code on this one — just a nudge that the photos are piling up faster than you think.

— Little Color Book

P.S. A lot of families do one book per kid per year. By the time kids are in high school there's a whole shelf of them. If you're thinking about it this way, the 100-page annual book is the move. It's the best-value keepsake size and holds up.

---

## Email Copy (HTML)

```html
<!doctype html>
<html>
<body style="margin:0;padding:0;background:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2a2a2a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px 24px;">
        <tr><td style="font-size:16px;line-height:1.6;">
          <p style="margin:0 0 16px;">{{first_name | default:"Hi"}},</p>
          <p style="margin:0 0 16px;">Two months in. Pull up your camera roll for a second.</p>
          <p style="margin:0 0 16px;">What's in there now that wasn't there last time?</p>
          <p style="margin:0 0 16px;">A first day of something. A haircut. A new puppy or a visiting cousin. The vacation you forgot you even took. A grandparent visit. One really good backyard afternoon.</p>
          <p style="margin:0 0 16px;">Books work best as a series. One for now. One for next season. One for every birthday. The whole thing becomes a family library over a few years.</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="{{builder_url}}" style="background:#d2691e;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Start volume two</a>
          </p>
          <p style="margin:0 0 16px;">No code on this one — just a nudge that the photos are piling up faster than you think.</p>
          <p style="margin:0 0 8px;">— Little Color Book</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> A lot of families do one book per kid per year. By the time kids are in high school there's a whole shelf of them. If you're thinking about it this way, the 100-page annual book is the move — best-value keepsake and holds up.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
