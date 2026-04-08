# littlecolorbook.com Implementation Stages

## Completed
- [x] Stage 0: Monorepo scaffold, Next.js app shell, worker shell, and project docs
- [x] Stage 1: Auth and storage foundation with Clerk scaffolding, Google Cloud Storage helpers, signed-upload routes, and upload UI wiring
- [x] Stage 2: Database foundation with Neon + Drizzle setup, schema, and migration config
- [x] Stage 3: Repository and service layer for customers, orders, uploads, addresses, quotes, events, and portal tokens
- [x] Stage 4: Persistence-backed route wiring for sample creation, order creation, upload acknowledgements, shipping quotes, checkout stubs, and portal reads

## Next
- [x] Stage 5: Stripe Checkout sessions, webhook reconciliation, and paid-order state transitions
- [x] Stage 6: Lulu shipping-option retrieval, print-job submission, and status synchronization
- [x] Stage 7: Generation pipeline orchestration, cleanup/QA passes, PDF assembly, and worker job dispatch
- [x] Stage 8: Customer portal polish, admin actions, and lifecycle email integration
- [x] Stage 9: Launch hardening, analytics, smoke tests, and deployment configuration

## Current Notes
- The app is coded to run before external credentials are fully configured.
- Database-backed behavior activates when `DATABASE_URL` is present.
- Clerk-backed admin protection activates when Clerk keys are present.
- Signed browser uploads activate when the Google Cloud Storage credentials and bucket names are present.
- Internal job and cron routes are protected when `CRON_SECRET` or `INTERNAL_JOB_SECRET` is configured.
- Launch analytics now flow through Vercel Analytics plus optional GA4 and PostHog envs.
- `npm run smoke` now validates the homepage, builder, order draft, checkout fallback, protected internal jobs, and cron sync path.
- Free-sample flow now creates a persisted sample order first, uploads against that real order, and starts generation only after at least one completed upload exists.
- Sample and paid generation jobs now materialize placeholder preview/PDF assets into storage when GCS is configured, and preview delivery is exposed through signed portal preview routes.
