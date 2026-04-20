#!/usr/bin/env bash
# Push the creative-fulfillment env vars from local .env into Vercel production.
# Run `vercel login` first so the CLI can write to the project.
# Idempotent: vercel env add will error on existing keys — pipe 'y' to overwrite,
# or remove them first with `vercel env rm <KEY> production -y`.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env not found at $(pwd)/.env" >&2
  exit 1
fi

# Keys to sync to production. Values come straight from local .env.
KEYS=(
  "ELEVENLABS_API_KEY"
  "ELEVENLABS_API_BASE_URL"
  "ELEVENLABS_MODEL_ID"
  "GAMMA_API_KEY"
  "GAMMA_API_BASE_URL"
  "CREATIVE_FULFILLMENT_ENABLED"
)

for key in "${KEYS[@]}"; do
  # Special case: CREATIVE_FULFILLMENT_ENABLED is the feature flag — force "true"
  # even if not in .env.
  if [ "$key" = "CREATIVE_FULFILLMENT_ENABLED" ]; then
    value="true"
  else
    value=$(grep -E "^${key}=" .env | head -1 | cut -d'=' -f2- | tr -d '"' || echo "")
  fi

  if [ -z "$value" ]; then
    echo "SKIP  $key (no value in .env)"
    continue
  fi

  echo "PUSH  $key → production"
  # Remove existing value first (silent if not present), then add fresh.
  # --sensitive flag skips the interactive "Mark as sensitive?" prompt so
  # the pipe carries only the value. All creative keys are API secrets
  # that should be marked sensitive anyway.
  (cd apps/web && vercel env rm "$key" production -y >/dev/null 2>&1 || true)
  (cd apps/web && printf "%s" "$value" | vercel env add "$key" production --sensitive >/dev/null)
done

echo ""
echo "Done. Redeploy to activate: vercel --prod  (from apps/web/)"
