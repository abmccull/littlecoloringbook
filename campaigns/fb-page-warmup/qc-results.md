# Warm-up Image QC Results

**Generated:** 2026-04-17, 50 images via `scripts/generate-warmup-pages.mjs`
**Runtime:** 14.2s (all 50 Gemini calls fired in parallel, 0 failures)
**Output:** `campaigns/fb-page-warmup/images/*.png`

## Rating rubric
- **STRONG** — publish-ready; clean line art, readable face/subject, no rule violations, strong composition
- **PASS** — publish-ready; clean enough for social, minor imperfections
- **MARGINAL** — usable with caveat (rule violation like solid black fill, stippling, preserved text); fine for social where artistic choices read as intentional
- **FAIL** — do not use

## Results by image

| # | File | Rating | Notes |
|---|------|--------|-------|
| 01 | family — beach family of 3 | PASS | Clean, readable, slight cluttered composition |
| 02 | family — parents + baby | PASS | Clean; oval frame artifact but intentional-looking |
| 03 | family — solo child hoodie | MARGINAL | Light sketchy background |
| 04 | family — trio hugging | STRONG | Great emotional composition, great use candidate |
| 05 | family — same as 01 reshot | PASS | Similar to 01 — duplicate risk |
| 06 | family — mom + baby pacifier | MARGINAL | Baby accessory reads odd |
| 07 | family — toddler pigtails portrait | STRONG | Readable face, soft detail |
| 08 | family — mom laughing w/ toddler | STRONG | Warm composition |
| 09 | family — mom + girl from behind | PASS | Less engaging, face hidden |
| 10 | family — mom + daughter portrait | STRONG | Clean, strong eye contact |
| 11 | family — picnic of 3 | PASS | Clean composition |
| 12 | family — landscape w/ baby on shoulders | STRONG | Beautiful scenic composition |
| 13 | family — mom + sleeping newborn | STRONG | Gorgeous keepsake-feeling shot |
| 14 | family — dad cradling baby | MARGINAL | Busy sketchy blanket lines |
| 15 | family — siblings hugging | STRONG (w/ caveat) | Clear sibling-angle fit; some hatching on clothing |
| 16 | family — parents + baby trio | MARGINAL | Solid black hair fills violate prompt |
| 17 | family — two boys on vintage chair | STRONG | Excellent, unique composition |
| 18 | family — adult cradling girl | PASS | Clean, sweet |
| 19 | kids — young girl portrait | PASS | Clean, slightly wistful |
| 20 | kids — boy cardigan full-body | STRONG | Full-body rare; polished |
| 21 | kids — boy face close-up | STRONG | Huge expressive eyes, readable |
| 22 | kids — young teen boy | PASS | Minimal but strong |
| 23 | kids — boy leaning | PASS | Good composition |
| 24 | kids — toddler with puppies | MARGINAL | Solid-black shirt fill |
| 25 | kids — boy looking up | MARGINAL | Stippled/dotted jacket |
| 26 | kids — woman w/ bouquet | MARGINAL | Miscategorized (adult, not kid); weird background |
| 27 | kids — boy portrait | MARGINAL | Stippled hair texture |
| 28 | kids — boy walking | STRONG | Full-body w/ action |
| 29 | kids — baby under tree | PASS | Nice composition, 1 stray line |
| 30 | kids — baby + mountain backdrop | PASS | Clean, simple |
| 31 | kids — young person w/ collar | PASS | Minor hatching on collar |
| 32 | kids — girl eating | PASS | Everyday, relatable |
| 33 | kids — young boy portrait | PASS | Clean |
| 34 | kids — toddler w/ scarf | STRONG | Strong emotion, premium feel |
| 35 | pets — golden retriever face | STRONG | Clean, friendly |
| 36 | pets — Weimaraner portrait | STRONG | Elegant, minimal |
| 37 | pets — small fluffy dog | STRONG | Adorable, social-ready |
| 38 | pets — corgi w/ "CHANEL" bandana | SKIP | Preserved brand text — IP risk |
| 39 | pets — dog on ledge | PASS | Clean |
| 40 | pets — Jack Russell type | PASS | Clean |
| 41 | pets — pug in collared shirt | STRONG | Unique, memorable |
| 42 | pets — goldendoodle face | PASS | Detailed but still clean |
| 43 | pets — Weimaraner full-body | STRONG | Elegant full-body rare |
| 44 | pets — French bulldog | STRONG | Expression + cuteness |
| 45 | pets — golden retriever w/ harness | PASS | Clean |
| 46 | pets — boxer puppy laying | STRONG | Puppy appeal |
| 47 | pets — dog w/ bandana laying | STRONG | Great "lifestyle" vibe |
| 48 | pets — wolf-like dog | PASS | Clean |
| 49 | pets — Siberian husky | STRONG | Crisp composition |
| 50 | pets — golden retriever close | STRONG | Bright and friendly |

## Top 15 recommended for posts
**Family / people:** 04, 07, 08, 10, 12, 13, 15 (sibling angle), 17, 20, 34
**Pets:** 35, 37, 44, 46, 49

## Excluded
- **38** (pets-corgi CHANEL bandana) — preserved brand text, skip for safety

## Duplicates / near-duplicates flagged
- **01** ≈ **05** (same family of 3, similar pose) — use only one
