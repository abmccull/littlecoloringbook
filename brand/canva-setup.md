# Canva Brand Kit + Template Setup — Little Color Book

Step-by-step to get the Canva Connect integration populated so the creative-fulfillment pipeline has templates to autofill.

## Prerequisites (already done)

- ✅ Canva Connect integration registered
- ✅ `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_REFRESH_TOKEN` in Vercel production
- ✅ `CREATIVE_FULFILLMENT_ENABLED=true` in Vercel production
- ⏳ **This doc** — the brand kit + templates in Canva itself

## Part 1 — Brand Kit (one-time, ~15 min)

Canva brand kits live per-team. Create these so every template uses consistent colors, fonts, and logo.

1. Canva home → **"Brand"** in left nav → **"Brand Kits"** → **"Create new"**
2. Name: **`Little Color Book`**

### Colors (paste as hex)

Copy each exactly — these are canonical from `brand/brand-guidelines.md`:

| Role | Name | Hex |
|---|---|---|
| Primary text | Ink | `#241813` |
| Primary action | Coral | `#D95B42` |
| Base surface | Cream | `#FFF8F2` |
| Secondary surface | Paper | `#FFFDFC` |
| Accent — warm | Apricot | `#F8C8AA` |
| Accent — highlight | Sunshine | `#F6D660` |
| Accent — calm | Mint | `#72C8A0` |
| Accent — cool | Sky | `#9ADAF5` |
| Support text | Cocoa | `#7D4D3B` |
| Soft surface | Fog | `#F4E7DA` |

### Fonts

- **Display / Headlines**: Bree Serif
- **Body / UI**: Nunito Sans
- **Accent / Playful annotations**: Patrick Hand

All three are free on Canva. Search and pin them to the brand kit.

### Logo

Upload `apps/web/public/brand-logo.png` as the primary logo. Add monochrome versions if/when you have them.

### Voice snippets (Canva has a "brand voice" section)

Paste these directly from `brand/voice-profile.md` — Canva will use them when you ask its AI to draft copy:

- **About**: "Little Color Book turns family photos into personalized coloring books. Warm, practical, screen-free — like a capable mom friend who already found the easiest thoughtful thing to do with the photos on your phone."
- **Vocabulary to prefer**: favorite photos, camera roll, screen-free, quiet time, keepsake, giftable, print tonight, spiral book, easy yes, rainy afternoon, grandma copy
- **Vocabulary to avoid**: funnel, workflow, queued, pipeline, SKU, AI-powered, revolutionize

## Part 2 — Templates

Canva "Brand Templates" are the things the API autofills. Each template has named placeholder fields — **the field names must match what our pipeline sends, or you'll have to pass a `canvaFieldMapping` override in the brief**.

### Default field names our pipeline sends (use these exact names in Canva)

| Field key in Canva | Type | Pipeline role |
|---|---|---|
| `hero_image` | Image placeholder | Main visual — usually the coloring page or before/after composite |
| `hook_text` | Text | Top-of-card attention grabber (e.g. "This used to be a selfie.") |
| `body_text` | Text | Supporting line (e.g. "Turn your camera roll into a keepsake they'll actually use.") |
| `cta_text` | Text | Button / action prompt (e.g. "Try one free →") |

**How to name a field in Canva:** click the element → right-click → "Edit placeholder" → set the field name to `hero_image` / `hook_text` / `body_text` / `cta_text`. (In the Canva UI this is sometimes called "field key" or "tag".)

If a template needs a field name that doesn't match, the brief passes `canvaFieldMapping: { "headline": "hook_text" }` etc. — but it's cleaner to standardize on the defaults.

### Template 1 — Static Hero Ad (highest priority)

**Use for:** Meta feed placements, the single-image version of a Meta creative.
**Dimensions:** 1080 × 1080 (square) — we crop 4:5, 9:16, 16:9 downstream.

**Layout:**
- `hero_image` fills ~70% of the canvas (centered or top, depending on variant)
- `hook_text` overlaid bottom or top-right, max ~8 words, **Bree Serif**, Ink color
- `body_text` below hook, max ~15 words, **Nunito Sans**, Ink
- `cta_text` as a pill button, Coral background, Paper text, **Nunito Sans bold**

**Variants to build** (3 versions of the same template, different compositions):
- V1 — image left, text right (desktop-feel)
- V2 — image full-bleed, text bottom overlay on a Cream/Paper strip
- V3 — image top, text bottom on Fog surface

All three export the same field keys; they're just different visual treatments the algorithm can test against each other.

### Template 2 — Before / After Carousel Slide (high priority)

**Use for:** Meta carousel ads + FB organic carousel posts we just wired up.
**Dimensions:** 1080 × 1080.

**Key constraint:** the brief's `hero_image` will already be the composited before/after. Don't try to split into two image slots — the pipeline gives you one image with the split baked in.

