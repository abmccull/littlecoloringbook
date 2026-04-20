# Creator Discovery Brief — Little Color Book

**Audience for this brief:** A Claude agent (or human researcher) tasked with sourcing creator partnership candidates across Instagram, TikTok, YouTube, and Facebook.

**Goal of the work:** Produce a prioritized, vetted list of 150–200 creator candidates across 4 platforms and 7+ content categories, with enough data on each to decide whether to pitch a partnership deal.

**Timeline:** First pass within 5 working days. Ongoing discovery as a recurring task once the pilot validates the channel.

---

## 1. Business context

Little Color Book is a DTC brand at **littlecolorbook.com** selling AI-generated personalized coloring books made from customer-uploaded photos. Customers upload photos of their kids, pets, family, or favorite moments; we turn each photo into a printable black-and-white coloring page with AI; customers buy the result as a PDF or a spiral-bound printed book.

**Funnel:**
1. Customer sees ad/content → clicks
2. Lands on littlecolorbook.com/sample → enters email + uploads 1 photo → gets 1 free personalized coloring page (email-delivered)
3. Email sequence + on-page upsell → converts to paid tier
4. Paid tiers: PDF $24.99–$59, printed spiral book + PDF $49–$99

**Pricing ladder (canonical, always verify against `packages/shared/src/offers.ts`):**
- pdf-30: $24.99 (entry point — this is what ads promote)
- pdf-50: $39
- pdf-100: $59
- print-30: $49
- print-50: $54
- print-100: $99

**Why creators matter to this business:**
- Product is high-consideration (upload photos, trust AI output, pay $25+) — cold paid ads convert poorly; creator trust-transfer solves the objection
- Every customer submits an email at the sample step, so creator traffic builds our owned asset on top of driving sales
- Creator content can be whitelisted and re-run as paid ads on Meta, multiplying each partnership's value

**Commercial envelope per partnership:**
- We pay ~$500–1,500 upfront + **25%–35% tiered revenue share** on attributed orders for 90 days
- Ambassador-tier creators: $1–2K/month retainer + ongoing rev share + 6-month category exclusivity
- Break-even CAC is ~$16.65 per customer — creator partnerships must land at or below that to beat our paid Meta baseline

Full deal structure + creator economics math is in the project thread; don't re-derive it. Assume the deal is commercially healthy if the creator's audience converts at industry norms.

---

## 2. Buyer ICP (who our product actually sells to)

Primary buyers, in order of volume:

1. **Moms, 28–45**, 1–3 kids under age 10. Active on social, values memories, has a camera roll full of photos they haven't done anything with. Buys as a rainy-day activity, birthday gift, or "I just want something special for my kid."
2. **Grandparents, 55–70**, with grandkids they don't live near. Buys as a keepsake gift — especially around holidays, birthdays, and visits. Higher AOV, longer sales cycles, strong gift-bundle (multi-copy) purchasers.
3. **Dads, 28–45**. Gift-givers — Mother's Day, birthdays, anniversaries. Low-frequency, high-AOV impulse buyers.
4. **Foster/adoptive parents**. Small segment but *extremely* engaged — the product speaks directly to memory-making with kids they want to bond with.
5. **Teachers, speech-language pathologists (SLPs), occupational therapists (OTs), and special-needs educators.** Use personalized coloring pages as therapy tools. Small absolute numbers, but high repeat and high word-of-mouth in their professional networks.
6. **Aunts, uncles, godparents.** Secondary gift-giving circle. Convert seasonally.
7. **Pet parents.** Product works for pets too. Smaller segment, different creator category to target.

**What the buyer cares about:**
- Turning their own photos into something meaningful
- Personalization ("that's actually MY kid on the page")
- Gift-giving (keepsake, long-lasting)
- Quality (the coloring page looks nice, prints clean)
- Safety/kid-friendly content

---

## 3. Creator ICP (who has the audience that buys this)

