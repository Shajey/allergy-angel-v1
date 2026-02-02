> 📖 Product context for humans: see [MRD.md](./MRD.md)

# Allergy Angel v1 — Technical Spec

## Overview
Mobile-first web app for checking supplement/medication/food interactions before consumption.

**v1 Interactions Supported:**
- Supplement ↔ Medication (priority)
- Supplement ↔ Supplement
- Food ↔ Medication
- Allergies as risk modifiers

**Out of Scope (v1):** Med↔Med interactions, dosage/timing, voice input, EHR integration

---

## Agent Guardrails (Read First)

- Do NOT add medical diagnosis logic
- Do NOT infer conditions as confirmed facts
- Do NOT introduce new routes or entities not defined here
- Do NOT persist raw images in v1
- Do NOT add onboarding flows or forced setup
- If behavior is ambiguous, prefer returning "Insufficient data"

---

## Core Types

```typescript
// === ENUMS ===
type RiskLabel = 'Safe' | 'Caution' | 'Avoid' | 'Insufficient data';
type ConfidenceLevel = 'Low' | 'Medium' | 'High';
type ProfileItemType = 'medication' | 'supplement' | 'allergy';
type SuggestionType = ProfileItemType | 'conditionHypothesis';

// === PROFILE ===
interface ProfileItem {
  id: string;
  type: ProfileItemType;
  name: string;
  confirmed: boolean;
  inferredFrom?: string; // checkId that suggested it
  createdAt: string;
}

interface Profile {
  items: ProfileItem[];
  updatedAt: string;
}

// === CHECK INPUT/OUTPUT ===
interface CheckInput {
  text?: string;
  images?: string[]; // base64 or URLs
  barcode?: string;
}

interface ProfileSuggestion {
  type: SuggestionType;
  value: string;
  confidence: number; // 0-1
  requiresConfirmation: boolean;
}

interface CheckResult {
  id: string;
  riskLabel: RiskLabel;
  confidenceScore: number; // 0-100
  confidenceLevel: ConfidenceLevel; // derived from confidenceScore, not independently set
  summary: string;
  detectedEntities: string[];
  reasons: string[];
  missingInfo: string[];
  profileSuggestions: ProfileSuggestion[];
  timestamp: string;
}

// === HISTORY ===
interface HistoryEntry {
  id: string;
  inputSummary: string;
  detectedEntities: string[];
  riskLabel: RiskLabel;
  confidenceScore: number;
  timestamp: string;
  feedback?: 'helpful' | 'not_helpful';
}
```

---

## Routes & Components

```
/ask (default)
├── AskPage
│   ├── TextInput
│   ├── PhotoUpload (camera + gallery)
│   ├── BarcodeScanner
│   └── SubmitButton

/result
├── ResultPage
│   ├── RiskBadge (Safe|Caution|Avoid|Insufficient)
│   ├── ConfidenceIndicator (score + level)
│   ├── ExplanationCard (detected, reasons, missing)
│   ├── SuggestionPrompt (throttled, dismissable)
│   └── ActionButtons (new check, view profile)

/profile
├── ProfilePage
│   ├── ProfileItemList (grouped by type)
│   ├── ProfileItemCard (confirm/edit/delete)
│   ├── PendingSuggestions
│   └── AddItemForm

/history
├── HistoryPage
│   ├── HistoryList
│   ├── HistoryCard (summary, risk badge, timestamp)
│   └── RerunButton
```

---

## State Management

```
Profile:     localStorage → loaded into React Context on app init
History:     localStorage (array of HistoryEntry)
CheckResult: component state (not persisted beyond history entry)
Suggestions: transient, shown once per check, dismissable
```

**Keys:**
- `allergyangel_profile` → Profile JSON
- `allergyangel_history` → HistoryEntry[] JSON

---

## API Contracts (Mock for v1)

### POST /api/check
```typescript
// Request
{
  profileSnapshot: Profile;
  input: CheckInput;
}

// Response
CheckResult
```

### GET /api/history
```typescript
// Response
HistoryEntry[]
```

### POST /api/profile/update
```typescript
// Request
{
  action: 'confirm' | 'add' | 'edit' | 'delete';
  item: ProfileItem;
}

// Response
Profile
```

---

## Business Rules

**Safety Rules:**
- confidenceLevel === 'Low' → riskLabel cannot be 'Safe'
- Insufficient data → recommend pharmacist consult
- Always show disclaimer: "Not medical advice"

**Elliptical Enlightenment:**
- No mandatory onboarding
- First query must return value (even with empty profile)
- Profile suggestions throttled: max 1 per check result
- Suggestions require explicit confirmation

**Privacy:**
- Store structured data only (no raw images in v1)
- No PHI logging

---

## Delivery Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Infra + shell + deploy | ✅ Done |
| 1 | Ask → Result with mock API | Current |
| 2 | Profile suggestions + confirm | Next |
| 3 | History + re-run | Queued |
| 4 | Harden storage | Queued |
| 5 | Premium stubs | Queued |

---

## Input Modes (Priority)

1. **Text** — always available
2. **Photo** — bottle, rx list, ingredient label
3. **Barcode** — resolves to product name; request photo if insufficient

---

## UI Requirements

- Mobile-first responsive
- Accessible contrast + typography
- Risk badge colors: Safe=green, Caution=yellow, Avoid=red, Insufficient=gray
- Fast perceived response (optimistic UI acceptable)