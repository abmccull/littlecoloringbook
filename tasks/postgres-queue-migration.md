# Postgres queue migration runbook

Moves all internal jobs (process-sample, process-paid-order, submit-lulu, sync-lulu-status, process-capi-event) off BullMQ/Redis onto a Postgres-backed queue in the `processing_jobs` table.

**Default after deploy:** Postgres is primary and only path. BullMQ code stays in-repo for rollback but runs only when `LEGACY_BULLMQ_WORKER=true`.

## Cutover checklist

### 1. Apply DB migration

```bash
npm run db:push
```

This applies `packages/db/drizzle/0028_processing_jobs.sql`:
- New `processing_jobs` table + 2 enums
- 3 indexes (unique job_key, pickup, claimed_at)

Non-destructive. Run before deploying code.

### 2. Deploy web app (Vercel)

```bash
cd apps/web && vercel --prod
```

After deploy, `enqueueInternalJob()` writes to `processing_jobs` instead of BullMQ. Verify:

```sql
-- Should start seeing new rows land within ~30 seconds of first sample submission
SELECT kind, status, count(*) FROM processing_jobs GROUP BY kind, status;
```

### 3. Deploy worker (Railway)

Trigger a fresh deploy of the worker dyno. New worker logs should show:

```
[worker] boot { ..., queueBackend: "postgres" }
[pg-worker] starting — id=..., poll=2000ms, concurrency=3
[worker] Postgres worker started
[worker] ready — postgres: on, bullmq: off
```

Sample jobs submitted post-deploy will show in worker logs:

```
[pg-worker] process-sample ok { jobId: 'job_xxx', ms: 45000 }
```

### 4. Monitor for 24 hours

Queries to run:

```sql
-- Completed jobs in last hour (should be steady)
SELECT kind, count(*) FROM processing_jobs
WHERE completed_at > now() - interval '1 hour'
GROUP BY kind;

-- Failed jobs (investigate if > 0 for any kind)
SELECT kind, count(*), max(last_error) FROM processing_jobs
WHERE status = 'failed' GROUP BY kind;

-- Stuck-claimed jobs (should always be 0 — self-heal kicks in)
SELECT kind, count(*) FROM processing_jobs
WHERE status = 'claimed' AND claimed_at < now() - interval '15 minutes'
GROUP BY kind;

-- Pending backlog (should drain within seconds on healthy worker)
SELECT kind, count(*) FROM processing_jobs
WHERE status = 'pending' AND scheduled_at < now() - interval '1 minute'
GROUP BY kind;
```

### 5. Post-verification cleanup (after 48h clean run)

1. Remove the `REDIS_URL` env var from Vercel production (web app no longer uses it on the default path):
   ```bash
   cd apps/web && vercel env rm REDIS_URL production -y
   ```

2. Cancel the Upstash Redis instance (or Railway Redis dyno, whichever is the actual provider).

3. Remove the BullMQ-related code in a follow-up commit:
   - Delete `packages/queue/` (the BullMQ wrapper package)
   - Remove `bullmq` + `ioredis` from `apps/web/next.config.ts` `serverExternalPackages`
   - Remove legacy branches in `apps/web/lib/internal-jobs.ts`
   - Remove BullMQ bootstrap in `apps/worker/src/index.ts`
   - Remove `bullmq` dep from `apps/worker/package.json`

   Run typecheck + tests after each removal.

## Emergency rollback

**If the Postgres worker misbehaves and you need BullMQ back temporarily:**

1. On Vercel (web):
   ```bash
   cd apps/web
   vercel env add FORCE_LEGACY_BULLMQ production  # value: true
   vercel --prod
   ```

2. On Railway (worker):
   ```bash
   railway variables set LEGACY_BULLMQ_WORKER=true
   # redeploy worker
   ```

This puts BullMQ back on the hot path (with its known flakiness). Any Postgres rows already enqueued but not yet processed will remain `pending` — the Postgres worker just stops polling. They'll resume processing whenever Postgres worker is re-enabled.

## Design notes

- **Source of truth:** `processing_jobs` row. Every enqueue is `INSERT`. Every pickup is `SELECT ... FOR UPDATE SKIP LOCKED`.
- **Dedup:** `job_key` column with unique index when non-null. Caller passes a stable key for idempotent enqueue (e.g., `purchase_capi_<orderId>`).
- **Retries:** on failure, worker updates `attempt_count`, sets `scheduled_at = now() + backoff`, resets status to `pending`. Exhausts at `max_attempts` (default 3) → terminal `failed` state.
- **Stuck-job recovery:** worker every ~1 minute resets `claimed` rows older than 15 min back to `pending`. Safe even if multiple workers race.
- **Concurrency:** worker claims up to `PG_WORKER_CONCURRENCY=3` per kind per poll, across all kinds in parallel. At 2-second polls that's ~9 jobs/sec headroom — well above expected load.
- **Observability:** `getProcessingJobCounts()` exposes counts by (kind, status) for the admin dashboard.

## Tunables (env vars)

| Var | Default | Purpose |
|---|---|---|
| `PG_WORKER_POLL_MS` | 2000 | How often the worker checks for new jobs. Lower = faster pickup, more DB queries. |
| `PG_WORKER_CONCURRENCY` | 3 | Max parallel jobs per kind per poll cycle. |
| `PG_WORKER_CLAIM_TIMEOUT_SECONDS` | 900 (15 min) | How long a claimed job can run before the self-healing reset treats it as crashed. Raise for slower jobs. |
| `FORCE_LEGACY_BULLMQ` | unset | Web-side: force enqueue via BullMQ instead of Postgres. Rollback only. |
| `LEGACY_BULLMQ_WORKER` | unset | Worker-side: also start BullMQ worker alongside Postgres worker. Rollback only. |
