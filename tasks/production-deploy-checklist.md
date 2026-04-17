# Production Deployment Checklist — Phase 1 (Auth + Dashboard)

Drafted: 2026-04-17
Target domain: `https://littlecolorbook.com`

## 1. Neon Auth dashboard (one-time, user-side)

**Trusted domains** (Neon Console → Auth → Configuration → Domains). Add *exactly* these, one per line:

```
https://littlecolorbook.com
https://www.littlecolorbook.com
http://localhost:3000
```

(Preview deploys are optional — add `https://*.vercel.app` only if you want magic-link sign-in to work on unpromoted Vercel preview URLs.)

**Authentication method**: already set — Verification link / code. No change.

**OAuth providers**: leave empty (we're passwordless-OTP only for v1).

**Email provider**: shared `auth@mail.myneon.app` is fine for launch. Swap for a custom sender later if deliverability matters.

## 2. Stripe (user-side)

**Webhook endpoint** — in Stripe Dashboard → Developers → Webhooks:
- URL: `https://littlecolorbook.com/api/webhooks/stripe`
- Events: `checkout.session.completed`, `checkout.session.expired` (add `charge.refunded` and `refund.updated` in Phase 3)
- Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` — **must be the production secret, not the test/listen secret**

Current `.env` has the webhook secret already; confirm it matches the prod endpoint in the dashboard.

**Account ID check**: `STRIPE_ACCOUNT_ID=acct_1RYZXaIAkFnOfLME` is validated at boot. If this doesn't match the live account, the app will fail fast — good.

## 3. Google Cloud Storage (user-side)

**Bucket CORS** — for the two buckets (`littlecolorbook-gen-lang-client-0018745322-uploads` and `-exports`). Apply with `gsutil cors set cors.json gs://<bucket>`:

```json
[{
  "origin": ["https://littlecolorbook.com", "http://localhost:3000"],
  "method": ["GET", "PUT", "POST", "HEAD"],
  "responseHeader": ["Content-Type", "Content-Length", "x-goog-content-length-range"],
  "maxAgeSeconds": 3600
}]
```

Without this, browser uploads via signed URL will get CORS-blocked.

## 4. Vercel project env vars (automated via `scripts/push-vercel-env.sh`)

Every var in `.env` needs to be in Vercel's environment for `production`. The script below writes all non-placeholder values to the `production` environment. Preview deploys should get the same values unless you want a separate staging DB — in which case run with `preview` as the second argument.

Special values that **must change** from local `.env`:
- `APP_URL` → `https://littlecolorbook.com`
- `ALLOW_STRIPE_WEBHOOK_STUB` → must be UNSET in production (dev-stub would bypass signature verification)
- `NODE_ENV` → set automatically by Vercel

## 5. Vercel project configuration

`apps/web/vercel.json` already contains cron for `lulu-status`. Before Phase 3 ships, add:
- `batch-lulu` cron (nightly print submissions)
- `sla-breach-sweep` cron (tickets — Phase 2)

Root directory on Vercel **must be `apps/web`**.

## 6. Runtime smoke tests after deploy

1. `https://littlecolorbook.com` → 200
2. `https://littlecolorbook.com/api/health` → all integrations green
3. `https://littlecolorbook.com/account` → 307 to `/sign-in?after_auth_return_to=/account`
4. `https://littlecolorbook.com/sign-in` → magic-link form renders
5. Enter real email → receive code from `auth@mail.myneon.app`
6. Enter code → land on `/account`
7. Place a $1 Stripe test order (via test clock if staying on live keys) → webhook fires → auto-account email arrives → sign in → order appears on `/account/orders`

## 7. Known limits carried into production

Issues from the code review that remain unfixed in Phase 1 (tracked in `tasks/customer-accounts-spec.md`):

- **No refund handling** (Phase 3)
- **Ticket system not built yet** (Phase 2)
- **`/api/uploads/presign` has no auth binding** — still a launch risk; prioritize before doing any ad spend
- **BullMQ workers never started** — leave `REDIS_URL` UNSET in production or paid orders freeze
- **Playwright smoke tests not installed** — `test:smoke` npm script will fail on CI

## 8. Rollback plan

- Neon Auth has a "Disable Auth" button in the dashboard — flipping it deletes all users. **Do not click casually.**
- Reverting the Phase-1 commit restores pre-auth behaviour (portal-token-only).
- Migration 0007 is additive — safe to leave in place on rollback.
