# OpenClaw Cron Examples

Use these as starting cron jobs for the content system.

## Creative Ingest

```bash
openclaw cron add --name "Creative ingest" \
  --cron "0 7 * * 1-6" \
  --tz "America/Denver" \
  --session isolated \
  --message "Run the coloring-book-content-factory skill in analysis mode. Ingest yesterday's metrics, update winner and loser status, and propose today's exploit, adjacent, and explore plan."
```

## Creative Production

```bash
openclaw cron add --name "Creative production" \
  --cron "0 9 * * 1-6" \
  --tz "America/Denver" \
  --session isolated \
  --message "Run the coloring-book-content-factory skill in production mode. Produce today's asset batch, store metadata, and queue approved content."
```

## Midday Publish Check

```bash
openclaw cron add --name "Midday publish check" \
  --cron "0 13 * * 1-6" \
  --tz "America/Denver" \
  --session isolated \
  --message "Review queued assets, publish approved organic posts, and nominate top candidates for paid testing."
```

## Weekly Synthesis

```bash
openclaw cron add --name "Weekly synthesis" \
  --cron "0 17 * * 0" \
  --tz "America/Denver" \
  --session isolated \
  --message "Run weekly synthesis. Report top hooks, personas, occasions, voices, formats, paid winners, organic winners, and what to scale next week."
```
