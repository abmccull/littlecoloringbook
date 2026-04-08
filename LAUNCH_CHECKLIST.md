# Launch Checklist

## Pre-deploy

- Confirm `.env` values are present for Stripe, Lulu, Gemini, GCS, Clerk, Resend, and `APP_URL`
- Set `CRON_SECRET` for production before enabling cron routes
- Set Vercel Root Directory to `apps/web`
- Confirm GCS bucket CORS allows signed browser uploads from the deployed domain
- Confirm Stripe webhook endpoint targets `/api/webhooks/stripe`

## Automated checks

- Run `npm run typecheck`
- Run `npm run build`
- Run `npm run smoke`

## Manual funnel checks

- Homepage loads and the primary CTA leads to `/sample`
- Builder loads and `pdf-30` remains the default paid path
- PDF order draft can be created and checkout starts
- Print order can request shipping quotes and proceed to checkout
- Order confirmation links into the portal
- Portal download button appears once PDF assets are present
- Admin console loads only for Clerk-approved admin emails

## Fulfillment checks

- Print orders can be submitted to Lulu from the admin console
- `GET /api/cron/lulu-status` succeeds with `Authorization: Bearer <CRON_SECRET>`
- Shipped and delivered Lulu statuses trigger lifecycle emails without blocking status sync

## Analytics checks

- Vercel Analytics is visible in deployment
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set if GA4 is enabled
- `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` are set if PostHog is enabled
- Funnel events appear for sample CTA, offer selection, order draft creation, shipping quote requests, and checkout start