We're not just looking for "family creators." We're looking for creators whose audience **already behaves like our buyer base** — posting kid photos, collecting memories, searching for meaningful gifts.

### Tier 1 — Highest alignment (search exhaustively first)

| Category | Why they convert | Keywords / hashtags |
|---|---|---|
| **Mom content / momfluencers** | Largest addressable audience; core buyer | #momlife #momsofinstagram #toddlermom #momblogger #boymom #girlmom #newmom #firsttimemom |
| **Grandparent content** | Underdog category — huge gift-buyer audience, way less creator competition | #grandparentsofinstagram #grandmalife #gigi #nana #grandkids |
| **Foster / adoption creators** | Small but highly engaged audience; product resonates deeply | #fosterfamily #adoptionjourney #fostermom #adoptivemom #fostercare |
| **Craft & kids activity creators** | Audience is "makers" — coloring fits their content slot exactly | #kidscraftsathome #kidsactivities #toddleractivities #busybags #playideasforkids |
| **Family photography (parent-photographers)** | They have photos. They know people with photos. Their audience values photo preservation | #familyphotography #momtogs #lifestylephotographer (with "mom" in bio) |

### Tier 2 — Strong alignment (search after Tier 1 saturates)

| Category | Why they convert |
|---|---|
| **Special-needs / neurodivergent parenting** (autism, ADHD, sensory) | Product works well as a calming tool; community is tight-knit and word-of-mouth-driven |
| **Homeschool creators** | Their audience seeks educational + personalized tools |
| **Birthday / party planning creators** | Gift-content overlaps perfectly with our print SKUs |
| **Gift-guide curators** (often "mom blogger" adjacent) | Literally their job is recommending products like ours |
| **Teacher / classroom creators** (elementary, pre-K, SLP, OT) | Secondary but durable — therapy/classroom use drives repeat |

### Tier 3 — Experimental (test after Tiers 1–2 validate)

| Category | Why potentially interesting |
|---|---|
| **Pet parent creators** (dogs, cats) | Product makes pet coloring books too. Smaller conversion, lower priority |
| **Dad creators** | Under-indexed category; less competition; Father's Day + gifting cycles |
| **Travel-with-kids creators** | Audience takes photos constantly; gift angle works |
| **Military family creators** | Underserved community with strong gift-giving culture, especially deployment-related keepsakes |
| **Multiples / twin parenting** | Niche, tight community, high personalization demand |

---

## 4. Platform-specific search strategies

### Instagram (highest priority platform)

**Best discovery methods:**
1. **Hashtag search.** Start with the hashtags in the Tier 1/2 table above. For each hashtag, pull the top 50 posts from the last 30 days and inventory the posting creators.
2. **Explore page** in an account whose interest graph reflects our ICP (the Little Color Book IG account itself works — its follower/following graph is our reverse lookup).
3. **Cross-reference with YouTube/TikTok.** Many creators exist on all platforms — multi-platform creators are worth more because one deal can drive 3 channels.
4. **Who-follows-who mapping.** Find 5–10 known good creators; pull their followers and "suggested for you" lists; a lot of our ICP clusters.

**Filters:**
- Follower count: 50K–1M (prioritize 150K–500K sweet spot)
- Engagement rate: >3% (for accounts under 200K), >2% (for 200K–500K), >1.5% (for 500K+)
- Posting frequency: 3+ posts per week, active in last 14 days
- Geographic audience: >60% US/CA/UK/AU
- Content style: real kids + real moments, not stock-heavy or overly curated
- Bio signals: mentions kids, family, mom, dad, grandma, teacher, etc.

**Instagram-specific data points to capture:**
- Reel avg views (most important metric — Reels are where reach happens)
- Story view count if visible
- Saves-per-post (strong intent signal)
- DM response rate if known (ambassador tier only)

### TikTok

