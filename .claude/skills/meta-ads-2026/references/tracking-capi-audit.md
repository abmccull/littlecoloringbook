# Tracking & CAPI Audit

When the calling system asks Claude to audit tracking, or when a performance analysis surfaces `tracking_integrity_failure`, follow this diagnostic tree. Fix order matters — later fixes don't work if earlier layers are broken.

## Why Tracking is Audited First

Pixel-only setups miss 40–60% of conversions in 2026. Any optimization decision made on degraded signal is unreliable. Before analyzing performance, verify:

1. CAPI is running and receiving events
2. Events are deduplicated against the Pixel
3. Event Match Quality (EMQ) is in the healthy range
4. Domain is verified and AEM priority is set

Broken tracking looks like a performance problem to the untrained eye. A "low conversion rate" may actually be "60% of conversions aren't being attributed." Audit tracking first, always.

## Diagnostic Tree

### Question 1: Is CAPI running at all?

**Check:** In Events Manager → Data Sources → the pixel/dataset → "Events Received" tab. Is there a CAPI event stream?

- **No CAPI stream** → Server-side integration has never been set up, or has broken entirely. This is the worst case. `escalate` with `rationale.primary_signal: "capi_not_configured"`. Fixing requires either:
  - Direct server integration (Meta's CAPI endpoint, custom backend code)
  - Partner integration (Shopify, Stape, WooCommerce, Segment, etc.)
  - Conversions API Gateway (Meta-hosted option)

- **CAPI stream present but <80% of Pixel volume** → Server integration is partial. Usually means only some events are instrumented on the server side, or the server is dropping events. Audit which events are missing.

- **CAPI stream present at ≥80% of Pixel volume** → Continue to Question 2.

### Question 2: Is deduplication working?

**Check:** Events Manager surfaces deduplication warnings. Look for "Duplicate Events Received" alerts.

- **Duplicate warnings present** → `event_id` generation is broken. The root cause is one of:
  - Browser and server generating different `event_id` values for the same event
  - `event_id` not being passed to CAPI at all
  - `event_id` being timestamp-based with millisecond drift

  **Fix:** generate `event_id` at the browser (e.g., UUID v4), persist it through the checkout flow, pass the exact same value to both Pixel and CAPI calls for the same logical event. Return `escalate` to the calling system with specific fix guidance.

- **No duplicate warnings** → Continue to Question 3.

### Question 3: Is EMQ in the healthy range?

**Check:** Events Manager → Data Sources → the pixel/dataset → "Diagnostics" → EMQ score per event type.

Target ranges:

| Event              | Target EMQ  | Escalation Threshold |
|--------------------|-------------|----------------------|
| Purchase           | 8.0 – 9.3   | <6.0 → escalate       |
| Lead               | 7.5 – 9.0   | <5.5 → escalate       |
| Add to Cart        | 7.0 – 8.5   | <5.0 → escalate       |
| View Content       | 6.0+        | <4.0 → escalate       |

**EMQ below target but above escalation threshold:** fix in place by adding more identifiers to the CAPI payload. See Question 4.

**EMQ below escalation threshold:** the signal is so degraded that optimization decisions downstream are unreliable. Return `decision: "escalate"` and halt non-tracking tasks until fixed.

### Question 4: Which identifiers are missing?

EMQ is driven by how many customer identifiers accompany each event, and whether they're properly normalized and hashed.

**Check the CAPI payload for each conversion event.** Required identifiers:

| Identifier                 | Field      | Hashing        | Normalization             |
|----------------------------|------------|----------------|---------------------------|
| Email                      | `em`       | SHA-256        | lowercase, trim whitespace|
| Phone                      | `ph`       | SHA-256        | digits only, include country code (e.g. 15551234567) |
| First name                 | `fn`       | SHA-256        | lowercase, trim            |
| Last name                  | `ln`       | SHA-256        | lowercase, trim            |
| External ID (CRM)          | `external_id` | SHA-256     | lowercase, trim            |
| Browser ID                 | `fbp`      | **Do not hash**| pass as-is from `_fbp` cookie |
| Click ID                   | `fbc`      | **Do not hash**| pass as-is from `_fbc` cookie or constructed |
| Client IP                  | `client_ip_address` | Do not hash | pass as-is from request |
| User Agent                 | `client_user_agent` | Do not hash | pass as-is from request |

**Common failure modes:**

- **Normalization skipped before hashing.** Hashing `"Jane.Smith@Email.com"` produces a different digest than hashing `"jane.smith@email.com"`. The second matches Meta's expected format. Normalize first, hash second.
- **Phone not country-coded.** `"555-1234"` won't match. `"15551234567"` will.
- **`fbp` / `fbc` not forwarded.** These are the critical linkage between browser session and server event. If the server receives the event without them, EMQ ceiling is capped even if every hashed identifier is perfect.
- **`external_id` not sent.** This single CRM identifier often lifts EMQ 1–2 points because it's a direct bridge between the advertiser's data and Meta's user profile graph.

**Fix priority** (highest impact first):
1. Forward `fbp` and `fbc` from browser to server for every event (biggest single lift)
2. Normalize before hashing (fixes systemic but silent EMQ drag)
3. Add `external_id` from CRM (lifts EMQ and improves Custom Audience match rates as a side benefit)
4. Add phone if available (secondary but meaningful)
5. Add first/last name (marginal but adds up)

### Question 5: Is domain verification + AEM configured?

**Check:** Events Manager → the pixel → "Aggregated Event Measurement" tab. Is the domain verified? Are event priorities set?

- **Domain unverified** → Conversion events aren't prioritized under AEM. iOS ATT opt-outs will result in lost events that verified domains would retain. Fix via Meta-tag, HTML file upload, or DNS TXT record (see `01-structure.md` in campaign-creation domain references, or Meta documentation).

- **Domain verified but AEM priorities unset** → Meta uses default prioritization which may not match the business goal. Set the priority order: typically Purchase > Initiate Checkout > Add to Cart > View Content.

### Question 6: Are conversion events firing at the right trigger points?

**Check:** Events Manager → Test Events tab. Walk through the funnel in a test session. Do events fire at the correct moments?

Common issues:
- **Purchase fires on the cart page instead of the confirmation page** → inflates conversion count; the real purchase isn't being tracked.
- **Lead fires on form open instead of submit** → same problem, inflated leads without real leads.
- **Add to Cart not firing** → intermediate-funnel signal missing; ad set learning is handicapped.
- **Events fire with incorrect value** (e.g., `value: 0` on purchases) → ROAS reporting is broken; Minimum ROAS bidding won't work.

## Audit Output Format

```json
{
  "decision": "escalate",
  "target": {
    "level": "account",
    "id": "<ad_account_id>",
    "name": "<account name>"
  },
  "confidence": "high",
  "rationale": {
    "primary_signal": "emq_below_escalation_threshold",
    "supporting_signals": [
      "purchase_emq_5.8",
      "lead_emq_6.2",
      "fbp_fbc_not_forwarded_to_server",
      "external_id_not_sent"
    ],
    "thresholds_referenced": [
      "emq_purchase_escalation_6.0",
      "emq_lead_escalation_5.5"
    ]
  },
  "action_parameters": {
    "fix_priority_ordered": [
      "forward_fbp_fbc_from_browser_to_server",
      "normalize_email_lowercase_trim_before_hashing",
      "add_external_id_from_crm_to_capi_payload",
      "verify_purchase_event_fires_on_confirmation_page_only"
    ],
    "expected_emq_after_fixes": "7.5 – 8.5",
    "estimated_fix_effort": "medium (server code changes)"
  },
  "risks": ["all downstream optimization decisions are unreliable until tracking is fixed"],
  "next_review": "after_fixes_applied_and_24h_event_accumulation"
}
```

Then a short prose summary:

> EMQ on Purchase events is 5.8, below the 6.0 escalation threshold. The CAPI payload is missing `fbp`/`fbc` browser linkage and `external_id` from the CRM. Email is being hashed without normalization. Every downstream optimization decision is operating on degraded signal. Halting non-tracking tasks until the fixes land. Expected EMQ after fixes: 7.5–8.5.
