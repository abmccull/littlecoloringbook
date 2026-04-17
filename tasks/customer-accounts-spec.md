# Customer Accounts, Dashboard, Tickets & Refunds — Full Spec

Owner: handscrapedflooring@gmail.com
Drafted: 2026-04-17
Status: **Proposal — awaiting sign-off before implementation**

---

## 1. Product decisions (locked with user)

| Decision | Choice |
| --- | --- |
| Auth provider | Neon Auth (Stack) — replaces the Clerk stub already removed |
| Sign-in method | **Magic link only** (email OTP). No passwords. |
| Account creation | **Guest checkout preserved**; account auto-created post-purchase |
| First-response SLA on tickets | **24 hours** |
| Refund policy | New 3-tier, state-aware policy — see §2 |

Not changing: portal tokens keep working for gift recipients, grandparents, and emailed download links. Accounts are an *addition*, not a replacement.

---

## 2. Refund policy — customer-facing copy

Anchored to the three existing guarantees in `apps/web/lib/consumer-content.ts`:

- **Light-Up-Their-Face Guarantee** — full refund if child doesn't love it
- **Perfect Page Promise** — any page regenerated free
- **Keepsake Quality or Free Replacement** — print arrives perfect or we replace it

### 2.1 Ready-to-publish policy (for `/refunds`)

> **Our Honest Refund Policy**
>
> We want you to love your book. If you don't, we make it right. Here's exactly how that works.
>
> **Digital PDFs — 30 days, no questions asked.**
> If your child doesn't light up, reply to any order email (or open a ticket from your account) within 30 days of delivery. We refund in full. You keep the PDF. No return required.
>
> **Printed spiral books — state-aware, always generous.**
> Because every book is custom-printed for you, the remedy depends on how far along your order is:
>
> - **Before we send it to the printer** (under ~2 hours after checkout, or while your order shows "Awaiting print submission") — full refund, no shipping charge, we cancel the job.
> - **Already at the printer but not shipped** — full refund minus the production cost we've already paid (about 40% of the print portion). PDF stays yours.
> - **Shipped or delivered, print quality issue** — free replacement at our cost OR full refund, your pick. Just send a photo of what's wrong within 30 days of delivery. The first one is yours to keep.
> - **Shipped or delivered, arrived damaged** — free replacement, every time. Photo helps but isn't required. Shipping damage isn't your problem.
> - **Changed your mind after it shipped** — we don't take returns on custom printed books, but we'll refund the PDF portion on request and can often offer 25% store credit. Ask.
>
> **Perfect Page redo.** Before you print, any page you don't love gets regenerated free until you do. Use the "Get help with this order" button in your account.
>
> **How to start a refund or ask for help.** Sign into your account → pick the order → click **Get help** or **Request refund**. We respond within one business day (most tickets in a few hours). Or email support@littlecolorbook.com.

### 2.2 Internal decision tree (for admin tooling)

The order's current `status` drives which remedies appear to the customer and which buttons appear in the admin ticket view:

| Order status | Customer-facing options | Admin default action |
| --- | --- | --- |
| `paid`, `preprocessing`, `generating`, `qa_review`, `assembling_pdf` | Cancel + full refund | Auto-refund on approval; abort pipeline |
| `pdf_ready` (PDF-only order) | Full refund (keep PDF) | Auto-refund; flag account |
| `pdf_ready` (print order, pre-Lulu) | Full refund + cancel print | Auto-refund; skip Lulu submission |
| `awaiting_print_submission` | Full refund + cancel | Auto-refund; mark `pipeline.skip_lulu=true` |
| `submitted_to_lulu` (within Lulu's 2h cancel window) | Full refund + cancel print | Call Lulu cancel API + refund |
| `submitted_to_lulu` (after cancel window), `in_production` | Refund minus production cost (~40% of print portion) OR free replacement on print quality issue | Partial refund; option to replace |
| `shipped`, `delivered` | Replacement (damage / quality) OR full refund (print quality) | Refund + reprint; first copy stays with customer |
| `failed`, `support_required` | Full refund | Auto-refund |
| `refunded` | (read-only) | n/a |

"Production cost" = Lulu cost from `fulfillment_jobs.totalCostCents` if present, else 40% of the print-portion of the order.

---

## 3. Architecture overview

```
┌──────────────┐   magic link    ┌───────────────┐
│  Customer    │────────────────▶│  Stack (Neon) │
│  email       │  session cookie │  @stackframe  │
└──────────────┘◀────────────────└──────┬────────┘
        │                               │ server session
        ▼                               ▼
┌──────────────┐                ┌───────────────┐
│  /account    │ server action  │  auth.ts      │
│  /account/   │───────────────▶│  resolveStack │
│  orders/...  │                │  UserSession  │
│  /account/   │                └──────┬────────┘
│  tickets/... │                       │
└──────────────┘                       ▼
                                ┌───────────────┐
                                │  Neon Postgres │
                                │  - customers   │
                                │  - orders      │
                                │  - tickets     │  ◀── new
                                │  - ticket_msgs │  ◀── new
                                │  - refunds     │  ◀── new
                                │  - user_link   │  ◀── new
                                └───────────────┘
```

Stack lives alongside our existing `customers` table; we **don't** move PII into Stack. Stack holds `(stackUserId, email)` only. Our `customers` row is still the source of truth for marketing opt-in, phone, etc. A new `customer_user_links` table ties them together.

---

## 4. Data model changes

All new tables in a single migration: `0007_customer_accounts_tickets_refunds.sql`.

### 4.1 `customer_user_links`
Maps Stack user IDs to our `customers.id`. Separate table (not a column on `customers`) because one email historically could have multiple customer rows before we enforce uniqueness.

```sql
CREATE TABLE customer_user_links (
  id text PRIMARY KEY,
  stack_user_id text NOT NULL UNIQUE,
  customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'post_purchase'  -- 'post_purchase' | 'self_signup' | 'admin_link'
);
CREATE INDEX customer_user_links_customer_idx ON customer_user_links (customer_id);
```

### 4.2 `tickets`

```sql
CREATE TYPE ticket_category AS ENUM (
  'refund_request',
  'print_quality',
  'shipping_damage',
  'shipping_delay',
  'wrong_item',
  'page_rerender',
  'account_help',
  'other'
);
CREATE TYPE ticket_status AS ENUM (
  'open',
  'awaiting_customer',
  'in_progress',
  'resolved',
  'closed'
);
CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE tickets (
  id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  category ticket_category NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  priority ticket_priority NOT NULL DEFAULT 'normal',
  subject text NOT NULL,
  summary text,                           -- customer's first-message excerpt, for list views
  assigned_admin_email text,
  first_response_due_at timestamptz,      -- created_at + 24h; drives SLA dashboard
  first_responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tickets_customer_idx ON tickets (customer_id, created_at DESC);
CREATE INDEX tickets_order_idx ON tickets (order_id);
CREATE INDEX tickets_open_idx ON tickets (status, first_response_due_at)
  WHERE status IN ('open', 'awaiting_customer', 'in_progress');
```

### 4.3 `ticket_messages`

```sql
CREATE TYPE ticket_author AS ENUM ('customer', 'admin', 'system');

CREATE TABLE ticket_messages (
  id text PRIMARY KEY,
  ticket_id text NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author ticket_author NOT NULL,
  author_email text,                      -- customer email or admin email, null for system
  body text NOT NULL,
  internal boolean NOT NULL DEFAULT false, -- true = admin-only note
  attachments jsonb NOT NULL DEFAULT '[]', -- [{ objectPath, mime, bytes, filename }]
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_messages_ticket_idx ON ticket_messages (ticket_id, created_at);
```

Attachments live in a new GCS prefix `tickets/<ticketId>/<uuid>-<filename>`. Signed read URLs issued per-request; admins and the owning customer can read.

### 4.4 `refunds`

Separate from `tickets` because not every refund comes from a ticket (admin can initiate a proactive refund) and not every ticket ends in a refund.

```sql
CREATE TYPE refund_status AS ENUM (
  'requested',
  'approved',
  'processing',
  'succeeded',
  'failed',
  'voided'
);
CREATE TYPE refund_reason AS ENUM (
  'customer_request_no_questions',
  'print_quality',
  'shipping_damage',
  'shipping_lost',
  'duplicate_charge',
  'fraud',
  'admin_discretion',
  'other'
);

CREATE TABLE refunds (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  ticket_id text REFERENCES tickets(id) ON DELETE SET NULL,
  status refund_status NOT NULL DEFAULT 'requested',
  reason refund_reason NOT NULL,
  amount_cents integer NOT NULL,         -- requested amount
  refunded_cents integer,                -- actually refunded by Stripe (may differ on partial fail)
  stripe_refund_id text UNIQUE,
  stripe_error jsonb,
  requested_by_email text,               -- customer email or admin email
  approved_by_email text,                -- admin email; null if auto-approved
  policy_tier text NOT NULL,             -- 'full_pre_lulu' | 'partial_in_production' | 'full_digital' | 'manual'
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refunds_order_idx ON refunds (order_id);
CREATE UNIQUE INDEX refunds_stripe_idx ON refunds (stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;
```

### 4.5 Schema additions on existing tables

- `orders.status` — add new enum value `cancelled` (between `paid` and `refunded`) for orders cancelled before production. Existing `refunded` stays.
- `orders` — add `refunded_cents integer` (sum of successful refunds; denormalized for fast list queries).
- Unique index on `orders.stripe_checkout_session_id` (also fixes code-review HIGH #24).
- Add `stripe_event_id text` to `order_events` + unique index (fixes webhook idempotency BLOCKER — code review #10).

### 4.6 Back-compat

Existing `portal_tokens` and `support_actions` stay. Support actions for admin-initiated work still write there; new customer-initiated work goes through `tickets`. Admins get a single inbox that reads from both.

---

## 5. Neon Auth (Stack) integration

### 5.1 Install
```
npm install @stackframe/stack --workspace apps/web
```

### 5.2 Env vars (added to `.env.example` and `.env`)
```
NEXT_PUBLIC_STACK_PROJECT_ID=
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=
STACK_SECRET_SERVER_KEY=
STACK_DEFAULT_AFTER_SIGN_IN=/account
```

### 5.3 Files to create
- `apps/web/stack.ts` — `StackServerApp` export, auth method `email_otp` only, disable password + OAuth for v1
- `apps/web/app/handler/[...stack]/page.tsx` — Stack's provided handler
- `apps/web/app/layout.tsx` — wrap in `<StackProvider>` (only when publishable key is set, same pattern the old Clerk provider used)

### 5.4 Files to update
- `apps/web/lib/auth.ts` — replace the TODO stub with `stackServerApp.getUser()` for admin session (still checks `ADMIN_EMAILS`) and add a new `getCustomerSession()` helper
- `apps/web/proxy.ts` — protect `/account(.*)` in addition to `/admin(.*)`
- Delete `apps/web/app/sign-in/*` and `apps/web/app/sign-up/*` — Stack provides these at `/handler/sign-in` and `/handler/sign-up`. Replace with redirects for old links in emails.

---

## 6. Core flows

### 6.1 Auto-account creation on checkout (the keystone flow)

Triggered inside the existing Stripe webhook handler `apps/web/app/api/webhooks/stripe/route.ts` after `markOrderPaidFromCheckout()`:

```
1. Resolve customer email (session.customer_details.email).
2. Lookup existing customer row by email (already exists).
3. Check customer_user_links by customerId.
4. If no link:
   a. stackServerApp.createUser({ primaryEmail: email, primaryEmailAuthEnabled: true, primaryEmailVerified: false })
   b. INSERT into customer_user_links (stackUserId, customerId, source='post_purchase')
   c. Queue welcome-with-magic-link email (Resend) containing:
      - "Your order is confirmed, here's how to check on it"
      - CTA → /handler/sign-in?email=<email> (Stack auto-sends OTP for known users)
   d. Log order_event: customer.account_created
5. Existing portal token still generated (unchanged) as fallback.
```

Idempotency: re-running the webhook with the same `event.id` is a no-op (enforced by the new `order_events.stripe_event_id` unique index). Creating a Stack user that already exists throws; catch and move on.

### 6.2 First sign-in linking

When a customer signs in with an email that matches a `customers.email` **without** a matching link, we create the link on the fly. Handled in `getCustomerSession()` — on-demand, no background job. This catches:
- Customers who signed up before we enabled auto-account
- Customers who placed multiple orders under the same email before linking

### 6.3 Customer dashboard

Routes under `apps/web/app/account/`:

| Route | Purpose |
| --- | --- |
| `/account` | Welcome, active orders, open tickets summary |
| `/account/orders` | Paginated order history |
| `/account/orders/[orderId]` | Order detail: status timeline, shipping, PDF download, **Get help** button, **Request refund** button (gated by status) |
| `/account/orders/[orderId]/tickets/new` | Open a new ticket scoped to the order |
| `/account/tickets` | All tickets list |
| `/account/tickets/[ticketId]` | Ticket thread, reply form, upload attachments |
| `/account/settings` | Name, marketing opt-in, email (managed by Stack) |

Guard: every route under `/account` requires `getCustomerSession()`. On miss → redirect to `/handler/sign-in?after_auth_return_to=<original_path>`.

Downloads: reuse the existing signed-URL generation from `packages/shared/src/storage.ts`, but authorize via the session's `customerId` matching `order.customerId` (fixes code-review HIGH #18 — no more leaking signed URLs via email referers when the customer is signed in).

### 6.4 Opening a ticket

Customer-side:
1. `/account/orders/[orderId]/tickets/new` presents a form with category (dropdown), subject (auto-filled based on category), body (textarea), attachments (photo-only for quality/damage categories; any file otherwise).
2. POST `/api/account/tickets` validates with Zod, inserts into `tickets` + first `ticket_messages` row, sets `first_response_due_at = now() + 24h`.
3. Confirmation email to customer ("We got it, reply within 24h"). Alert email to `SUPPORT_EMAIL`.
4. Redirect to `/account/tickets/[ticketId]`.

Admin-side (new console section under `/admin/tickets`):
1. Inbox sorted by `first_response_due_at ASC` with color-coded SLA pills (green >8h, yellow <8h, red overdue).
2. Open ticket → sees full thread + order context (current status, Stripe info, Lulu job, assets).
3. Reply form with "public reply" vs "internal note" toggle. Public replies email the customer.
4. Action buttons: **Assign to me**, **Mark resolved**, **Approve refund** (opens refund dialog with auto-computed tier), **Rerender page**, **Reset status**, **Escalate**.

### 6.5 Refund flow

**Customer initiates:**
1. On `/account/orders/[orderId]`, the **Request refund** button is visible and gated by order status (see §2.2 table).
2. Click → modal shows the tier + computed amount + reason dropdown + notes.
3. Submit → creates a `tickets` row with category `refund_request` + a `refunds` row status `requested`.
4. If tier is `full_pre_lulu` or `full_digital` (order is paid + status in the auto-approve set), the refund is auto-approved and executed without admin intervention. Otherwise it sits in admin queue.

**Admin approves:**
1. Admin clicks **Approve refund** in the ticket.
2. `refunds.status = approved`, then `processing`, then calls `stripe.refunds.create({ payment_intent, amount })`.
3. On success: `refunds.status = succeeded`, `orders.refunded_cents += amount`, if full refund then `orders.status = 'cancelled'` or `'refunded'` (rule: cancelled if not yet shipped, refunded if shipped), Lulu cancel API called if within window, customer email sent.
4. On failure: `refunds.status = failed`, `stripe_error` populated, admin notified.

**Idempotency:** refunds table row is created first with a client-generated UUID used as Stripe's `idempotency_key` header. Re-clicking approve on a stuck refund does not double-charge.

**Webhook:** add handlers for `charge.refunded` and `refund.updated` in the Stripe webhook route — reconciles Stripe-side changes back to our `refunds` table (e.g., failed bank-side refunds).

---

## 7. Emails (new templates in `packages/email`)

- `account-welcome.tsx` — post-purchase auto-account magic link
- `ticket-received.tsx` — confirmation after customer opens a ticket
- `ticket-admin-replied.tsx` — admin posted a public reply (deep-link to `/account/tickets/[id]`)
- `ticket-resolved.tsx` — thanks + review request
- `refund-approved.tsx` — "we've refunded $X, arrives in 5-10 business days"
- `refund-denied.tsx` — explains why + next step (rare; usually we find a remedy)
- `admin-new-ticket.tsx` (to SUPPORT_EMAIL) — internal alert for on-call
- `admin-sla-breach.tsx` — if `first_response_due_at` passes without a reply (driven by a new daily cron)

Existing lifecycle emails (`order-paid`, `pdf-ready`, etc.) get a subtle "Manage your order" link pointing to `/account/orders/[id]` when the customer has an account.

---

## 8. API surface

All under `apps/web/app/api/account/...` (customer-authenticated) and `apps/web/app/api/admin/tickets/...` (admin-authenticated):

**Customer:**
- `GET /api/account/orders` — paginated list, customer-scoped
- `GET /api/account/orders/[orderId]` — detail + permission check
- `GET /api/account/orders/[orderId]/download` — authenticated PDF download (replaces token redirect for signed-in users)
- `POST /api/account/tickets` — open a ticket
- `GET /api/account/tickets` — list
- `GET /api/account/tickets/[ticketId]` — thread (filters out `internal=true`)
- `POST /api/account/tickets/[ticketId]/reply` — customer reply (sets status back to `open` if was `awaiting_customer`)
- `POST /api/account/tickets/[ticketId]/attachments/presign` — like the existing presign endpoint but scoped to the ticket (fixes code-review BLOCKER #2/#3 for this surface)
- `POST /api/account/refunds` — request a refund

**Admin:**
- `GET /api/admin/tickets` — inbox with filters
- `GET /api/admin/tickets/[ticketId]` — full thread incl. internal notes
- `POST /api/admin/tickets/[ticketId]/reply` — public or internal
- `POST /api/admin/tickets/[ticketId]/status` — transition
- `POST /api/admin/tickets/[ticketId]/assign` — assign to admin
- `POST /api/admin/refunds/[refundId]/approve` — execute Stripe refund
- `POST /api/admin/refunds/[refundId]/reject` — close with reason

**Cron:**
- `GET /api/cron/sla-breach-sweep` — every 15 min, emails alerts for tickets past `first_response_due_at`

---

## 9. Security & privacy

Every item below either fixes an existing code-review finding or is required for this feature:

- **Attachments in tickets** — signed upload URL constrained to `image/*` or `application/pdf`, max 10 MB, `x-goog-content-length-range` enforced. Scoped per ticket; ownership verified on presign.
- **Signed read URLs** — for PDFs, when customer is signed in and owns the order, we proxy through `/api/account/orders/[id]/download` and stream rather than 302-redirect to a signed GCS URL. Keeps GCS signed URLs out of browser history/referers.
- **Magic-link rate limiting** — Stack has its own; we add a second layer in the proxy for `/handler/sign-in` POSTs (5/min/IP).
- **PII in ticket bodies** — customers can paste order details freely; we don't re-log them in `order_events`. Tickets are their own PII-carrying table, clearly governed.
- **GDPR delete** — adding a `deleteCustomerData(customerId)` function that cascades to orders (NULL the PII columns), tickets, messages, attachments, and calls `stackServerApp.deleteUser(stackUserId)`. Not building the UI in v1 but the seam is there.
- **Refund idempotency** — as above, Stripe idempotency key = `refunds.id`.
- **Admin audit** — every refund approval + status transition writes to `order_events` with `actor_email`.

---

## 10. Implementation phases

Four phases. Each ends with a working system — we can stop after any phase if priorities shift.

### Phase 1 — Auth + auto-account + order history (≈ 4 days)
**Shippable:** customers can sign in, see their orders, download PDFs; new purchases auto-create accounts.
- Install Stack; wire handler route + provider; update `.env*`
- Rewrite `lib/auth.ts` for customer + admin sessions
- Build `customer_user_links` migration + repository functions
- Stripe webhook: add auto-account + welcome email
- Ship `/account`, `/account/orders`, `/account/orders/[id]`
- Add authenticated PDF download endpoint
- Update existing lifecycle emails with "Manage your order" link
- Add rate limit to `/handler/sign-in`
- **Release gate:** Stripe webhook idempotency (code-review BLOCKER #10) fixed as a prerequisite

### Phase 2 — Ticket system (≈ 5 days)
**Shippable:** customers can open tickets, admins can reply from a real inbox.
- Tickets + ticket_messages migration
- Customer ticket flows (`/account/tickets/*` routes + APIs)
- Admin ticket inbox (`/admin/tickets/*`)
- Ticket attachment upload (reuses the GCS presign path; scoped + content-type guarded — fixes code-review BLOCKER #2/#3 for this flow)
- Email templates + sending on every transition
- SLA breach cron
- "Get help with this order" button on customer order page

### Phase 3 — Refund engine (≈ 4 days)
**Shippable:** refunds flow end-to-end, policy enforcement, Stripe integration, Lulu cancel.
- Refunds migration + repository
- Refund tier computer (`computeRefundTier(order)`)
- Customer `Request refund` UI + API (auto-approve for pre-Lulu cases)
- Admin approve/reject UI + API
- Stripe `refunds.create` call with idempotency
- Lulu cancel integration (we don't have this yet; thin wrapper in `apps/web/lib/lulu.ts`)
- Webhook handlers for `charge.refunded` and `refund.updated`
- Publish `/refunds` page with the §2.1 copy

### Phase 4 — Polish + guardrails (≈ 3 days)
- Admin analytics: refund rate, ticket volume by category, first-response time distribution
- GDPR delete hook (no UI yet)
- Review-request email on `ticket.resolved`
- Internal docs in `HANDOFF.md`
- Unit + integration tests for: refund tier computer, Stripe refund idempotency, customer-owns-order checks, SLA breach cron

**Total: ~16 working days end-to-end.**

---

## 11. Definition of done (per phase)

Every phase requires:
- TypeScript strict passes
- Migrations run cleanly on a fresh Neon branch
- New routes have at least one integration test
- Playwright smoke test updated (and actually installed — fixes code-review BLOCKER #6)
- `HANDOFF.md` updated with new env vars, tables, and routes
- `tasks/lessons.md` updated with any corrections learned mid-implementation

---

## 12. Open questions for user

1. **Store credit as a refund option?** Mentioned in the draft policy; easy to add but needs a `store_credit` table. Skip for v1?
2. **Ticket categories final?** The 8 I proposed cover what I've seen in your copy. Add/remove any?
3. **Admin assignment model** — single admin inbox, or start with round-robin assignment? v1 is single inbox unless you say otherwise.
4. **Review request email** — send on `ticket.resolved` AND on `order.delivered`? Or just one?
5. **Lulu cancel** — I'll implement this against Lulu's docs; OK if it's untested in prod until your first real refund case?
6. **Replacement book workflow** — when admin approves a replacement, should it create a new linked order (parent/child) with `total_cents=0` and a flag, or a separate manual process? Recommend the former — keeps one ledger.

---

## 13. Out of scope (explicitly)

- SMS notifications (email only)
- Live chat widget (tickets only)
- Subscription / membership model
- Multi-admin roles/permissions (everyone in `ADMIN_EMAILS` is equal in v1)
- Customer-uploaded profile photos on `/account/settings`
- Social login (email OTP only)

---

## Appendix A — file tree preview

New files:
```
apps/web/stack.ts
apps/web/app/handler/[...stack]/page.tsx
apps/web/app/account/layout.tsx
apps/web/app/account/page.tsx
apps/web/app/account/orders/page.tsx
apps/web/app/account/orders/[orderId]/page.tsx
apps/web/app/account/orders/[orderId]/tickets/new/page.tsx
apps/web/app/account/tickets/page.tsx
apps/web/app/account/tickets/[ticketId]/page.tsx
apps/web/app/account/settings/page.tsx
apps/web/app/api/account/orders/route.ts
apps/web/app/api/account/orders/[orderId]/route.ts
apps/web/app/api/account/orders/[orderId]/download/route.ts
apps/web/app/api/account/tickets/route.ts
apps/web/app/api/account/tickets/[ticketId]/route.ts
apps/web/app/api/account/tickets/[ticketId]/reply/route.ts
apps/web/app/api/account/tickets/[ticketId]/attachments/presign/route.ts
apps/web/app/api/account/refunds/route.ts
apps/web/app/admin/tickets/page.tsx
apps/web/app/admin/tickets/[ticketId]/page.tsx
apps/web/app/api/admin/tickets/route.ts
apps/web/app/api/admin/tickets/[ticketId]/route.ts
apps/web/app/api/admin/tickets/[ticketId]/reply/route.ts
apps/web/app/api/admin/tickets/[ticketId]/status/route.ts
apps/web/app/api/admin/tickets/[ticketId]/assign/route.ts
apps/web/app/api/admin/refunds/[refundId]/approve/route.ts
apps/web/app/api/admin/refunds/[refundId]/reject/route.ts
apps/web/app/api/cron/sla-breach-sweep/route.ts
apps/web/app/refunds/page.tsx
apps/web/components/account/*
apps/web/components/tickets/*
apps/web/components/refunds/*
packages/db/drizzle/0007_customer_accounts_tickets_refunds.sql
packages/db/src/repositories/tickets.ts
packages/db/src/repositories/refunds.ts
packages/db/src/repositories/user-links.ts
packages/email/src/templates/account-welcome.tsx
packages/email/src/templates/ticket-received.tsx
packages/email/src/templates/ticket-admin-replied.tsx
packages/email/src/templates/ticket-resolved.tsx
packages/email/src/templates/refund-approved.tsx
packages/email/src/templates/refund-denied.tsx
packages/email/src/templates/admin-new-ticket.tsx
packages/email/src/templates/admin-sla-breach.tsx
apps/web/lib/refund-tier.ts
apps/web/lib/lulu-cancel.ts
```

Modified:
```
apps/web/lib/auth.ts             (add Stack resolver + getCustomerSession)
apps/web/proxy.ts                (protect /account; rate limit /handler/sign-in)
apps/web/app/layout.tsx          (StackProvider)
apps/web/app/api/webhooks/stripe/route.ts  (auto-account + refund events + idempotency)
apps/web/app/sign-in/...         (delete — redirect to /handler/sign-in)
apps/web/app/sign-up/...         (delete — redirect to /handler/sign-up)
apps/web/lib/lulu.ts             (add cancelPrintJob)
packages/db/src/schema.ts        (add enums + tables + indexes)
packages/shared/src/env.ts       (add STACK_* + computeRefundTier helper exports)
.env / .env.example              (STACK_*, verify rest)
HANDOFF.md                       (docs)
apps/web/lib/consumer-content.ts (add refund policy link in footer)
```

---

**Sign-off needed before I start:**
1. Approve the refund policy copy in §2.1 (or edit)
2. Answer §12's 6 open questions
3. Confirm phase order + timing expectations