**Best discovery methods:**
1. **TikTok Creator Marketplace** (if access is available via TikTok for Business). Best single source for vetted creator metrics on the platform.
2. **FYP hashtag search.** Same hashtag seeds as Instagram. TikTok discovery is content-first, so look at who's making videos with our target content style (personalized crafts, "making a gift for my kid," "my kid's reaction to," etc.).
3. **"This is my daughter/son" narrative content** — creators who regularly feature their kids on camera are perfect fits.
4. **Duet/Stitch chains.** If a family creator makes a video that gets heavily stitched by other family creators, those stitchers are all candidates.

**Filters:**
- Follower count: 100K–1M (TikTok requires higher minimums to clear the algorithm noise)
- Avg views per video: 50K+ (more important than follower count on TikTok)
- Engagement rate: >8% (higher benchmark than IG)
- Posts per week: 5+ (TikTok demands frequency to matter)

**TikTok-specific data points:**
- Avg view count on last 10 videos
- Avg completion rate if visible
- How often they pin/highlight sponsored content (indicates deal experience)

### YouTube

**Best discovery methods:**
1. **Keyword search** on "family vlogs," "mom life," "day in the life mom," "grandparent," "foster family journey," "homeschool mom," etc.
2. **Social Blade** for rapid subscriber count + growth rate + views.
3. **VidIQ / TubeBuddy-adjacent public info** — subscriber count, recent upload cadence, avg views.
4. **Playlist mining.** YouTube family-vlog channels often appear in curated playlists; extract channel list from top family-vlog playlists.

**Filters:**
- Subscriber count: 50K–2M (YouTube tolerates a wider range)
- Avg views per video: 30K+
- Upload frequency: 1+ per week (YouTube is slower cadence than short-form)
- Content focus: 70%+ of recent uploads about family/kids content

**YouTube-specific data points:**
- Total views past 30 days (Social Blade is great for this)
- Subscriber-to-view ratio (healthy: 5–15%)
- Monetization signals (mid-roll ads = serious creator, partner program member)
- Community tab engagement (proxy for audience warmth)

### Facebook

**Best discovery methods:**
1. **Public Facebook groups** in our niches (parenting groups, grandparent groups, foster parent groups). Top contributors and admins are often creators with presence on other platforms.
2. **Facebook Pages** with high reach — less common now, but grandparent demographic still lives on FB.
3. **FB live creators** — underutilized; they can drive real-time conversion spikes.

**Facebook is deprioritized but valuable for:**
- Reaching older demographics (grandparents, aunts/uncles)
- Group-based community leaders whose posts influence purchases
- Creators with engaged newsletter + FB cross-posting (double-channel value)

**Filters:**
- Page followers: 50K+
- Page post avg engagement: >2%
- Must cross-reference: creator also needs a presence on at least one other platform

---

## 5. Evaluation rubric (score each candidate 1–5 per dimension)

For each creator surfaced, score on these dimensions. Anyone scoring <3 average is a pass; 4+ average is a priority pitch target.

| Dimension | What it measures | 1 (poor) | 5 (great) |
|---|---|---|---|
| **Audience fit** | Does their content reach our buyer ICP? | Random niche overlap | Core mom/grandparent/foster audience |
| **Audience size** | Reach potential | <50K or >2M (too small or ad-fatigued) | 150K–500K, tight niche |
| **Engagement quality** | Real engagement, not inflated | <1% or engagement looks botted | 4%+ with real comments and DMs |
| **Content style match** | Would their voice feel natural selling this? | Corporate-polished, impersonal | Shows their real kids, authentic tone |
| **Commercial intent** | Have they done paid partnerships before? | No sponsored content ever | Regular sponsored content with good disclosure |
| **Conversion signals** | Do they drive sales or just views? | Links never hit, engagement is only likes | Comments say "where did you get that?", saves are high, link clicks |
| **Contact / outreach path** | Can we actually reach them? | Private account, no email, no agency | Bio email, website contact form, clear partnership page |
| **Brand safety** | Kid-safe, family-safe, no controversy | Has made public controversy, unsafe content | Consistent family-friendly voice |