**Layout:**
- `hero_image` fills entire canvas as the background
- `hook_text` overlays top in a bold band — **Bree Serif**, on a Coral or Sunshine strip
- `body_text` overlays bottom-left in a Cream/Paper card
- `cta_text` pill in the bottom-right (Coral + Paper)

### Template 3 — Carousel Card — "How It Works" slide (high priority)

**Use for:** Multi-card carousels (process explainer, 5 cards).
**Dimensions:** 1080 × 1080.

**Layout:**
- Step number (top-left, large, Patrick Hand — decorative)
- `hero_image` center-stage, 70% width
- `hook_text` above or below image (1 line, Bree Serif)
- `body_text` bottom (1–2 lines, Nunito Sans)
- No CTA on cards 1–4; CTA only on the last card → use Template 4 for the last card

### Template 4 — Carousel Card — "Final / CTA slide" (high priority)

**Dimensions:** 1080 × 1080.

**Layout:**
- `hero_image` full-bleed background (a finished spiral book photo or a kid coloring)
- Large `hook_text` in Bree Serif, centered
- `body_text` below, Nunito Sans
- `cta_text` pill button, Coral + Paper, prominent

### Template 5 — Story / Reel cover (medium priority)

**Dimensions:** 1080 × 1920 (9:16).

**Layout:**
- `hero_image` full-bleed
- Top-safe zone (top 250px) and bottom-safe zone (bottom 350px) kept clean of text
- `hook_text` top-center, large, Bree Serif on a Cream card
- `body_text` middle overlay, small, Nunito Sans
- `cta_text` bottom pill, Coral + Paper

### Template 6 — Gift angle / grandparent variant (medium priority)

Same structure as Template 1 but visual direction different — warm, holiday-adjacent, "surprise reveal" energy. Use Apricot + Cocoa accent instead of Coral for a softer feel.

This is a variant to test against Template 1 — different audience / emotional angle.

### Templates to skip for now

- Animated templates — the pipeline exports PNG only
- Video-first templates — handled by slideshow_narration_video path via Gamma + ElevenLabs, not Canva

## Part 3 — After building templates

Each Canva Brand Template has a **template ID** (visible in the URL when editing: `canva.com/design/DAGxxx...`). Collect them as you create each one and drop them into:

### `brand/canva-template-registry.md`

Create this file as you go. Shape:

```
| Template name                   | Canva template ID | Dimensions | Status |
|---------------------------------|-------------------|------------|--------|
| Static Hero Ad — V1             | DAGxxxxx1         | 1080x1080  | live   |
| Static Hero Ad — V2             | DAGxxxxx2         | 1080x1080  | live   |
| Before/After Carousel Slide     | DAGxxxxx3         | 1080x1080  | live   |
| How It Works — card             | DAGxxxxx4         | 1080x1080  | live   |
| CTA carousel card               | DAGxxxxx5         | 1080x1080  | live   |
| Story / Reel cover              | DAGxxxxx6         | 1080x1920  | live   |
| Gift angle — grandparent        | DAGxxxxx7         | 1080x1080  | draft  |
```

The template ID goes into each creative brief's `canvaTemplateId` field when the creative system creates the brief. We don't need a new env var — briefs reference the ID inline.

## Part 4 — Optional: test one template end-to-end

Once one template (e.g. Template 1 — Static Hero Ad V1) exists and has an ID:

1. Create a creative brief row in the DB with:

```json
{
  "kind": "static_image",
  "canvaTemplateId": "DAGxxxxx1",
  "canvaFieldMapping": {},
  "hook": "This used to be a selfie.",
  "body": "Turn your camera roll into a keepsake they'll actually use.",
  "cta": "Try one free →",
  "sourcePhoto": "<gcs path to a source photo>"
}
```

2. Insert into `creative_requests` with `status='pending'`
3. Wait up to 30 min for the cron to pick it up (or invoke the route manually via internal job auth)
4. Check the result in `creative_requests.resultJson.assetIds` — you should see a rendered PNG in GCS exports bucket

If the autofill fails, the `resultJson.metadata.canvaFailed` will be true and `canvaError` will have the Canva API's error message — fix the template field names and retry.

## Priority order for template creation

If you want to ship the first paid-ad test ASAP, build in this order:

1. **Template 1 V1** — Static Hero Ad, image-left/text-right variant (5 min in Canva)
2. **Template 2** — Before/After Carousel Slide (needed for the FB organic test we just wired)
3. **Template 1 V2 + V3** — variants for A/B testing
4. **Templates 3 + 4** — for carousel ads
5. **Template 5** — Story/Reel cover
6. **Template 6** — gift-angle variant

Templates 1–2 unlock: Meta single-image prospecting ads + FB organic before/after posts. That's enough to start running paid traffic. The rest can come as you expand creative surface area.
