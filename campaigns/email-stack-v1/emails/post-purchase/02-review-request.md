---
email: 2
sequence: post-purchase
purpose: Ask for a reply or review after they've had time to actually use the book
send_day: 5
send_time: "Day 5 post-delivery, Saturday at 9:30 AM ET"
subject_line_a: "Quick favor (takes 30 seconds)"
subject_line_b: "Did the book do its job?"
subject_line_c: "how'd it go?"
recommended_subject: "a"
preview_text: "A sentence or a photo — whichever is easier"
cta: "Reply with a photo or leave a review"
status: draft
---

# Email 2: Review / Reply Request

## Subject Line Variants

### A: "Quick favor (takes 30 seconds)" — recommended
Sets expectation (low time cost) and frames the ask as mutual. 31 chars. High open rate formula for post-purchase.

### B: "Did the book do its job?"
Curiosity-led. Question form. Frames the product as a tool with a purpose — which aligns with the screen-free-win angle.

### C: "how'd it go?"
Lowercase, casual, like texting a friend after a party. Lowest open risk but highest warmth.

**Recommended A/B test:** A vs B
**Reason:** Tests favor-framing vs product-outcome framing. Reveals whether reply rate is higher with social-contract asks or product-curiosity asks.

## Preview Text
"A sentence or a photo — whichever is easier"

## Send Timing
Day 5 post-delivery — Saturday at 9:30 AM ET.
Weekend morning, enough time after delivery for the book to have actually been used. Saturday 9:30 is when moms are unhurried with a coffee.

---

## Email Copy (Plain Text)

{{first_name | default:"Hi"}},

Quick favor.

If the book has had a chance to sit with your kid — even just one page colored — I'd love a line back from you. Two options, whichever is easier:

**Option 1: Hit reply.**
One sentence about how it landed. A photo of a colored page if you have one. I read every one. If you'd rather send feedback (something to improve, something that wasn't right), that works too.

**Option 2: Leave a quick review.**
If you're comfortable, a short review helps other parents decide if this is for them. Here's the link: {{review_url}}

Either one helps us make this better. Both help other families find it.

No pressure if you haven't cracked it open yet. Save this email for when you do.

— Little Color Book

P.S. If you want to share on Instagram, tag @littlecolorbook. We repost family pages (with permission) every week.

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
          <p style="margin:0 0 16px;">Quick favor.</p>
          <p style="margin:0 0 16px;">If the book has had a chance to sit with your kid — even just one page colored — I'd love a line back from you. Two options, whichever is easier:</p>
          <p style="margin:0 0 8px;"><strong>Option 1: Hit reply.</strong></p>
          <p style="margin:0 0 16px;">One sentence about how it landed. A photo of a colored page if you have one. I read every one. Feedback (something to improve) also welcome.</p>
          <p style="margin:0 0 8px;"><strong>Option 2: Leave a quick review.</strong></p>
          <p style="margin:0 0 16px;">If you're comfortable, a short review helps other parents decide if this is for them.</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="{{review_url}}" style="background:#d2691e;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Leave a review</a>
          </p>
          <p style="margin:0 0 16px;">Either one helps us make this better. Both help other families find it.</p>
          <p style="margin:0 0 16px;">No pressure if you haven't cracked it open yet. Save this email for when you do.</p>
          <p style="margin:0 0 8px;">— Little Color Book</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> If you want to share on Instagram, tag @littlecolorbook. We repost family pages (with permission) every week.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
