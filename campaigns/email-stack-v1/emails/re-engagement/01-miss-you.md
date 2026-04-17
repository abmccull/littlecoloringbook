---
email: 1
sequence: re-engagement
purpose: Warm reconnection with lapsed customers (90+ days). No offer. Just "hey, remember us?"
send_day: 0
send_time: "Day 0, Tuesday at 7:30 AM ET"
subject_line_a: "It's been a minute"
subject_line_b: "Your coloring book is older than you think"
subject_line_c: "hi again"
recommended_subject: "a"
preview_text: "And the camera roll has gotten bigger"
cta: "Reply with what they're up to"
status: draft
---

# Email 1: Miss You

## Subject Line Variants

### A: "It's been a minute" — recommended
Casual, warm, acknowledges the gap without making it weird. 19 chars. Mobile perfect.

### B: "Your coloring book is older than you think"
Curiosity + gentle prod. Implies there's new photos to turn into pages. Slightly clever — could polarize.

### C: "hi again"
Lowercase, soft, low-pressure. Best for reactivating the quietest segments.

**Recommended A/B test:** A vs C
**Reason:** Tests warm-casual vs minimalist-warm for a cold segment. Both are low-pressure; winner indicates whether lapsed customers want conversation or just a gentle ping.

## Preview Text
"And the camera roll has gotten bigger"

## Send Timing
Day 0 — Tuesday at 7:30 AM ET.
Early morning window for a segment that needs a gentle entry back into the inbox relationship. Tuesday outperforms Monday.

---

## Email Copy (Plain Text)

{{first_name | default:"Hi"}},

It's been a little while. Hope things are good on your end.

I was thinking about you because a few of the families who made books early on are on their third or fourth one now. Different sizes, different moments — one birthday, one summer, one "just because it's the dog's year."

If that first book is still somewhere in the house, I'd bet the camera roll has changed a lot since you made it. A new pet? A first day of something? A cousin everyone only sees at Christmas?

No offer attached to this one. Just wanted to say hi, and if there's anything you've been meaning to make, the builder is here when you're ready: {{builder_url}}

And if the first book didn't quite work for you — wrong size, photo issue, anything — hit reply and tell me. I'd rather know.

— Little Color Book

P.S. If you're here for a specific occasion (birthday in the next few weeks, holiday coming up, grandparent's anniversary), reply and tell me what it is. I'll send back a shortcut.

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
          <p style="margin:0 0 16px;">It's been a little while. Hope things are good on your end.</p>
          <p style="margin:0 0 16px;">I was thinking about you because a few of the families who made books early on are on their third or fourth one now. Different sizes, different moments — one birthday, one summer, one "just because it's the dog's year."</p>
          <p style="margin:0 0 16px;">If that first book is still somewhere in the house, I'd bet the camera roll has changed a lot since you made it. A new pet? A first day of something? A cousin everyone only sees at Christmas?</p>
          <p style="margin:0 0 16px;">No offer attached to this one. Just wanted to say hi. The builder is here when you're ready: <a href="{{builder_url}}" style="color:#d2691e;">make a book</a>.</p>
          <p style="margin:0 0 16px;">And if the first book didn't quite work for you — wrong size, photo issue, anything — hit reply and tell me. I'd rather know.</p>
          <p style="margin:0 0 8px;">— Little Color Book</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> If you're here for a specific occasion (birthday in the next few weeks, holiday coming up, grandparent's anniversary), reply and tell me what it is. I'll send back a shortcut.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
