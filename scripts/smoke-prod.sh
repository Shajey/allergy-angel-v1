#!/usr/bin/env bash
set -euo pipefail

# Smoke test for extraction endpoint
# Usage:
#   bash scripts/smoke-prod.sh
# Optional:
#   ENDPOINT="http://localhost:3000/api/extract" bash scripts/smoke-prod.sh

ENDPOINT="${ENDPOINT:-https://allergy-angel.vercel.app/api/extract}"

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ Missing dependency: $1"
    exit 1
  }
}

require curl
require jq

post() {
  local label="$1"
  local raw="$2"

  echo -e "\n${label}"
  curl -sS -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "{\"rawText\": \"${raw}\"}" | jq .
}

echo "🔥 Smoke Testing Extraction Endpoint"
echo "   $ENDPOINT"
echo "────────────────────────────────────────────────────────────"

post "📊 Test 1: Glucose" "My glucose was 120 mg/dL this morning"

post "💊 Test 2: Medication" "I took 500mg of Tylenol"

post "🍽️  Test 3: Meal (determiner skip)" "I ate a salad for lunch"

post "🍽️  Test 3.1: Meal + Nutrition (should still be meal, not medication)" "I ate a salad for lunch with 45g of carbs"

post "🥗 Test 3.2: Nutrition-only (should NOT be medication)" "Lunch: salad, 45g carbs"

post "❓ Test 4: Unknown Symptom (should need clarification)" "I feel weird"

post "🤕 Test 5: Headache (should extract headache)" "I have a headache"

post "🍽️🤧 Test 6: Meal + Symptom (should extract 2 events)" "I ate a peanut butter sandwich for lunch and now my throat feels itchy"

echo -e "\n────────────────────────────────────────────────────────────"
echo "✅ Smoke test complete"
