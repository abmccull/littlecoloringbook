---
email: 2
sequence: abandonment
purpose: Day-later follow-up. Answer the "is it actually going to turn out" question with proof.
send_day: 1
send_time: "Hour 24 after checkout expiry"
subject_line_a: "Does it actually turn out?"
subject_line_b: "A quick look at what you'd be getting"
subject_line_c: "still thinking about the book?"
recommended_subject: "a"
preview_text: "Real pages from real families (not stock)"
cta: "See how it turns out"
status: draft
---

# Email 2: Does It Actually Work

## Subject Line Variants

### A: "Does it actually turn out?" — recommended
Directly addresses the #1 cart-abandonment objection in a personalized product. Question form. 27 chars. Opens high.

### B: "A quick look at what you'd be getting"
Utility-first, implies proof content. Good for readers who abandoned over price anxiety.

### C: "still thinking about the book?"
Lowercase, gentle, conversational. Lower open pressure but warm.

**Recommended A/B test:** A vs B
**Reason:** Tests objection-surfacing against proof-offering. Winner tells us which recovery frame pulls harder for this product — answering the fear or showing the result.

## Preview Text
"Real pages from real families (not stock)"

## Send Timing
Hour 24 after checkout expiry.
Full day later. Removes same-day pressure. Still inside the "I was thinking about this yesterday" memory window.

---

## Email Copy (Plain Text)

{{first_name | default:"Hi"}},

The honest answer to "does it actually turn out" — usually yes. Sometimes not quite. When it doesn't, we fix it.

Here's what helps it turn out the first time:

**Good photos for coloring pages look like:**
- Faces clearly visible, not in shadow
- One main subject, not a busy background
- Natural light if possible
- Candid over posed (a real smile beats a forced one)

**Photos that tend to struggle:**
- Very small faces in a group shot
- Heavy filters or portrait-mode blur
- Dark or low-light shots
- Photos cropped so tight the eyes are at the edge

If you pick 12+ photos and most of them fit the first list, the book comes out right the first time. If one or two don't, we regenerate those pages for free — just reply to the delivery email.

See real pages from real families: {{proof_url}}

When you're ready to finish up, your cart is still saved: {{checkout_resume_url}}

— Little Color Book

P.S. If the sticking point was something other than photo worry — price, shipping, sizing — hit reply. Happy to help.

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
          <p style="margin:0 0 16px;">The honest answer to "does it actually turn out" — usually yes. Sometimes not quite. When it doesn't, we fix it.</p>
          <p style="margin:0 0 16px;">Here's what helps it turn out the first time:</p>
          <p style="margin:0 0 8px;"><strong>Good photos for coloring pages look like:</strong></p>
          <ul style="margin:0 0 16px;padding-left:20px;">
            <li style="margin-bottom:6px;">Faces clearly visible, not in shadow</li>
            <li style="margin-bottom:6px;">One main subject, not a busy background</li>
            <li style="margin-bottom:6px;">Natural light if possible</li>
            <li>Candid over posed (a real smile beats a forced one)</li>
          </ul>
          <p style="margin:0 0 8px;"><strong>Photos that tend to struggle:</strong></p>
          <ul style="margin:0 0 16px;padding-left:20px;">
            <li style="margin-bottom:6px;">Very small faces in a group shot</li>
            <li style="margin-bottom:6px;">Heavy filters or portrait-mode blur</li>
            <li style="margin-bottom:6px;">Dark or low-light shots</li>
            <li>Photos cropped so tight the eyes are at the edge</li>
          </ul>
          <p style="margin:0 0 16px;">Pick 12+ photos that fit the first list. If one or two don't turn out, we regenerate those pages for free — just reply to the delivery email.</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="{{checkout_resume_url}}" style="background:#d2691e;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Finish your book</a>
          </p>
          <p style="margin:0 0 16px;">Or <a href="{{proof_url}}" style="color:#d2691e;">see real pages from real families</a> first.</p>
          <p style="margin:0 0 8px;">— Little Color Book</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> If the sticking point was something other than photo worry — price, shipping, sizing — hit reply. Happy to help.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
