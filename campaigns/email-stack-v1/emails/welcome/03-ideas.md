---
email: 3
sequence: welcome
purpose: Plant use-case ideas (rainy afternoon, birthday gift, grandma copy) so they see when/why they'd order a full book
send_day: 5
send_time: "Day 5, Sunday at 7:30 PM ET"
subject_line_a: "Rainy afternoon, birthday bag, grandma copy"
subject_line_b: "Three ways to use a full book"
subject_line_c: "save this for the next rainy saturday"
recommended_subject: "a"
preview_text: "The three moments a coloring book actually saves"
cta: "See the 30/50/100-page options"
status: draft
---

# Email 3: Use-Case Moments

## Subject Line Variants

### A: "Rainy afternoon, birthday bag, grandma copy" — recommended
Triple-hook with concrete family moments. 44 chars. Uses the exact brand vocabulary. Creates three mental images in one line. Outcome-first.

### B: "Three ways to use a full book"
Cleaner utility frame. Works if the A version feels too whimsical in the subject line (it doesn't in context, but worth testing).

### C: "save this for the next rainy saturday"
Personal, lowercase, specific. Functions like a note-to-self the reader saves. Lower open but higher depth of read.

**Recommended A/B test:** A vs B
**Reason:** Tests imagery-rich vs utility-first subjects. Moms often respond better to specific moments, but utility can win if inbox is crowded.

## Preview Text
"The three moments a coloring book actually saves"

## Send Timing
Day 5 — Sunday at 7:30 PM ET.
Sunday evening is when parents mentally plan the week. Good moment to plant "what will we do this week" ideas.

---

## Email Copy (Plain Text)

{{first_name | default:"Hi"}},

Something I've noticed running this: parents rarely buy a full book "just because." They buy it for a specific moment. Usually one of three:

**The rainy afternoon.**
School's out. It's pouring. The iPad is looking too tempting again. A coloring book with pages of your own kids, your own dog, your own backyard — that's a 45-minute screen-free win you didn't have to plan.

**The birthday bag.**
Slip a 30-page book into a gift bag instead of another plastic toy. Every page is a photo from the year. Parents of the birthday kid never throw it out. Neither does the kid.

**The grandma copy.**
Grandparents don't want more decor. They want connection. A spiral book of the grandkids — or the grandkids AND themselves — lives on the kitchen counter and gets picked up every time someone visits.

Each of these usually maps to a different size:

- 30 pages — the easy entry, great for one birthday or one season
- 50 pages — the fuller middle choice, good for a full year
- 100 pages — the best-value keepsake, built to last

You can make one from your camera roll in about 15 minutes: {{builder_url}}

— Little Color Book

P.S. The 100-page is the one that ends up on the coffee table. It's also the best math per page.

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
          <p style="margin:0 0 16px;">Something I've noticed running this: parents rarely buy a full book "just because." They buy it for a specific moment. Usually one of three:</p>
          <p style="margin:0 0 8px;"><strong>The rainy afternoon.</strong></p>
          <p style="margin:0 0 16px;">School's out. It's pouring. The iPad is looking too tempting again. A coloring book with pages of your own kids, your own dog, your own backyard — that's a 45-minute screen-free win you didn't have to plan.</p>
          <p style="margin:0 0 8px;"><strong>The birthday bag.</strong></p>
          <p style="margin:0 0 16px;">Slip a 30-page book into a gift bag instead of another plastic toy. Every page is a photo from the year. Parents of the birthday kid never throw it out. Neither does the kid.</p>
          <p style="margin:0 0 8px;"><strong>The grandma copy.</strong></p>
          <p style="margin:0 0 16px;">Grandparents don't want more decor. They want connection. A spiral book of the grandkids — or the grandkids AND themselves — lives on the kitchen counter and gets picked up every time someone visits.</p>
          <p style="margin:0 0 8px;">Each of these usually maps to a different size:</p>
          <ul style="margin:0 0 16px;padding-left:20px;">
            <li style="margin-bottom:6px;">30 pages — the easy entry, great for one birthday or one season</li>
            <li style="margin-bottom:6px;">50 pages — the fuller middle choice, good for a full year</li>
            <li>100 pages — the best-value keepsake, built to last</li>
          </ul>
          <p style="margin:24px 0;text-align:center;">
            <a href="{{builder_url}}" style="background:#d2691e;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Make your book</a>
          </p>
          <p style="margin:0 0 8px;">— Little Color Book</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> The 100-page is the one that ends up on the coffee table. It's also the best math per page.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
