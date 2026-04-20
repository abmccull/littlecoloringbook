# Lessons

Running log of corrections from the user. Read at session start so the same mistake isn't made twice.

---

## 2026-04-20 — Three corrections while writing the Little Color Book meta-ads context file

### 1. Don't fabricate brand voice rules

**Mistake:** Claimed "brand name is lowercase 'little color book' — always use lowercase in customer-facing copy" as a brand voice rule.

**Reality:** `brand/voice-profile.md` exists as the authoritative voice source. It uses Title Case "Little Color Book". The customer-facing `apps/web/components/brand-logo.tsx` uses Title Case. An old auto-memory entry asserted lowercase — that memory was wrong and has now been corrected.

**Rule for future:** Before asserting any brand voice rule, check `brand/voice-profile.md` first. When that file answers a question, quote it; don't paraphrase or invent supplementary rules. If a voice rule isn't in the profile file, it doesn't exist yet — update the profile instead of inventing it elsewhere.

### 2. Don't invent saturation ceilings without data

**Mistake:** Wrote "cap ad spend roughly $30K–50K/month — beyond that CPL saturates past $4.50 and marginal ROI breaks" into the operations playbook as if it were known.

**Reality:** We have zero paid Meta performance data for this business yet. The addressable audience (US parents/grandparents of kids 2–10) is tens of millions of households. A $50K/month saturation point is an unvalidated guess — and stating it as fact would distort future scaling decisions.

**Rule for future:** When there's no data, say "unknown — measure and adjust." Define the signals that WOULD indicate saturation (CPL trend, conversion trend, frequency, CTR decay), and commit to measuring them. Never write speculative ceilings into an operational playbook — they become decision-blockers.

### 3. Optimize for the revenue event, not the midway event

**Mistake:** Defaulted cold Meta campaigns to Leads objective optimizing on sample submission.

**Reality:** Samples are the loss leader — customers who submit email and never buy are not the audience we want more of. The algorithm learns whatever event it's optimized for. If we optimize on sample submission, Meta finds people likely to submit email (tire-kickers). We need to optimize on Purchase so Meta finds people likely to buy.

**Correct approach:** Default cold campaigns to **Sales objective with Purchase optimization**, landing on `/sample` (because that's the highest-converting first step). Leads objective is a bootstrap only when Purchase volume is below 50/week and learning phase can't clear. Once volume allows, upgrade to Value Optimization (bid on revenue, not conversion count).

**Rule for future:** When a funnel has multiple conversion events (top, middle, bottom), optimize on the event closest to revenue — not the one easiest to collect. The landing page is separate from the optimization event. Always report BOTH CPL and CAC per campaign; CPL alone lies if it hides a tire-kicker audience.

---

## 2026-04-20 — Vercel build failed after a split commit

**Mistake:** Committed a set of files that depended on an unstaged modification to a shared wrapper (`apps/web/lib/internal-jobs.ts`). Local typecheck passed because the wrapper in my working tree had the new option. CI typecheck failed because the pushed wrapper didn't.

**Reality:** When editing a subset of a working tree that has many uncommitted changes, type dependencies between the files-I-want-to-commit and the files-I'm-leaving-uncommitted can silently break CI.

**Rule for future:** When staging a subset of modified files, before committing, run typecheck against *only the HEAD tree* (not the working tree). Options:

1. `git stash --keep-index` before typecheck — stashes unstaged changes, leaves staged ones. Run typecheck. If clean, commit. Then `git stash pop`.
2. Or: after `git add`, do `git diff --cached --name-only` and read every file that imports from a non-staged modified file — confirm the non-staged file's current signature is what's actually committed to main, not a local-only evolution.

The split-commit risk is highest when a shared lib file (types, helpers, schemas) has in-progress work that other files depend on.

---

## How to use this file

- Read at the start of any session touching paid ads, unit economics, or brand voice for this project
- Add new entries when the user corrects a mistake
- Keep entries dated + structured as Mistake / Reality / Rule so patterns emerge
- When an entry is clearly obsolete (e.g. the product completely changed), archive it rather than delete
