> 🤖 Technical spec for AI tools: see [SPEC.md](./SPEC.md)

# MRD — Allergy Angel v1

## 1. Product Overview

Allergy Angel is a mobile-first (responsive web) assistant that helps users avoid high-risk "commit moments" by evaluating potential interactions before they act.

**Primary focus in v1:**
- Supplement ↔ Medication
- Supplement ↔ Supplement
- Food ↔ Medication (e.g., grapefruit warnings)

**The product delivers:**
- A clear risk verdict (Safe | Caution | Avoid | Insufficient data)
- A confidence score
- A transparent explanation
- Guidance on how to increase confidence

The system learns gradually through usage via **elliptical enlightenment**: immediate value first, profile fidelity later.

---

## 2. Primary Users

### 2.1 Self-Manager (v1 primary)
- Takes multiple medications and/or supplements
- May have allergies
- Wants a fast, trustworthy check before taking or consuming something

**Job to be done:**
> "Before I take or eat this, tell me if it's likely safe for me."

### 2.2 Family Caretaker (v1-lite)
- Manages safety for spouse, kids, or parents
- Needs repeatable, low-friction checks
- Deeper multi-profile support deferred to v2+

---

## 3. Commit Moments (Priority Order)

**Supported in v1:**
1. Taking a new supplement or medication
2. Grocery shopping / food label review
3. Manual "what if" queries

---

## 4. Input Modes (v1)

**Priority order:**
1. **Manual text input**
2. **Photo upload**
   - Supplement bottle
   - Prescription list / screenshot
   - Ingredient label
3. **Barcode scan**
   - v1 may resolve to product name only
   - System should request ingredient photo if insufficient

**Voice input:** explicitly out of scope for v1

---

## 5. Risk Categories (v1 Scope)

### In Scope
- Supplement ↔ Medication (highest priority)
- Supplement ↔ Supplement
- Food ↔ Medication
- Allergies as contextual risk modifiers

### Explicitly Out of Scope (v1)
- Medication ↔ Medication (planned later)
- Dosage / timing modeling
- Clinical decision support claims

---

## 6. Core Product Principles

### 6.1 Elliptical Enlightenment
- No mandatory upfront setup
- First question or photo must deliver value
- Profile grows via inference, confirmation, and throttled suggestions
- Never nag; encourage gently

### 6.2 Safety & Uncertainty Rules
- If confidence is Low, output cannot be "Safe"
- If data is insufficient, output "Insufficient data"
- Always recommend pharmacist/provider when uncertain
- System must be transparent about probabilistic nature

### 6.3 Privacy & Storage
- Default: store extracted structured data only
- Original images not stored by default
- Premium upgrade later enables image audit/reprocessing

---

## 7. Core Pages (v1)

| Route | Purpose |
|-------|---------|
| `/ask` | Ask a question or upload input |
| `/result` | Show risk verdict + explanation |
| `/profile` | View/edit inferred and confirmed data |
| `/history` | View past checks |

---

## 8. Primary User Flow

**Ask → Result → (Optional) Profile Suggestion**

1. User submits text, photo, barcode, or combination
2. System evaluates against:
   - Current profile (if present)
   - Known interaction data
3. Result screen shows:
   - Risk label
   - Confidence score
   - Explanation
   - What would improve confidence
4. Optional, throttled prompt:
   > "We think you may be taking X — confirm?"

---

## 9. Output Specification

### 9.1 Risk Labels (User-Facing)
- Safe
- Caution
- Avoid
- Insufficient data

### 9.2 Confidence
**Display:**
- Label: Low / Medium / High
- Numeric score: 0–100
- Confidence score must be explained (not opaque)

### 9.3 Explanation Structure
Each result includes:
- What we detected (entities + interaction type)
- Why it matters (plain language mechanism)
- What to do next
- What data is missing (if applicable)

---

## 10. Profile Model (v1 Minimal)

**Goal:** improve confidence, not become a medical record.

**Stored Elements:**
- Supplements
- Medications
- Allergies
- User confirmations
- System-inferred suggestions (unconfirmed until accepted)

**Inference Rules:**
- Medications may imply conditions
- Conditions are never assumed as truth
- System asks for confirmation later

---

## 11. History (v1)

**Each check stores:**
- Timestamp
- Summarized input
- Extracted entities
- Risk output
- Confidence score
- Optional feedback ("Was this helpful?")

**Capabilities:**
- View list
- Re-open a prior check
- Re-run a check with updated profile

---

## 12. Mock API Contracts (for UX-first build)

### POST /api/check

**Request:**
```json
{
  "profileSnapshot": {},
  "input": {
    "text": "",
    "images": [],
    "barcode": ""
  }
}
```

**Response:**
```json
{
  "riskLabel": "Safe | Caution | Avoid | Insufficient data",
  "confidenceScore": 0,
  "confidenceLevel": "Low | Medium | High",
  "summary": "",
  "reasons": [],
  "missingInfo": [],
  "profileSuggestions": [
    {
      "type": "medication | supplement | allergy | conditionHypothesis",
      "value": "",
      "confidence": 0.0,
      "requiresConfirmation": true
    }
  ]
}
```

### GET /api/history
Returns list of prior check summaries.

### POST /api/profile/update
Accepts confirmations and edits.

---

## 13. Monetization (v1)

### Free
- Core checks
- Profile building
- History
- Explanations

### Premium (later)
- Image audit/reprocessing
- Extended history
- Export/share

**Upsell timing:**
- Later, after user has experienced value
- Subtle reminder that image storage is courtesy in v1

---

## 14. Non-Functional Requirements

