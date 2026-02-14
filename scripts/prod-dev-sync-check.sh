#!/usr/bin/env bash
# PROD–DEV Sync Check
#
# Compares the first check ID from DEV and PROD history APIs to verify both
# environments read the same backend data (e.g. shared Supabase).
#
# Usage:
#   bash scripts/prod-dev-sync-check.sh
#
# Prerequisites:
#   - curl, jq
#   - DEV server running (npx vercel dev) for DEV_BASE
#   - DEFAULT_PROFILE_ID in .env.local or PROFILE_ID env var
#
# Optional env vars:
#   DEV_BASE   – DEV API base URL (default: http://localhost:3000)
#   PROD_BASE  – PROD API base URL (default: https://allergy-angel.vercel.app)
#   PROFILE_ID – Profile UUID to query (default: from .env.local DEFAULT_PROFILE_ID)
#
# Exit: 0 if IDs match, 1 if mismatch or error

set -euo pipefail

DEV_BASE="${DEV_BASE:-http://localhost:3000}"
PROD_BASE="${PROD_BASE:-https://allergy-angel.vercel.app}"

# Load PROFILE_ID from .env.local if not set
if [ -z "${PROFILE_ID:-}" ] && [ -f .env.local ]; then
  export "$(grep -E '^DEFAULT_PROFILE_ID=' .env.local | head -1 | xargs)"
  PROFILE_ID="${DEFAULT_PROFILE_ID:-}"
fi

if [ -z "${PROFILE_ID:-}" ]; then
  echo "❌ PROFILE_ID not set. Set it or add DEFAULT_PROFILE_ID to .env.local"
  exit 1
fi

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ Missing dependency: $1"
    exit 1
  }
}
require curl
require jq

echo "PROD–DEV Sync Check"
echo "  DEV:  $DEV_BASE"
echo "  PROD: $PROD_BASE"
echo "  Profile: $PROFILE_ID"
echo "────────────────────────────────────────────────────────────"

DEV_CHECK_ID=$(curl -sS "$DEV_BASE/api/history?profileId=$PROFILE_ID&limit=1&offset=0" | jq -r '.checks[0].id // empty')
PROD_CHECK_ID=$(curl -sS "$PROD_BASE/api/history?profileId=$PROFILE_ID&limit=1&offset=0" | jq -r '.checks[0].id // empty')

if [ -z "$DEV_CHECK_ID" ]; then
  echo "❌ DEV returned no checks (or API error)"
  exit 1
fi
if [ -z "$PROD_CHECK_ID" ]; then
  echo "❌ PROD returned no checks (or API error)"
  exit 1
fi

echo "DEV  first check: $DEV_CHECK_ID"
echo "PROD first check: $PROD_CHECK_ID"

if [ "$DEV_CHECK_ID" = "$PROD_CHECK_ID" ]; then
  echo "────────────────────────────────────────────────────────────"
  echo "✅ Sync OK — both environments read the same data"
  exit 0
else
  echo "────────────────────────────────────────────────────────────"
  echo "⚠️  Mismatch — DEV and PROD may use different databases"
  exit 1
fi
