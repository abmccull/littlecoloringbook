---
email: 4
sequence: post-purchase
purpose: 30-day nudge for a second book (sibling copy, grandma copy, or gift). Uses REPEAT15.
send_day: 30
send_time: "Day 30 post-delivery, Tuesday at 8:00 AM ET"
subject_line_a: "A second book (sibling copy, grandma copy)"
subject_line_b: "15% off your second book"
subject_line_c: "the one we hear about most"
recommended_subject: "a"
preview_text: "REPEAT15 is inside — good for 14 days"
cta: "Make a second book with REPEAT15"
status: draft
---

# Email 4: Second-Book Nudge

## Subject Line Variants

### A: "A second book (sibling copy, grandma copy)" — recommended
Uses exact brand vocabulary from positioning. Plants two specific reasons in the subject. 43 chars. Emotion-first, offer secondary.

### B: "15% off your second book"
Offer-first. Blunter, transactional. Tests whether repeat customers respond better to direct discount copy.

### C: "the one we hear about most"
Curiosity-led, soft. Implies insight. Works when you want to feel less salesy on repeat pushes.

**Recommended A/B test:** A vs B
**Reason:** Tests emotion-led vs offer-led framing for loyal customers. We suspect the emotional frame wins here because the reader already trusts the product — the question is which use case pulls the second purchase.

## Preview Text
"REPEAT15 is inside — good for 14 days"

## Send Timing
Day 30 post-delivery — Tuesday at 8:00 AM ET.
Thirty days is enough time for the first book to feel "loved" but not forgotten. Tuesday AM is the strongest open window.

---

## Email Copy (Plain Text)

{{first_name | default:"Hi"}},

By now your book probably has a few colored pages. Maybe it's on the coffee table. Maybe a sibling keeps asking when they get one.

Two things happen around this point for most families:

**The sibling copy.**
Whichever kid didn't get featured last time starts noticing. A second book solves that fast. 30 pages is plenty for one kid.

**The grandma copy.**
Same book, second print. Mailed to whichever grandparent lives farthest away. It lands and the phone calls get longer for about two weeks.

Either way, here's 15% off to make it easy:

**REPEAT15** — 15% off any second book. Good for 14 days.

You can use the photos you already uploaded or start fresh: {{builder_url}}?promo=REPEAT15

— Little Color Book

P.S. If you're doing the grandma copy, pick the spiral print option. It sits open on a counter the way PDFs can't.

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
          <p style="margin:0 0 16px;">By now your book probably has a few colored pages. Maybe it's on the coffee table. Maybe a sibling keeps asking when they get one.</p>
          <p style="margin:0 0 16px;">Two things happen around this point for most families:</p>
          <p style="margin:0 0 8px;"><strong>The sibling copy.</strong></p>
          <p style="margin:0 0 16px;">Whichever kid didn't get featured last time starts noticing. A second book solves that fast. 30 pages is plenty for one kid.</p>
          <p style="margin:0 0 8px;"><strong>The grandma copy.</strong></p>
          <p style="margin:0 0 16px;">Same book, second print. Mailed to whichever grandparent lives farthest away. Phone calls get longer for about two weeks.</p>
          <p style="margin:0 0 16px;">Either way, here's 15% off to make it easy:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff4e6;border-radius:8px;padding:20px;margin:0 0 16px;">
            <tr><td align="center" style="font-size:22px;font-weight:700;color:#d2691e;">REPEAT15</td></tr>
            <tr><td align="center" style="font-size:14px;color:#666;padding-top:4px;">15% off any second book — good for 14 days</td></tr>
          </table>
          <p style="margin:24px 0;text-align:center;">
            <a href="{{builder_url}}?promo=REPEAT15" style="background:#d2691e;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Make a second book</a>
          </p>
          <p style="margin:0 0 8px;">— Little Color Book</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> If you're doing the grandma copy, pick the spiral print option. It sits open on a counter the way PDFs can't.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
