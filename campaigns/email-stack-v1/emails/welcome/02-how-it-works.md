---
email: 2
sequence: welcome
purpose: Show the range of what's possible — candid photos, pets, siblings, grandparents — so they imagine a full book
send_day: 2
send_time: "Day 2, Thursday at 8:00 AM ET"
subject_line_a: "What other moms colored first"
subject_line_b: "The messy-face photo test"
subject_line_c: "turns out the dog photos work too"
recommended_subject: "a"
preview_text: "Soccer cleats, bath time, and one grandma copy"
cta: "Make another sample with a different photo"
status: draft
---

# Email 2: Proof + Imagination

## Subject Line Variants

### A: "What other moms colored first" — recommended
Safe, curiosity-driven, social proof in the subject. "Other moms" signals community and normalizes the product. Under 40 chars.

### B: "The messy-face photo test"
Bold play. Specific + unexpected. Hooks on the idea that candid photos work better than posed ones — a useful, shareable insight that pulls the reader in.

### C: "turns out the dog photos work too"
Personal / lowercase. Makes the brand feel like a friend who just discovered something. Works great for IG-acquired subscribers.

**Recommended A/B test:** A vs B
**Reason:** Tests social proof vs intrigue. Winner tells us whether this audience wants to feel like part of a group or wants to be let in on a secret.

## Preview Text
"Soccer cleats, bath time, and one grandma copy"

## Send Timing
Day 2 — Thursday at 8:00 AM ET.
Early morning B2C window when moms are scrolling before the school run. Thursday outperforms Monday (inbox cleanup day).

---

## Email Copy (Plain Text)

{{first_name | default:"Hey"}} —

Quick peek at what other families have been coloring lately:

A kid in Texas made a 30-page book from one summer — soccer practice, birthday cake, the neighbor's golden retriever, her little brother mid-tantrum. She calls it her "my year" book.

A mom in Oregon made a 50-page spiral book as her parents' anniversary gift. Twenty pages from her childhood, thirty from the grandkids.

A dad in Pennsylvania made a 100-page book from every pet the family has ever had. Three dogs, two cats, one very patient hamster.

The pattern: the photos that make the best coloring pages aren't the perfect ones. They're the specific ones. The ones with a story.

Open your camera roll right now. What's the first photo that made you smile?

Try it: {{sample_url_new}}

— Little Color Book

P.S. A lot of parents are surprised pets work this well. They do. So do siblings, grandparents, and the same kid at ages 2, 4, and 6 in a row.

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
          <p style="margin:0 0 16px;">{{first_name | default:"Hey"}} —</p>
          <p style="margin:0 0 16px;">Quick peek at what other families have been coloring lately:</p>
          <p style="margin:0 0 16px;">A kid in Texas made a 30-page book from one summer — soccer practice, birthday cake, the neighbor's golden retriever, her little brother mid-tantrum. She calls it her "my year" book.</p>
          <p style="margin:0 0 16px;">A mom in Oregon made a 50-page spiral book as her parents' anniversary gift. Twenty pages from her childhood, thirty from the grandkids.</p>
          <p style="margin:0 0 16px;">A dad in Pennsylvania made a 100-page book from every pet the family has ever had. Three dogs, two cats, one very patient hamster.</p>
          <p style="margin:0 0 16px;">The pattern: the photos that make the best coloring pages aren't the perfect ones. They're the specific ones. The ones with a story.</p>
          <p style="margin:0 0 16px;">Open your camera roll right now. What's the first photo that made you smile?</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="{{sample_url_new}}" style="background:#d2691e;color:#ffffff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Try another photo</a>
          </p>
          <p style="margin:0 0 8px;">— Little Color Book</p>
          <p style="margin:24px 0 0;font-size:14px;color:#666;"><strong>P.S.</strong> A lot of parents are surprised pets work this well. They do. So do siblings, grandparents, and the same kid at ages 2, 4, and 6 in a row.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```
