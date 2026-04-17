---
email: 3
sequence: re-engagement
purpose: Dormant-customer win-back with 20% off. Honest, time-bound, no fake urgency.
send_day: 10
send_time: "Day 10, Wednesday at 8:00 AM ET"
subject_line_a: "20% off if you come back this week"
subject_line_b: "Our best offer, sent to you on purpose"
subject_line_c: "one more try, then I'll stop"
recommended_subject: "a"
preview_text: "COMEBACK20 — good through Sunday"
cta: "Use COMEBACK20"
status: draft
---

# Email 3: Comeback Offer

## Subject Line Variants

### A: "20% off if you come back this week" — recommended
Clear number, clear timeframe. No fake urgency. 37 chars. High-intent subscribers open immediately; low-intent at least know the offer exists.

### B: "Our best offer, sent to you on purpose"
Softer, implies curation. Works if the audience is sensitive to discount fatigue and prefers personal framing.

### C: "one more try, then I'll stop"
Lowercase, honest, slight humor. Signals this is the last re-engagement email — which it is — and gives a clean out for those who want to stay subscribed but not buy.

**Recommended A/B test:** A vs B
**Reason:** Tests direct-discount against curated-framing for the deepest lapsed segment. Winner informs win-back copy strategy at the 90+ day mark.

## Preview Text
"COMEBACK20 — good through Sunday"

## Send Timing
Day 10 — Wednesday at 8:00 AM ET.
Ten days after the initial re-engagement ping. Wednesday morning so the offer has a visible 4-5 day window before expiry.

---

## Email Copy (Plain Text)

{{first_name | default:"Hi"}},

Last one from this sequence. Then I'll quiet down.

Here's our best customer offer:

**COMEBACK20** — 20% off any book. Good through Sunday.

That brings a 30-page PDF to $23.20, a 50-page spiral print to $51.20, and the 100-page keepsake spiral to $79.20. Same product, same quality, best price we offer.

If you've been meaning to make a second book — for a sibling, a grandparent, a specific occasion, or just because the camera roll has filled up again — this is the easiest moment to do it.

Build your book: {{builder_url}}?promo=COMEBACK20

— Little Color Book

P.S. If you're not interested anymore, that's fine. You can unsubscribe at the bottom — no hard feelings. I'd rather you feel good about your inbox than feel obligated to anything.

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
          <p style="margin:0 0 16px;">Last one from this sequence. Then I'll quiet down.</p>
          <p style="margin:0 0 16px;">Here's our best customer offer:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff4e6;border-radius:8px;padding:20px;margin:0 0 16px;">
            <tr><td align="center" style="font-size:22px;font-weight:700;color:#d2691e;">COMEBACK20</td></tr>
            <tr><td align="center" style="font-size:14px;color:#666;padding-top:4px;">20% off any book — good through Sunday</td></tr>
          </table>
          <p style="margin:0 0 16px;">That brings a 30-page PDF to $23.20, a 50-page spiral print to $51.20, and the 100-page keepsake spiral to $79.20. Same product, best price we offer.</p>
          <p style="margin:0 0 16px;">If you've been meaning to make a second book — for a sibling, a grandparent, a specific occasion, or just because the camera roll has filled up again — this is the easiest moment to do it.</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="{{builder_url}}?promo=COMEBACK20" style="background:#d2691e;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Use COMEBACK20</a>
          </p>
          <p style="margin:0 0 8px;">— Little Color Book</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> If you're not interested anymore, that's fine. You can unsubscribe at the bottom — no hard feelings. I'd rather you feel good about your inbox than feel obligated to anything.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
