#!/usr/bin/env bash
# Push every non-placeholder key in .env to the specified Vercel environment.
# Usage:  ./scripts/push-vercel-env.sh [production|preview|development]
#
# Prerequisites:
#   1. vercel login
#   2. vercel link --cwd apps/web  (links this repo to the right Vercel project)
#
# Overrides APP_URL to https://www.littlecolorbook.com for the production
# env (canonical www — apex redirects strip Authorization headers on
# internal-HTTP job dispatch, see tasks/lessons.md 2026-04-20) and
# http://localhost:3000 for development. Also sets APP_URL_CANONICAL_HOST
# in production so the boot-time guardrail in instrumentation.ts catches
# any future drift. Everything else copies verbatim from the root .env file.

set -euo pipefail

ENV_TARGET="${1:-production}"
if [[ "$ENV_TARGET" != "production" && "$ENV_TARGET" != "preview" && "$ENV_TARGET" != "development" ]]; then
  echo "First arg must be production | preview | development" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
APPS_WEB_DIR="$REPO_ROOT/apps/web"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# Keys we never upload — either client-only build metadata, placeholders,
# or things that must stay local (dev-only stubs, local analytics flags).
SKIP_KEYS=(
  "ALLOW_STRIPE_WEBHOOK_STUB"
  "NEXT_PUBLIC_ANALYTICS_DEBUG"
)

should_skip() {
  local key="$1"
  for skip in "${SKIP_KEYS[@]}"; do
    if [[ "$key" == "$skip" ]]; then return 0; fi
  done
  return 1
}

push_env() {
  local key="$1"
  local value="$2"

  if should_skip "$key"; then
    echo "  skip  $key (opt-out list)"
    return
  fi
  if [[ -z "$value" ]]; then
    echo "  skip  $key (empty)"
    return
  fi
  if [[ "$value" == FILL_ME* || "$value" == REPLACE_* ]]; then
    echo "  skip  $key (placeholder value)"
    return
  fi

  # vercel env rm is idempotent — we overwrite each time so re-runs sync
  # stale values. The --yes flag avoids the interactive prompt.
  (cd "$APPS_WEB_DIR" && vercel env rm "$key" "$ENV_TARGET" --yes >/dev/null 2>&1 || true)
  printf '%s' "$value" | (cd "$APPS_WEB_DIR" && vercel env add "$key" "$ENV_TARGET" >/dev/null)
  echo "  ok    $key"
}

echo "Pushing .env → Vercel env ($ENV_TARGET)"

while IFS= read -r line || [[ -n "$line" ]]; do
  # Strip CR (Windows line endings) + leading/trailing whitespace
  line="${line%$'\r'}"
  [[ -z "$line" ]] && continue
  [[ "$line" == \#* ]] && continue
  [[ "$line" != *=* ]] && continue

  key="${line%%=*}"
  raw_value="${line#*=}"
  # Strip single surrounding double quotes if present
  if [[ "$raw_value" == \"*\" ]]; then
    raw_value="${raw_value:1:-1}"
  fi
  value="$raw_value"

  # Per-environment overrides
  case "$key" in
    APP_URL)
      case "$ENV_TARGET" in
        production) value="https://www.littlecolorbook.com" ;;
        development) value="http://localhost:3000" ;;
      esac
      ;;
    APP_URL_CANONICAL_HOST)
      case "$ENV_TARGET" in
        production) value="www.littlecolorbook.com" ;;
        development|preview) continue ;;  # skip in non-prod
      esac
      ;;
    NODE_ENV)
      # Vercel owns this — skip entirely
      echo "  skip  $key (managed by Vercel)"
      continue
      ;;
  esac

  push_env "$key" "$value"
done < "$ENV_FILE"

# Always set APP_URL_CANONICAL_HOST in production, even if absent from .env.
# This is the boot-time guardrail against APP_URL drifting back to the apex
# domain and silently stripping Authorization headers on internal-HTTP job
# dispatch (2026-04-20 incident).
if [[ "$ENV_TARGET" == "production" ]]; then
  push_env "APP_URL_CANONICAL_HOST" "www.littlecolorbook.com"
fi

echo "Done."
