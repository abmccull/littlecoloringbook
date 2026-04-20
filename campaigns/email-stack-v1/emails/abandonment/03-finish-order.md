---
email: 3
sequence: abandonment
purpose: Final nudge with 10% off. Time-bound, honest.
send_day: 3
send_time: "Day 3 after checkout expiry, morning"
subject_line_a: "10% off to finish your book"
subject_line_b: "Last nudge, with a small thank-you"
subject_line_c: "if you want it, here's an easier yes"
recommended_subject: "a"
preview_text: "FINISHORDER10 — good for 48 hours"
cta: "Finish with FINISHORDER10"
status: draft
---

# Email 3: Finish Order

## Subject Line Variants

### A: "10% off to finish your book" — recommended
Direct, transparent, 29 chars. This is the one subject where discount-forward is correct — the reader either wants the prompt or doesn't, and the code makes the decision easy.

### B: "Last nudge, with a small thank-you"
Warmer framing. Positions the offer as appreciation rather than a hook. 33 chars. Reads as considerate.

### C: "if you want it, here's an easier yes"
Uses the brand's signature "easy yes." Lowercase. Personal. Soft. Best for sensitive audiences.

**Recommended A/B test:** A vs C
**Reason:** Tests offer-first against brand-voice-first recovery. Winner determines whether this audience needs a nudge or an invitation.

## Preview Text
"FINISHORDER10 — good for 48 hours"

## Send Timing
Day 3 after checkout expiry — morning (8:00 AM recipient TZ or ET default).
Two full days of breathing room after the last email. Creates genuine space before the final ask. 48-hour code window gives enough urgency to decide without feeling trapped.

---

## Email Copy (Plain Text)

{{first_name | default:"Hi"}},

Last nudge. Promise.

Your book is still waiting in the cart, and here's one small thing to make it an easier yes:

**FINISHORDER10** — 10% off to finish your order. Good for 48 hours.

At the current sizes:

- 30-page PDF: $24.99 → $22.49
- 50-page print spiral: $54 → $48.60
- 100-page print spiral: $99 → $89.10

Finish your book: {{checkout_resume_url}}?promo=FINISHORDER10

If you've decided it's not for you, no hard feelings. The cart will clear on its own and we'll stop sending the recovery emails.

— Little Color Book

P.S. If you were weighing PDF vs print, here's the honest rule of thumb: PDF is for tonight's coloring. Spiral print is for the coffee table or grandma's house. Most families eventually want both, but the first one can be either.

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
          <p style="margin:0 0 16px;">Last nudge. Promise.</p>
          <p style="margin:0 0 16px;">Your book is still waiting in the cart, and here's one small thing to make it an easier yes:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff4e6;border-radius:8px;padding:20px;margin:0 0 16px;">
            <tr><td align="center" style="font-size:22px;font-weight:700;color:#d2691e;">FINISHORDER10</td></tr>
            <tr><td align="center" style="font-size:14px;color:#666;padding-top:4px;">10% off to finish your order — good for 48 hours</td></tr>
          </table>
          <p style="margin:0 0 8px;">At the current sizes:</p>
          <ul style="margin:0 0 16px;padding-left:20px;">
            <li style="margin-bottom:6px;">30-page PDF: $24.99 → $22.49</li>
            <li style="margin-bottom:6px;">50-page print spiral: $54 → $48.60</li>
            <li>100-page print spiral: $99 → $89.10</li>
          </ul>
          <p style="margin:24px 0;text-align:center;">
            <a href="{{checkout_resume_url}}?promo=FINISHORDER10" style="background:#d2691e;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Finish your book</a>
          </p>
          <p style="margin:0 0 16px;">If you've decided it's not for you, no hard feelings. The cart will clear on its own and we'll stop sending the recovery emails.</p>
          <p style="margin:0 0 8px;">— Little Color Book</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> If you were weighing PDF vs print, the honest rule of thumb: PDF is for tonight's coloring. Spiral print is for the coffee table or grandma's house. Most families eventually want both, but the first can be either.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
