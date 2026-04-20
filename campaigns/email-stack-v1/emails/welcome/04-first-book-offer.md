---
email: 4
sequence: welcome
purpose: Soft first-book offer with 10% code. Answer the "is it worth it" question with concrete framing.
send_day: 9
send_time: "Day 9, Tuesday at 8:00 AM ET"
subject_line_a: "10% off your first book (code inside)"
subject_line_b: "An easy yes for this week"
subject_line_c: "one small nudge"
recommended_subject: "a"
preview_text: "Use FIRSTBOOK10 — good for two weeks"
cta: "Build your book with FIRSTBOOK10"
status: draft
---

# Email 4: First-Book Offer

## Subject Line Variants

### A: "10% off your first book (code inside)" — recommended
Clear, honest, direct. This is the one email in the welcome sequence where being transactional is on-brand — the reader wants to know the offer exists. 38 chars.

### B: "An easy yes for this week"
Softer, uses the brand's signature phrase "easy yes." More emotional, less transactional. Good for brand-forward testing.

### C: "one small nudge"
Lowercase, low-key. For subscribers who've been engaging but haven't converted. Reads like a friendly check-in.

**Recommended A/B test:** A vs B
**Reason:** Tests direct-offer opens vs warm-brand opens on the one offer email in this sequence. Tells us whether this list responds more to discount clarity or brand voice.

## Preview Text
"Use FIRSTBOOK10 — good for two weeks"

## Send Timing
Day 9 — Tuesday at 8:00 AM ET.
Tuesday morning is the strongest inbox window for this audience. Offer sent early enough in the day to plan around, late enough in the sequence (after 3 value emails) to have earned it.

---

## Email Copy (Plain Text)

{{first_name | default:"Hi"}},

A small gift for sticking around.

**FIRSTBOOK10** — 10% off your first book. Any size, PDF or print. Good for the next two weeks.

Here's how the math tends to land:

- 30-page PDF: $24.99 → $22.49. Print tonight, color tomorrow.
- 50-page PDF: $39 → $35.10. A fuller book, still same-day.
- 100-page print spiral: $99 → $89.10. The keepsake everyone ends up reaching for.

PDFs are delivered same-day. Spiral print books ship in about a week.

If you've been holding off because you weren't sure which photos to use, my honest suggestion: pick 12 you love, don't overthink it. You can always come back for a second book. Most families do.

Build yours: {{builder_url}}?promo=FIRSTBOOK10

— Little Color Book

P.S. The code is `FIRSTBOOK10`. It auto-applies at checkout if you use the link above.

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
          <p style="margin:0 0 16px;">A small gift for sticking around.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff4e6;border-radius:8px;padding:20px;margin:0 0 16px;">
            <tr><td align="center" style="font-size:22px;font-weight:700;color:#d2691e;">FIRSTBOOK10</td></tr>
            <tr><td align="center" style="font-size:14px;color:#666;padding-top:4px;">10% off your first book — good for two weeks</td></tr>
          </table>
          <p style="margin:0 0 8px;">Here's how the math tends to land:</p>
          <ul style="margin:0 0 16px;padding-left:20px;">
            <li style="margin-bottom:6px;">30-page PDF: $24.99 → $22.49. Print tonight, color tomorrow.</li>
            <li style="margin-bottom:6px;">50-page PDF: $39 → $35.10. A fuller book, still same-day.</li>
            <li>100-page print spiral: $99 → $89.10. The keepsake everyone ends up reaching for.</li>
          </ul>
          <p style="margin:0 0 16px;">PDFs are delivered same-day. Spiral print books ship in about a week.</p>
          <p style="margin:0 0 16px;">If you've been holding off because you weren't sure which photos to use, my honest suggestion: pick 12 you love, don't overthink it. You can always come back for a second book. Most families do.</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="{{builder_url}}?promo=FIRSTBOOK10" style="background:#d2691e;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Build your book</a>
          </p>
          <p style="margin:0 0 8px;">— Little Color Book</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> The code is <strong>FIRSTBOOK10</strong>. It auto-applies at checkout if you use the link above.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