**Bonus multipliers (not required, but weight candidates higher):**
- Creator posts photos of their own kid(s) → they'll understand our product instantly
- Creator mentions photography, keepsakes, memory-making, or "I always take pictures of..." → pre-qualified audience
- Creator runs a newsletter/email list → list compounds with ours
- Creator has an affiliate storefront (LTK, Amazon Storefront, ShopMy, etc.) → already literate in rev share mechanics
- Creator is multi-platform (IG + TikTok, or YouTube + IG) → one deal, multiple channels

---

## 6. Red flags — automatic reject

- **Follower-to-engagement mismatch** (300K followers, 500 likes per post → bought followers)
- **No recent posts** (gone quiet in the last 30 days)
- **All posts are sponsorships** (their audience will be ad-fatigued)
- **Explicit or adult-adjacent content** (conflicts with our family-safe brand)
- **Active history of partnerships with direct competitors** — other personalized coloring book brands, AI photo products, or obvious substitute gifts (personalized storybooks, photo books). Flag these but don't auto-reject — they may still be worth pitching with exclusivity clause.
- **Audience is primarily outside our shipping regions** (US, CA, UK, AU are primary)
- **Private account** or no way to contact (no bio email, no website, no agency listed)
- **Drama/controversy history** — quick search: "@handle controversy", "@handle cancelled"

---

## 7. Deliverable format

Produce a **single spreadsheet (CSV or Google Sheet)** with one row per candidate. One tab per category (Tier 1 categories get their own tabs; Tier 2 can share a tab; Tier 3 can share a tab).

### Required columns (in this order)

| Column | Notes |
|---|---|
| platform | instagram \| tiktok \| youtube \| facebook |
| handle | @handle or channel URL |
| display_name | Creator name or brand name |
| profile_url | Full URL |
| category | One of the Tier 1/2/3 categories |
| follower_count | Current approximate count |
| avg_engagement_rate | % (calculate from last 10 posts if not public) |
| avg_post_views_or_reach | For platforms where views != followers (TikTok, YouTube) |
| posting_frequency | posts per week (approximate) |
| audience_geo_primary | Top country if visible |
| content_style_summary | 1 sentence describing their voice |
| shows_own_kids | yes / no / can't tell |
| has_done_sponsored | yes / no / unknown |
| platforms_active | Comma list if multi-platform |
| has_newsletter | yes / no / unknown |
| has_affiliate_storefront | yes / no / unknown (LTK, Amazon, ShopMy, etc.) |
| contact_email | Pulled from bio or contact page |
| contact_secondary | Manager/agency email if available |
| fit_score | 1–5 (audience fit) |
| size_score | 1–5 (follower band) |
| engagement_score | 1–5 |
| style_score | 1–5 |
| commercial_score | 1–5 |
| conversion_signals_score | 1–5 |
| contact_score | 1–5 |
| brand_safety_score | 1–5 |
| average_score | AVG of above 8 |
| priority_tier | A (pitch first), B (pitch second), C (backup) |
| notes | Free-form — standout reason, red flags, competitor work, unique angle |
| last_updated | Date of entry |

### Organization

- Sort within each tab by `average_score` descending
- Top 20 per category get `priority_tier = A`
- Next 30 per category get `priority_tier = B`
- Rest get `priority_tier = C`

### Target volume per tier

| Tier | Target count | Split |
|---|---|---|
| Tier 1 categories (5 categories) | 100 creators | ~20 per category |
| Tier 2 categories (5 categories) | 50 creators | ~10 per category |
| Tier 3 categories (5 categories) | 25 creators | ~5 per category |
| **Total** | **~175** | |

