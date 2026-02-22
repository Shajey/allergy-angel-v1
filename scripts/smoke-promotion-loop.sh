#!/usr/bin/env bash
# Promotion Smoke Loop
#
# One-command smoke for promotion workflow. Assumes server on localhost:3000.
#
# Usage:
#   npm run smoke:loop
#   # or: bash scripts/smoke-promotion-loop.sh
#
# Prerequisites:
#   - curl, jq
#   - npx vercel dev running on port 3000
#   - DEFAULT_PROFILE_ID in .env.local (or set PROFILE_ID env var)

set -euo pipefail

BASE="${BASE:-http://localhost:3000}"

# Load DEFAULT_PROFILE_ID from .env.local if not set
if [ -z "${PROFILE_ID:-}" ] && [ -f .env.local ]; then
  export "$(grep -E '^DEFAULT_PROFILE_ID=' .env.local | head -1 | xargs)"
  PROFILE_ID="${DEFAULT_PROFILE_ID:-}"
fi

PROFILE_ID="${PROFILE_ID:-a0000000-0000-0000-0000-000000000001}"

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ Missing dependency: $1"
    exit 1
  }
}
require curl
require jq

echo "=== Promotion Smoke Loop ==="
echo "  Base: $BASE"
echo "  Profile: $PROFILE_ID"
echo ""

# 1) Phase 13 tests
echo "1) Running phase 13 tests..."
npm run test:phase-13 --silent
echo "   ✓ phase 13 passed"
echo ""

# 2) Replay validate
echo "2) Running replay:validate:ci..."
npm run replay:validate:ci --silent
echo "   ✓ replay gate passed"
echo ""

# 3) Vigilance API
echo "3) Checking /api/vigilance..."
VIG=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/vigilance?profileId=$PROFILE_ID")
if [ "$VIG" != "200" ]; then
  echo "   ❌ Expected 200, got $VIG"
  exit 1
fi
echo "   ✓ vigilance 200"
echo ""

# 4) Admin unmapped (requires ADMIN_ENABLED)
echo "4) Checking /api/admin/unmapped..."
UNMAPPED=$(curl -s -w "\n%{http_code}" "$BASE/api/admin/unmapped?profileId=$PROFILE_ID")
UNMAPPED_BODY=$(echo "$UNMAPPED" | sed '$d')
UNMAPPED_CODE=$(echo "$UNMAPPED" | tail -1)
if [ "$UNMAPPED_CODE" = "404" ]; then
  echo "   ❌ Admin not enabled (404). Set ADMIN_ENABLED=true in .env.local and restart the server."
  exit 1
fi
if [ "$UNMAPPED_CODE" != "200" ]; then
  echo "   ❌ Expected 200, got $UNMAPPED_CODE"
  echo "$UNMAPPED_BODY" | jq . 2>/dev/null || echo "$UNMAPPED_BODY"
  exit 1
fi
echo "   ✓ unmapped 200"
echo ""

# 5) Get checkId from /api/history
echo "5) Fetching checkId from /api/history..."
HISTORY=$(curl -s "$BASE/api/history?profileId=$PROFILE_ID&limit=1")
CHECK_ID=$(echo "$HISTORY" | jq -r '.checks[0].id // empty')
if [ -z "$CHECK_ID" ] || [ "$CHECK_ID" = "null" ]; then
  echo "   ⚠ No checks found. Run an extraction to create one, or paste a checkId manually:"
  echo "     curl -s \"$BASE/api/report/check/download?checkId=YOUR_CHECK_ID\" -o report.json"
  echo "   Skipping report download step."
else
  echo "   Using checkId: $CHECK_ID"

  # 6) Report download
  echo "6) Checking /api/report/check/download..."
  DL_CODE=$(curl -s -D /tmp/smoke-headers.txt -o /tmp/smoke-report.json \
    -w "%{http_code}" "$BASE/api/report/check/download?checkId=$CHECK_ID")
  if [ "$DL_CODE" != "200" ]; then
    echo "   ❌ Expected 200, got $DL_CODE"
    jq . /tmp/smoke-report.json 2>/dev/null || cat /tmp/smoke-report.json
    rm -f /tmp/smoke-report.json /tmp/smoke-headers.txt
    exit 1
  fi
  if ! grep -qi "Content-Disposition:.*attachment" /tmp/smoke-headers.txt 2>/dev/null; then
    echo "   ❌ Missing Content-Disposition: attachment header"
    rm -f /tmp/smoke-report.json /tmp/smoke-headers.txt
    exit 1
  fi
  echo "   ✓ report download 200 with Content-Disposition"
  rm -f /tmp/smoke-report.json /tmp/smoke-headers.txt
fi

echo ""
echo "=== Smoke loop passed ==="
