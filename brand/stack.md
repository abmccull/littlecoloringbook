## Marketing Stack

Generated 2026-04-10 by `/start-here`
Updated 2026-04-17 — Resend, Neon Auth, GCS, PostHog-host connected

### Connected

- `Gemini API` — `GEMINI_API_KEY` (image generation)
- `Lulu API` — `LULU_CLIENT_KEY` + `LULU_CLIENT_SECRET` (print fulfillment)
- `Stripe` — live keys + webhook secret (checkout + webhooks verified in prod)
- `Neon Postgres` — `DATABASE_URL` (app data + `neon_auth` schema)
- `Neon Auth (Better Auth)` — email-OTP sign-in, `@neondatabase/auth@0.2.0-beta.1`
- `Google Cloud Storage` — uploads + exports buckets w/ service account
- `Resend` — `RESEND_API_KEY` + verified sender domain (`hello@littlecolorbook.com`), transactional live
- `Vercel` — production deploys + cron (prod env vars synced, 42 keys)
- `PostHog host` — `NEXT_PUBLIC_POSTHOG_HOST` set; key pending

### Email capability

- **Transactional (Resend)** — live. Lifecycle templates: `order-paid`, `pdf-ready`, `print-submitted`, `order-shipped`, `order-delivered`, `account-welcome` (defined; auto-trigger pending Neon Auth-handoff call).
- **Auth emails (Neon Auth)** — handled by Neon's shared sender `auth@mail.myneon.app`. Out of our control for content; covers sign-in OTP.
- **Marketing broadcasts** — NOT YET WIRED. Recommend Resend Audiences + Broadcasts API (native list mgmt, unsubscribe, scheduling). `customers.marketing_opt_in` column exists in DB but no audience sync.

### Not Connected

- `Replicate` — no creative-generation-as-a-service (we use Gemini for coloring-page renders; separate creative kit still needed for marketing imagery)
- `Mailchimp / ConvertKit / HubSpot / Beehiiv` — not needed; Resend is the ESP
- `GA4` — `NEXT_PUBLIC_GA_MEASUREMENT_ID` empty
- `PostHog API key` — host set, `NEXT_PUBLIC_POSTHOG_KEY` empty
- `Buffer / social scheduling` — no direct integration
- `Anthropic / OpenAI` — not connected (app uses Gemini only)

### Notes

- Core product infrastructure is fully wired: checkout → generation → print → email lifecycle.
- Biggest growth-stack gap: marketing email engine (Resend Audiences/Broadcasts), product analytics (PostHog key), and a creative kit for non-coloring-page imagery (hero shots, social graphics).