Minimum acceptable first-pass: 100 creators across Tier 1 only. Tier 2/3 can fill in over week 2 if Tier 1 doesn't yield enough signal.

---

## 8. Process & methodology expectations

- **Don't fabricate data.** If engagement rate isn't visible, mark "not verified" and flag for manual review. Better to have 80 verified rows than 200 guessed ones.
- **Use public data only.** Don't scrape locked/private accounts or abuse rate limits. Instagram and TikTok both rate-limit aggressively.
- **Batch and cross-reference.** If a creator is on IG + TikTok, create one row that captures both handles — don't duplicate as two rows.
- **Document search queries used.** Keep a separate tab listing all hashtags / keywords / playlists searched, so we can see what was and wasn't covered and avoid re-searching later.
- **Flag standout candidates.** Anyone scoring 4.5+ avg should also have a short "why this one is special" note — we want to pitch these first with a warm/personalized approach, not a template.
- **Identify 5–10 "aspirational" creators** (1M+ followers, outside the commercial tier we'd normally pitch) whose content we'd want to eventually land. These go in a separate Tier 0 tab for long-term relationship building, not immediate outreach.

---

## 9. Known competitor watchlist (flag these in creator histories)

When reviewing creators, note if they've partnered with any of these brands in the last 12 months — not an auto-reject, but changes how we pitch (exclusivity, timing):

- Personalized kids' books (Wonderbly, I See Me!, Put Me In The Story, Lost My Name, Storybots)
- Custom coloring / art products (Personalization Mall, Shutterfly, Mixbook, Artifact Uprising, Chatbooks)
- AI photo products (Remini, FacetuneAI — anything uploading photos for transformation)
- Kids craft/subscription boxes (KiwiCo, Lovevery, MEL Science, Little Passports)
- Photo books / memory products (Chatbooks specifically — biggest overlap)

Flag these and note: if partner recency is <90 days, deprioritize; if 6+ months, probably fine to pitch.

---

## 10. Success criteria for this project

The deliverable is successful if:

1. We end up with 15+ confirmed partnership pilots within 60 days of completing the list
2. At least 5 of those convert to ongoing ambassador-tier relationships
3. Blended creator CAC comes in at or below $15 per customer (better than paid Meta)
4. The list becomes a living document — refreshed quarterly with new candidates and performance data from active partnerships

---

## 11. Appendix: Example "yes" and "no" profiles

### Clear yes (pitch immediately)

- IG mom creator, 180K followers, 5.8% engagement rate, posts twice a week about mom life with her two kids (ages 3 and 5), has an LTK storefront, lists "PR+partnerships@..." in bio, recently posted a gift guide with no competing product in it, posts in stories about kid crafts, has 20K email subscribers on her blog.

- TikTok grandmother creator, 320K followers, 12% engagement, posts videos of surprising her grandkids with gifts, has done 2 prior brand deals visibly, bio links to Linktree with email, comments frequently mention her audience asking "where did you get that."

- YouTube foster family channel, 450K subs, 80K avg views per video, uploads 2×/week, warm authentic tone, audience leaves emotional comments, has done 3 past partnerships with family brands (Lovevery, Chatbooks), has a blog + newsletter linked.

### Clear no

- IG account with 400K followers but avg 800 likes per post — bought followers, engagement rate is 0.2%. Skip.

- TikTok creator with 200K followers but last post was 47 days ago, doesn't respond to comments, bio is blank. Skip.

- YouTube channel with 1.2M subs but content is entertainment/comedy, only occasional family-related content, audience skews under-18. Audience won't buy $50+ gifts. Skip.

- Mom creator whose last 3 posts were all sponsorships for different brands, including a competing personalized gift brand posted last week. Audience is fatigued, brand conflicts fresh. Skip for now — revisit in 6 months.

---

**End of brief. Open to refining any section before kickoff — respond with questions or scope tweaks, then begin Tier 1 discovery.**