- Mobile-first responsive UX
- Fast perceived response (mock APIs acceptable)
- Clear disclaimers (not medical advice)
- Accessible typography and contrast
- No PHI logging in production

---

## 15. Delivery Plan

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Infra + shell + deploy | ✅ Completed |
| 1 | Ask → Result UX with mock /api/check | Current |
| 2 | Profile suggestions + confirmation loop | Next |
| 3 | History + re-run | Queued |
| 4 | Harden storage + contracts | Queued |
| 5 | Premium toggle stubs | Queued |

---

## 16. Explicit Out of Scope (v1)

- Medication timing/dosage
- Medication ↔ medication interactions
- Voice input
- EHR integration
- Clinical decision support positioning

## Implementation Link
Phase 6 implementation details (extraction pipeline, agent boundary, eval harness) live in:
- `docs/Phase-6-Extraction.md`

## 17. Future Consideration — Allergen Taxonomy (Phase 10H)

> **Status:** Product intent recorded; implementation deferred.

### Problem

The system currently tracks allergens as flat strings (e.g., "tree nuts") but does not map parent allergy classes to specific ingredients. A user whose profile indicates a tree nut allergy would not be automatically alerted when a check contains "pistachio" — because the system has no parent→child taxonomy connecting the two.

This matters most for:
- Tree nuts → pistachio, cashew, walnut, pecan, macadamia, etc.
- Shellfish → shrimp, crab, lobster, etc.
- Stone fruits → peach, cherry, plum, apricot, etc.

### Product Intent

Move from **reactive learning** (pattern detection after symptoms) to **protective awareness** (proactive flagging before ingestion). The system should be able to say: "Pistachio is commonly classified as a tree nut" at the moment of check, not after a reaction is logged.

### Future Direction

A deterministic taxonomy registry (parent → child[]), similar to the Phase 10G functional class registry, applied post-extraction:
- Registry maps allergen classes to specific ingredients
- Applied during risk evaluation (checkRisk or a successor module)
- Surfaces as a UI annotation on the check detail page and/or verdict

### Explicit Deferrals

- **No extraction changes** — the LLM prompt and extraction schema remain unchanged.
- **No LLM guessing** — taxonomy is deterministic, not inferred.
- **No cross-reactivity or diagnosis** — "commonly classified as" is informational, not clinical.
- **No schema changes** in current phases — profiles, checks, and health_events tables are untouched.

### Interim Guardrail (Phase 10H-lite)

A minimal copy-level note is surfaced in the History Check Detail UI when:
1. The user's profile includes a tree nut allergy, AND
2. The check's raw text or extracted events mention a specific tree nut (e.g., pistachio).

This is a UI-only awareness surface — no inference, scoring, or persistence changes.

### Taxonomy Registry (Phase 10H/10I)

The allergen taxonomy (`api/_lib/inference/allergenTaxonomy.ts`) is a deterministic parent→child registry. When a profile lists a parent (e.g., `tree_nut`), the system expands to all children (e.g., pistachio, cashew) and matches meal text via phrase-safe word-boundary logic. No LLM, no embeddings — fully auditable. To update: add tokens to the registry, bump `ALLERGEN_TAXONOMY_VERSION`, add tests in `eval/test-phase-10i-taxonomy-guardrails.ts`, and run `npm run test:phase-10i`.

---

## 18. Deferred Depth: Advanced Inference Loops (Individual vs. Collective)

> This section captures future-facing inference concepts. These are explicitly **out of scope for v1 execution** and are included to preserve design intent without slowing horizontal delivery.

* **Individual Logic:** Layering user profiles (meds, age, known allergies) over extractions to provide risk-aware framing.
* **Collective Signal:** Aggregating "weak signals" (like May's "feeling yucky") across similar profiles to surface non-diagnostic patterns.
* **Safety Guardrails:** Strict separation between "Accumulated Evidence" and "Medical Advice," especially for pediatric (Zea/May) vs. adult (Amber) profiles.

---

## Future Architecture — Ontology Gap Discovery (Exploratory)

**Concept:**
Surface high-frequency or high-lift ingestibles that are extracted successfully but do not match ALLERGEN_TAXONOMY or FUNCTIONAL_CLASS_REGISTRY, so we can curate taxonomy expansions safely.

**Purpose:**
Reduce "knowledge lag" between real-world ingredient usage and deterministic registry coverage.

**How it works (deterministic + human-in-the-loop):**
- Flag extracted entities that are unmapped in the registries.
- Rank clusters by:
  (a) co-occurrence with known allergy categories (e.g., tree_nut),
  (b) symptom association lift vs baseline,
  (c) frequency across checks for the same profile (single-profile only for now).
- AA Team reviews and seeds new terms into the registries (no auto-updates).

**Non-Goals (avoid local maxima):**
- No automatic taxonomy expansion
- No embedding similarity search
- No cross-profile aggregation
- No autonomous ontology updates
- No clinical/diagnostic claims

**Trigger to revisit:**
- Registry maintenance becomes an operational bottleneck
- Ingredient diversity outgrows seeded taxonomy coverage
- Multi-profile + consented collective analytics is introduced

**Status:** Deferred — Conceptual only.

---

## Next Steps (Proposed)

| Option | Scope | MRD Alignment |
|--------|-------|---------------|
| **A** | Phase 10J.2: Meal carb decomposition + follow-up refinement (multi-meal carbs assignment, reduce false clarifications) | Extraction + Phase 10J hygiene |
| **B** | Phase 10K: Observability & guardrails (log verdict + insight counts per request, add minimal debug endpoint or structured logs, no PHI) | NFRs, non-diagnostic |
| **C** | Phase 10L: Multi-profile groundwork (profile switcher UI + history scoped per profile, still no auth) | Family Caretaker, History |
