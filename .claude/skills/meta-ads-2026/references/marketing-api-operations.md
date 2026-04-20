# Marketing API Operations

When the calling system executes against the Meta Marketing API, these are the rules of the road. Violating them causes rate-limiting, token revocation, or silent failures that corrupt campaign state.

## Authentication

### System User Tokens (required for autonomous operation)

**Use System User Tokens, not User Access Tokens.** For long-term server-to-server automation, System User tokens are the gold standard because:

- They are linked to the Business Manager, not a personal account
- They do not expire (User Access Tokens expire in ~60 days)
- They survive personnel changes — the automation keeps working if a person leaves

Personal User Tokens are appropriate only for local development and one-off scripts.

### Security Protocols

- **Never** hard-code access tokens in source files
- **Never** commit tokens to version control
- Store tokens in encrypted environment variables or a secrets manager (AWS Secrets Manager, Google Secret Manager, Doppler, etc.)
- Transmit only over HTTPS
- Rotate tokens on a documented schedule (quarterly minimum)
- Log token usage but **never** log the token value itself

If the calling system detects a token has been exposed (e.g., committed to git), the action is immediate: revoke at Meta, generate a replacement, invalidate any downstream caches.

## Rate Limits

Meta imposes rate limits on API calls within a rolling one-hour window. Exceeding them results in throttling — and repeated violations escalate to temporary account restrictions.

### Three resilience strategies (use all three)

**1. Exponential Backoff**
When a rate-limit error is returned, wait before retry. Don't retry immediately.

```
Attempt 1: fail → wait 2s
Attempt 2: fail → wait 4s
Attempt 3: fail → wait 8s
Attempt 4: fail → wait 16s
...up to a cap (e.g., 5 minutes)
```

Retries at the same rate compound the throttle and trigger further penalties.

**2. ETags**
For read operations, Meta supports ETags. Send the prior ETag; if nothing changed, Meta returns 304 Not Modified with no body, and the call doesn't count the same way against bandwidth budgets.

Use ETags for any polling operation (fetching campaign status, insights refreshes).

**3. Batch Requests**
Combine multiple operations into a single HTTP call via the `/batch` endpoint. Reduces round-trip overhead and packs more operations into the rate-limit window.

Batch is especially valuable for:
- Bulk ad creation (10+ ads in one request)
- Multi-object status queries
- Coordinated updates across a campaign's ad sets

### Rate limit headers

Meta returns `X-Business-Use-Case-Usage` and `X-Ad-Account-Usage` headers. Parse these on every response and back off proactively when usage climbs above 80% of the budget. Don't wait for a 429 to react.

## Launch-Paused Workflow

Every new campaign, ad set, and ad is created in the **paused** state. The workflow:

1. **Create** the object via API with `status: PAUSED`
2. **QA** — verify all required checks pass (see `campaign-creation.md` QA checklist)
3. **Activate** with a separate `update` call setting `status: ACTIVE`

**Why:** create-and-activate in a single step means any QA failure is live on the account, burning impressions on misconfigured objects. Launch-paused is a universal insurance policy.

## Naming Schema (Mandatory)

All objects follow the schema from `campaign-creation.md`:

```
Campaign:  OBJ_GEO_LANG_OFFER_AUDIENCE_TESTTYPE_YYYY-MM-DD
Ad Set:    BUDGETTYPE_PLACEMENTS_OPT_EVENT_AUDIENCEWINDOW
Ad:        CONCEPT_HOOK_EXECUTION_FORMAT_ASPECT_VARIANT
```

The naming schema is the contract that lets the system later filter, aggregate, and reason about its own history. Objects without schema-conformant names are invisible to downstream analysis — the system should reject creation requests that don't specify compliant names.

## Response Verification

After every mutating API call, verify the response:

- **Success path:** Meta returns the created/updated object with its ID. Persist the ID to the campaign ledger immediately.
- **Validation error (400):** Inspect `error.error_user_msg`. Common cases: missing pixel permission, audience too small, creative aspect ratio wrong. Return these to the calling system as `decision: "escalate"` if not auto-fixable.
- **Rate limit (4 or 17 error subcodes):** Apply exponential backoff.
- **Permission error (200 with error body, or 403):** Token scope issue. Don't retry; escalate.
- **Temporary server error (5xx):** Retry with backoff up to 3 attempts.

## Insights Edge — What to Pull

The Marketing API's `/insights` edge provides data beyond the standard reports. When analyzing performance, pull:

### Standard metrics
- `impressions`, `reach`, `frequency`, `spend`, `clicks`, `ctr`, `cpm`, `cpc`, `cpp`

### Conversion metrics
- `actions` (with action_type filter for specific conversion events)
- `action_values` (for ROAS calculations)
- `cost_per_action_type`

### 2026-specific / Insights Edge
- `quality_ranking`, `engagement_rate_ranking`, `conversion_rate_ranking`
- `video_p25_watched_actions`, `video_p50_watched_actions`, `video_p75_watched_actions`, `video_p100_watched_actions`
- `video_play_actions` (for 3s view / hook rate calculation)
- Time-series breakdown (`time_increment: 1` for daily granularity — needed for CTR velocity)
- Frequency breakdown (`breakdowns: ['frequency_value']` for frequency-weighted segmentation)

Hook rate calculation: `video_play_actions` (3s) / `impressions`.

## Bulk Operations Architecture

For bulk ad creation (e.g., launching dozens of variants at once), follow this architecture:

1. **Batch creation, paused state.** Use `/batch` endpoint, all objects created with `status: PAUSED`.
2. **QA pass on each.** Iterate the created IDs, verify naming schema, pixel, creative, and audience configuration.
3. **Batch activation.** Second batch call activates all QA-passed objects; any that failed QA remain paused with a flag for human review.
4. **Ledger write.** Persist IDs, activation timestamps, initial budgets, and the parent campaign ID to the system's ledger for later reconciliation.

This is the pattern used by automation platforms like AdManage.ai and it scales cleanly to hundreds of ads per launch.

## Common Failure Modes

| Failure                                      | Likely Cause                                  | Resolution                                   |
|----------------------------------------------|-----------------------------------------------|----------------------------------------------|
| Ad set stuck in `CAMPAIGN_PAUSED`            | Parent campaign is paused                     | Activate parent before activating ad set     |
| "Audience is too small"                      | Restrictive detailed targeting + exclusions   | Remove restrictions; try Advantage+ Audience |
| Creative rejected                            | Policy flag on image/copy                     | Inspect `review_feedback`; regenerate        |
| Pixel events not appearing                   | Pixel not installed, CAPI fallback missing    | Escalate; audit tracking setup               |
| Token revoked mid-operation                  | User removed the app from Business Manager    | Escalate; re-authorize                       |
| Intermittent 500 errors                      | Meta API degradation                          | Exponential backoff; check status.fb.com     |

## Operational Guardrails

Autonomous systems should enforce these guardrails at the API layer:

- **Max daily spend change per campaign:** +20% per 72h window, unless explicit override
- **Max new ads created per day:** reasonable ceiling (e.g., 50) to prevent runaway creative generation
- **Max ad sets active per campaign:** ceiling (e.g., 15) to prevent audience overlap
- **Duplicate detection:** before creating any object, check the ledger for an object with the same name in the same account — prevent accidental duplication

Violating guardrails should return `decision: "escalate"` rather than silently executing.
