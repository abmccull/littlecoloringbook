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

## 2026-04-20 — Split-commit struck AGAIN on Postgres queue migration

**Mistake:** Second time in one day. Committed `packages/db/src/repositories.ts` with `import type { RenderFallback } from "@littlecolorbook/shared"` still in place, but the file that defines `RenderFallback` (`packages/shared/src/rendering.ts`) was untracked. Local typecheck passed — working-tree had the file. Vercel clone didn't, typecheck failed, deploy errored.

**Reality:** The first lesson on 2026-04-20 called out this exact pattern. I still did it again. The "before staging" audit wasn't mechanical enough.

**Stricter rule — make this a reflex before every commit:**

Before `git commit` of any subset of a working tree with untracked files:

1. **`git status -u`** — see every untracked file, not just modified ones
2. **`git ls-files --others --exclude-standard`** — list untracked files (scriptable)
3. For each untracked file, `grep -rn "<export name>" .` inside committed code — if any committed file already imports from it, **the file MUST be in this commit or a prior one**
4. Similarly for each MODIFIED file that's not being committed — if it exports something new that committed code already imports, ship the modified file too
5. **`git stash --keep-index`** → typecheck → `git stash pop` is the fastest mechanical check — stashes unstaged+untracked, typechecks staged tree only. If typecheck still passes, the commit is safe to push.

The `git stash --keep-index` technique is the single-step version of the audit — should run it before every push when there are uncommitted files elsewhere in the tree.

---

## 2026-04-20 — APP_URL apex vs www caused silent 401 on internal-job fallback

**Mistake:** Sample-start production fallback from BullMQ to direct HTTP dispatch returned 401 on the internal `/api/internal/jobs/process-sample` endpoint. Took runtime-log inspection to identify root cause.

**Reality:** `APP_URL` was set to `https://littlecolorbook.com` (apex). Vercel serves from `https://www.littlecolorbook.com` (canonical www). When `dispatchInternalJob` built its fetch URL from the apex value, the request hit a `301 apex→www` redirect. The `fetch()` default follows the redirect, but browsers/fetch strip the `Authorization` header on cross-origin redirects as a security feature — so the endpoint saw an unauthenticated request and returned 401. The caller-side `getInternalJobSecret()` path worked fine; the secret was being sent, just not arriving.

**Rule for future:**
1. **`APP_URL` in any environment that supports internal-HTTP job dispatch MUST be the canonical domain** the site actually serves from. Apex vs www is not interchangeable here.
2. **When wiring an internal-HTTP fallback with auth headers, set `redirect: "manual"` on the fetch** and throw explicitly on 3xx responses. Silent header-stripping 401s are one of the worst debugging traps — the caller sees "auth fine" and the endpoint sees "no auth." Loud failure at dispatch time points straight at the misconfiguration.
3. **If you see a 401 where a 200 is expected and the env vars clearly exist on both sides**, check for cross-origin redirect stripping before assuming the secret is wrong.

---

## 2026-04-20 — Two migrations in the repo were never applied to prod; every `orders` query 500ed

**Mistake:** Shipped code that depends on migrations `0026_order_occasions.sql` and `0027_order_feature_consent.sql`. `0026` was an untracked file on disk — committed to nobody's branch, applied to nobody's DB. `0027` was committed but the "apply to prod" step was never run. Result: production Neon was missing `orders.occasion`, `orders.occasion_context`, `orders.feature_consent`, `orders.feature_consent_at`, `orders.feature_ingested_at`. Drizzle's `db.select().from(orders)` auto-generates a SELECT of all schema columns — Postgres errored on every query, web route crashed before writing JSON, client saw `Failed to execute 'json' on 'Response': Unexpected end of JSON input`. The entire sample-submission funnel was broken in production. Was about to turn on paid ads.

**Reality:** There is no migration tracking table on this project. `drizzle-kit db:push` is the intended path but fails in non-TTY. The ad-hoc `apply-migration-NNNN.mjs` scripts are one-offs and easy to forget. A migration file existing in the repo ≠ the migration being applied to prod. A migration file being UNTRACKED means it doesn't exist for CI, teammates, or Vercel — only for the local tree that made it.

**Rule for future:**

1. **When I create a new `.sql` migration file, the same turn must do all three:**
   a. `git add` the file (never leave a migration untracked, ever)
   b. Apply it to prod (via the `apply-migration-NNNN.mjs` pattern — Neon serverless, idempotent SQL)
   c. Verify by querying `information_schema.columns` for the new columns

2. **Before claiming any funnel is "ready for ads," run a live `curl` against the canonical production domain** for the critical POST endpoints and inspect the response body is valid JSON. A 200 OR a 400/422 with a JSON error body is fine; an empty body with any status code is broken.

3. **When a production endpoint returns an empty body + non-2xx status, always check `information_schema.columns` on every table touched by that endpoint** against `packages/db/src/schema.ts`. The Drizzle-schema-vs-Postgres-columns diff is the single highest-leverage diagnostic for "Failed query: select...".

4. **Do not trust that "committed migration" means "applied migration."** They are independent state. The presence of `packages/db/drizzle/NNNN.sql` in git says the code expects it; only an `information_schema` query says the DB has it.

5. Adding a proper `_drizzle_migrations` tracking table + an idempotent `npm run migrate:apply:prod` is the real fix. Until that exists, the apply-script-per-migration + verify-columns ritual is mandatory.

**2026-04-20 update — tracking + CLI landed.** `_lcb_migrations` tracking table + `db:migrate:apply` / `db:migrate:verify` / `db:migrate:bootstrap` scripts now exist. New ritual:

- **New migration workflow:** add the `.sql` file → `git add` it → `npm run db:migrate:apply` (idempotent, safe to re-run) → `npm run db:migrate:verify` (asserts all files applied + critical columns present, exit code gates the deploy).
- **Pre-deploy gate:** `npm run db:migrate:verify` before every production deploy. Exit 0 = ship; exit 1 = apply pending then re-verify; exit 2 = drift, investigate before shipping.
- **Bootstrap once:** the first time this runs against prod, `npm run db:migrate:bootstrap` seeds `_lcb_migrations` with every file currently on disk (after confirming critical columns exist — refuses to seed if the DB is behind).
- **Never edit an applied migration file.** `migrate-apply` detects sha256 drift and aborts; the fix is always a new migration file, not editing an old one.

---

## How to use this file

- Read at the start of any session touching paid ads, unit economics, or brand voice for this project
- Add new entries when the user corrects a mistake
- Keep entries dated + structured as Mistake / Reality / Rule so patterns emerge
- When an entry is clearly obsolete (e.g. the product completely changed), archive it rather than delete
