---
email: 1
sequence: post-purchase
purpose: Thank customer after delivery, plant usage ideas, avoid duplicating order-lifecycle transactional emails
send_day: 1
send_time: "Day 1 post-delivery, morning in recipient timezone"
subject_line_a: "Thank you — here's what to do with it"
subject_line_b: "Three ways to use your book this week"
subject_line_c: "your book is in the wild now"
recommended_subject: "a"
preview_text: "Rainy afternoon, birthday bag, grandma copy"
cta: "Reply with the first page they color"
status: draft
---

# Email 1: Thank You + Usage Ideas

## Subject Line Variants

### A: "Thank you — here's what to do with it" — recommended
Grateful + forward-looking. Tees up the content. 40 chars. Works whether they got PDF or print.

### B: "Three ways to use your book this week"
Utility-forward, numbered specificity, implies the email has quick scannable value. Safe choice for utility-oriented readers.

### C: "your book is in the wild now"
Playful, lowercase, warm. Shows personality. Lower open potential but higher emotional connection.

**Recommended A/B test:** A vs B
**Reason:** Tests warm-relational against utility-scannable framing for post-delivery customers. Early wins in post-purchase drive retention.

## Preview Text
"Rainy afternoon, birthday bag, grandma copy"

## Send Timing
Day 1 post-delivery — morning in recipient's timezone (or 8:00 AM ET default).
One day after the `order-delivered` transactional fires. Leaves enough space that this doesn't feel stacked with the shipping email.

---

## Email Copy (Plain Text)

{{first_name | default:"Hi"}},

Your book's with you. That's the fun part.

A few ways to actually put it to work:

**The rainy afternoon.**
Pick any day the plans fall through. A coloring book of your own kids, your own dog, your own backyard — that's a 45-minute screen-free win you didn't have to plan. Keep it in the same drawer as the crayons so it's easy to grab.

**The birthday bag.**
Tear out one page as a birthday card. Or slip a second book (30-page PDF works great for this) into a gift bag. Kids open it, ask "wait, is that ME?" It's a moment every time.

**The grandma copy.**
Order a second spiral copy for whichever grandparent lives farthest away. It ends up on their kitchen counter and gets picked up every time the grandkids visit. We see this one a lot.

One favor: when your kid colors the first page, I'd love to see it. Hit reply with a phone pic. I save every one I get.

— Little Color Book

P.S. If something arrived not quite right — a page looks off, a binding issue, anything — just reply to this email. We'll fix it, no questions asked.

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
          <p style="margin:0 0 16px;">Your book's with you. That's the fun part.</p>
          <p style="margin:0 0 16px;">A few ways to actually put it to work:</p>
          <p style="margin:0 0 8px;"><strong>The rainy afternoon.</strong></p>
          <p style="margin:0 0 16px;">Pick any day the plans fall through. Keep the book in the same drawer as the crayons so it's easy to grab.</p>
          <p style="margin:0 0 8px;"><strong>The birthday bag.</strong></p>
          <p style="margin:0 0 16px;">Tear out one page as a birthday card. Or slip a second book into a gift bag. Kids open it, ask "wait, is that ME?"</p>
          <p style="margin:0 0 8px;"><strong>The grandma copy.</strong></p>
          <p style="margin:0 0 16px;">Order a second spiral for whichever grandparent lives farthest away. It ends up on their counter and gets picked up every visit.</p>
          <p style="margin:0 0 16px;">One favor: when your kid colors the first page, I'd love to see it. Hit reply with a phone pic. I save every one I get.</p>
          <p style="margin:0 0 8px;">— Little Color Book</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> If something arrived not quite right — a page looks off, a binding issue, anything — just reply to this email. We'll fix it, no questions asked.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
