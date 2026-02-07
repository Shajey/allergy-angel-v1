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
