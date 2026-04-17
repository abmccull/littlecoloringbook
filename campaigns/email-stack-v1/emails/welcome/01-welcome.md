---
email: 1
sequence: welcome
purpose: Welcome new sample subscribers, re-deliver their sample, set the tone
send_day: 0
send_time: "Immediately after sample delivery (trigger-based)"
subject_line_a: "Your sample page is ready"
subject_line_b: "Open your camera roll — you'll want to try this"
subject_line_c: "hey, your first coloring page is inside"
recommended_subject: "a"
preview_text: "Plus one photo tip most parents miss"
cta: "Try it with a second photo"
status: draft
---

# Email 1: Welcome + Sample Delivery

## Subject Line Variants

### A: "Your sample page is ready" — recommended
Short (23 chars), literal, matches the expectation they set when they uploaded. Delivery emails have near-100% open rates if the subject matches the promise. Mobile-safe.

### B: "Open your camera roll — you'll want to try this"
Curiosity + pattern interrupt. Makes them pick up their phone mid-scroll. Bolder but riskier for a brand-new subscriber who doesn't know you yet.

### C: "hey, your first coloring page is inside"
Lowercase, warm, personal. Feels like a text from a mom friend. Good for the IG/TikTok-acquired audience who skews younger and reads lowercase as authentic.

**Recommended A/B test:** A vs C
**Reason:** Tests professional-clear against personal-warm. Winner sets the tone register for the rest of the welcome sequence.

## Preview Text
"Plus one photo tip most parents miss"

## Send Timing
Day 0 — Immediately after sample delivery (event-triggered).
Sample delivery is the peak trust moment. Every hour of delay erodes it.

---

## Email Copy (Plain Text)

Hi {{first_name | default:"there"}},

Your free sample page is ready — it's attached, and here's the link if you'd rather grab it from the cloud: {{sample_url}}

Print it tonight. Hand it to your kid with a crayon. That's the whole thing.

One tip most parents miss: the best photos for coloring pages aren't the posed ones. They're the candids. A messy breakfast face. Your kid mid-laugh in the backyard. The dog photobombing Christmas morning. Those are the ones kids love to color.

Want to try another photo? You can make a second sample any time: {{sample_url_new}}

Over the next couple weeks I'll send you a few short emails — how other moms are using theirs, what to do if your first photo didn't turn out quite right, and some ideas for turning more of your camera roll into something worth keeping.

For now, happy coloring.

— The Little Color Book team

P.S. If the first page didn't come out the way you hoped, hit reply and tell me what happened. I read every one.

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
          <p style="margin:0 0 16px;">Hi {{first_name | default:"there"}},</p>
          <p style="margin:0 0 16px;">Your free sample page is ready — <a href="{{sample_url}}" style="color:#d2691e;text-decoration:underline;">grab it here</a>.</p>
          <p style="margin:0 0 16px;">Print it tonight. Hand it to your kid with a crayon. That's the whole thing.</p>
          <p style="margin:0 0 16px;">One tip most parents miss: the best photos for coloring pages aren't the posed ones. They're the candids. A messy breakfast face. A mid-laugh in the backyard. The dog photobombing Christmas morning. Those are the ones kids love to color.</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="{{sample_url_new}}" style="background:#d2691e;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Try another photo</a>
          </p>
          <p style="margin:16px 0;">Over the next couple weeks I'll send a few short emails — how other moms use theirs, what to do if your first photo didn't turn out quite right, and ideas for turning more of your camera roll into something worth keeping.</p>
          <p style="margin:0 0 16px;">For now, happy coloring.</p>
          <p style="margin:0 0 8px;">— The Little Color Book team</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> If the first page didn't come out the way you hoped, hit reply and tell me what happened. I read every one.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
