---
email: 1
sequence: abandonment
purpose: Low-pressure, empathetic first recovery. "Tab closed on you" framing.
send_day: 0
send_time: "Hour 1 after checkout expiry"
subject_line_a: "Looks like the tab closed on you"
subject_line_b: "Your book is still half-made"
subject_line_c: "you were almost there"
recommended_subject: "a"
preview_text: "We saved your photos — pick up where you left off"
cta: "Finish your book (no pressure)"
status: draft
---

# Email 1: Tab Closed

## Subject Line Variants

### A: "Looks like the tab closed on you" — recommended
Empathetic, specific, blames the situation not the person. 34 chars. Much better than "YOU LEFT ITEMS" energy.

### B: "Your book is still half-made"
Subtle incompleteness hook. Creates a gentle pull to finish what was started. Outcome-facing.

### C: "you were almost there"
Lowercase, warm, personal. Low-pressure second option. Works as a lighter-touch alternative for audiences sensitive to recovery emails.

**Recommended A/B test:** A vs B
**Reason:** Tests tech-empathy ("tab closed") against product-state ("still half-made"). Winner indicates whether abandoners respond better to a face-saving exit or a product-pull.

## Preview Text
"We saved your photos — pick up where you left off"

## Send Timing
Hour 1 after checkout expiry.
One-hour delay is ideal — immediate enough to catch them still in the moment, delayed enough to avoid feeling creepy. Trigger-based, ignores day-of-week norms.

---

## Email Copy (Plain Text)

{{first_name | default:"Hi"}},

Looks like the tab closed on you mid-checkout. Happens to everyone.

Good news: we saved your photos and your book is still right where you left it. You can pick it up here:

{{checkout_resume_url}}

No pressure at all. If you decided not to go through with it, that's fine too — the cart clears itself out eventually. And if something didn't feel right (price, shipping, a photo issue), hit reply and tell me. I'll sort it out.

— Little Color Book

P.S. The most common reason a checkout gets interrupted is "wait, did I pick the right size?" If that's what happened: 30-page is the entry, 50-page is the fuller middle, 100-page is the keepsake. When in doubt, 50 is the safest guess for a first book.

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
          <p style="margin:0 0 16px;">Looks like the tab closed on you mid-checkout. Happens to everyone.</p>
          <p style="margin:0 0 16px;">Good news: we saved your photos and your book is still right where you left it.</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="{{checkout_resume_url}}" style="background:#d2691e;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Pick up where you left off</a>
          </p>
          <p style="margin:0 0 16px;">No pressure at all. If you decided not to go through with it, that's fine too — the cart clears itself out eventually. And if something didn't feel right (price, shipping, a photo issue), hit reply and tell me. I'll sort it out.</p>
          <p style="margin:0 0 8px;">— Little Color Book</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> The most common reason a checkout gets interrupted is "wait, did I pick the right size?" If that's what happened: 30-page is the entry, 50-page is the fuller middle, 100-page is the keepsake. When in doubt, 50 is the safest guess for a first book.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
