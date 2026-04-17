---
email: 5
sequence: welcome
purpose: Graceful final check-in. Remove pressure. Offer one low-friction path forward (help reply) and one escape hatch (second sample).
send_day: 14
send_time: "Day 14, Wednesday at 7:30 AM ET"
subject_line_a: "Still thinking? No rush."
subject_line_b: "What moms actually did with theirs"
subject_line_c: "quick question before I stop"
recommended_subject: "a"
preview_text: "Here's the help reply button, no offer attached"
cta: "Reply with what's holding you up (or make another sample)"
status: draft
---

# Email 5: Final Check-In

## Subject Line Variants

### A: "Still thinking? No rush." — recommended
Honest and low-pressure. The "no rush" frame signals trust. Reads warm, not sales-y. 22 chars. Mobile perfect.

### B: "What moms actually did with theirs"
Content-forward, one more value hit in case the previous emails weren't compelling enough. Slight social-proof lean.

### C: "quick question before I stop"
Lowercase, conversational, implies this is the last one (which it is). Encourages reply — the highest-signal engagement we can get from a cold subscriber.

**Recommended A/B test:** A vs C
**Reason:** Tests warm pressure-relief vs personal last-chance framing. Either pulls replies, which is what this email is actually for.

## Preview Text
"Here's the help reply button, no offer attached"

## Send Timing
Day 14 — Wednesday at 7:30 AM ET.
Fourteen days is enough space without going cold. Wednesday morning avoids Monday inbox overload and Friday mental checkout.

---

## Email Copy (Plain Text)

{{first_name | default:"Hey"}},

Last one from me for a while, promise.

If you tried your sample and loved it — I'd love to see what you make. Hit reply with a picture of the first page your kid colored. It genuinely makes my week.

If you tried it and something didn't land — the photo looked weird, the page didn't feel right, you weren't sure which size to pick — tell me what happened. I'll help you figure it out. No purchase pressure.

And if life just got busy, that's fine too. Your free sample stays right where it is: {{sample_url}}

You can also make a second one any time with a different photo. It's still free: {{sample_url_new}}

Either way, thanks for giving Little Color Book a look. The `FIRSTBOOK10` code is still good for a few more days if you want it.

— Little Color Book

P.S. If you want to hear from us again, you don't need to do anything. We'll send one note a month — ideas, new seasonal books, occasional offers. No spam. You can always opt out at the bottom of any email.

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
          <p style="margin:0 0 16px;">{{first_name | default:"Hey"}},</p>
          <p style="margin:0 0 16px;">Last one from me for a while, promise.</p>
          <p style="margin:0 0 16px;">If you tried your sample and loved it — I'd love to see what you make. Hit reply with a picture of the first page your kid colored. It genuinely makes my week.</p>
          <p style="margin:0 0 16px;">If you tried it and something didn't land — the photo looked weird, the page didn't feel right, you weren't sure which size to pick — tell me what happened. I'll help you figure it out. No purchase pressure.</p>
          <p style="margin:0 0 16px;">And if life just got busy, that's fine too. Your free sample stays right where it is: <a href="{{sample_url}}" style="color:#d2691e;">grab it here</a>.</p>
          <p style="margin:0 0 16px;">You can also make a second one any time with a different photo. It's still free: <a href="{{sample_url_new}}" style="color:#d2691e;">try another photo</a>.</p>
          <p style="margin:0 0 16px;">Either way, thanks for giving Little Color Book a look. The <strong>FIRSTBOOK10</strong> code is still good for a few more days if you want it.</p>
          <p style="margin:0 0 8px;">— Little Color Book</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> If you want to hear from us again, you don't need to do anything. We'll send one note a month — ideas, new seasonal books, occasional offers. No spam. You can always opt out at the bottom of any email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
