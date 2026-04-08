# littlecolorbook.com

Monorepo for the littlecolorbook.com marketing site, builder, async order pipeline, and operations console.

## Stack

- Next.js App Router on Vercel for the website, builder, customer portal, admin UI, and API routes
- Neon Postgres with Drizzle ORM for orders, uploads, generation jobs, fulfillment state, lifecycle emails, and support actions
- Neon Postgres plus portal tokens for customer access today, with Neon Auth intended for admin access
- Google Cloud Storage for private uploads and PDF exports
- Stripe Checkout for payments
- Lulu Print API for printed-book fulfillment
- Gemini image generation for sample and book rendering
- Resend for lifecycle email delivery
- Vercel Analytics plus optional GA4 and PostHog funnel events

## Workspace layout

- `apps/web`: customer-facing app, admin, API routes, deployment config
- `apps/worker`: worker shell and pipeline boot information
- `packages/db`: schema, repository layer, and database helpers
- `packages/pipeline`: generation planning and cleanup/QA definitions
- `packages/shared`: offers, env helpers, storage helpers, shared primitives
- `packages/email`: lifecycle email rendering and delivery

## Local setup

1. Copy `.env.example` to `.env`.
2. Fill in the required service credentials.
3. Install dependencies with `npm install`.
4. Run `npm run dev:web`.
5. Verify the app at `http://localhost:3000`.

## Key environment variables

Runtime essentials:

- `APP_URL`
- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_ACCOUNT_ID`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PUBLISHABLE_KEY` can be used locally as an alias if you already copied Stripe's dashboard publishable key under that name
- `STRIPE_WEBHOOK_SECRET`
- `LULU_CLIENT_KEY`
- `LULU_CLIENT_SECRET`
- `LULU_POD_PACKAGE_ID`
- `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`
- `GCS_PROJECT_ID`
- `GCS_CLIENT_EMAIL`
- `GCS_PRIVATE_KEY`
- `GCS_BUCKET_UPLOADS`
- `GCS_BUCKET_EXPORTS`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPPORT_EMAIL`

Security and async jobs:

- `CRON_SECRET` or `INTERNAL_JOB_SECRET`

Optional analytics:

- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_ANALYTICS_DEBUG`

## Deployment notes

Deploy the Vercel project with `apps/web` as the Root Directory so `apps/web/vercel.json` applies to the deployed app.

Production checklist:

- set `APP_URL` to the production domain
- configure `CRON_SECRET` so internal job and cron routes are protected
- configure GCS bucket CORS for signed browser uploads
- configure Stripe webhook delivery to `/api/webhooks/stripe`
- set `STRIPE_ACCOUNT_ID` to the expected Little Color Book Stripe account so the app fails fast on wrong keys
- configure Lulu credentials and POD package ID
- verify Resend sender domain
- confirm the `GET /api/cron/lulu-status` cron is live after deployment

## Useful scripts

- `npm run dev:web`
- `npm run build`
- `npm run typecheck`
- `npm run smoke`
- `npm run db:generate`
- `npm run db:push`
- `npm run db:studio`

## Smoke test coverage

`npm run smoke` starts a local dev server, checks the public pages, verifies order draft creation, checks checkout fallback behavior, confirms internal-job auth, and exercises the protected Lulu cron endpoint in stub mode.
