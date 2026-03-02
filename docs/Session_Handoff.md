# Allergy Angel — Session Handoff

> **Purpose**: Bootstrap document for any future AI conversation about this project.
> **Last Updated**: March 2026
> **Session**: Claude retrospective + Phase 16/17 planning

---

## What This Is

A **family allergy and medication safety tool**. Parent (Shajey) checks items for his kids (Amber, Zea) and himself at places like Walgreens.

**NOT** a healthcare platform. **NOT** a medical device.

---

## The Walgreens Test

Every feature must pass this test:

> "I'm at Walgreens. I scan a product. I select which family member I'm checking for. The app tells me if it's safe and why."

---

## Current State

### What's Working ✅
- Allergen taxonomy with cross-reactivity (tree_nut → cashew, pistachio, etc.)
- Meal → allergen matching with verdicts
- Profile page (medications, supplements, allergies)
- History with verdict badges (High Risk, Caution, Safe)
- Check detail with explanation, "Why?", confidence
- Safety Protocol modal (emergency guidance)
- Notification system (profile nudges, tips)
- Precaution banner (persistent safety awareness)
- Insights page (functional stacking detection)
- Governance (replay gates, PR packager, determinism)

### What's Missing ❌
- **Profile switcher** (Phase 16) — can't check for different family members
- **Photo input** (Phase 17) — can't scan labels at Walgreens
- **Supplement → medication interactions** (Phase 17) — only 4 medications in INTERACTION_MAP

### What's Built But Not Wired
- `FUNCTIONAL_CLASS_REGISTRY` — used for insights, not verdicts
- `event.type === "supplement"` — ignored by `checkRisk.ts`

---

## Key Documents (Read First)

| Document | Purpose | When to Read |
|----------|---------|--------------|
| `docs/PRODUCT_CONSTITUTION.md` | What we're building and for whom | Start of any work |
| `docs/GOVERNANCE_BLUEPRINT.md` | How to build safely, file risk levels | Before touching code |
| `docs/Spec.md` | Types, guardrails, business rules | Before implementation |
| `docs/PHASE_16_PROMPT.md` | Multi-profile implementation spec | When executing Phase 16 |
| `docs/PHASE_17_PROMPT.md` | Photo + interactions spec | When executing Phase 17 |
| `docs/PHASE_18_PROMPT.md` | PWA + mobile camera + UI polish | When executing Phase 18 |
| `docs/Promotion_Runbook.md` | How to add allergens to taxonomy | When expanding knowledge |

---

## Core Scenarios

### Scenario 1: Child + Allergies (Phase 16 enables this)
```
Parent at Walgreens → Scan granola bar → Select "Amber" → 
App says "Contains tree nuts — Amber is allergic"
```

### Scenario 2: Self + Medications (Phase 17 enables this)
```
Shajey at Walgreens → Scan fish oil bottle → Select "Shajey" →
App says "May increase bleeding risk with Eliquis"
```

---

## Tech Stack

- **Frontend**: React, TypeScript, responsive web (mobile-first)
- **Backend**: Vercel serverless functions (≤12 on Hobby plan)
- **Database**: Supabase (PostgreSQL)
- **Extraction**: LLM or heuristic, schema-validated (AJV)
- **Inference**: Deterministic rules engine (`checkRisk.ts`)

---

## Architecture Layers

```
LAYER 4 — KNOWLEDGE MUTATION
  PR packager, apply, taxonomy version bump

LAYER 3 — GOVERNANCE  
  Replay gate, allowlist, version pinning

LAYER 2 — DISCOVERY
  Unmapped terms, promotion export

LAYER 1 — RUNTIME (user-facing)
  Extract → Persist → Inference → Report → Vigilance
```

**Cardinal rule**: No layer may mutate a layer above it.

---

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| 10i | Taxonomy guardrails | ✅ Done |
| 12 | Replay gate + PR packager | ✅ Done |
| 13 | Report/vigilance UX | ✅ Done |
| 14 | Advice system | ✅ Done |
| 15 | Vigilance determinism | ✅ Done |
| **16** | **Multi-profile** | ✅ Done |
| **17** | **Photo + medication interactions** | ✅ Done |
| **18** | **PWA + Mobile Camera + UI Polish** | ✅ Done |

---

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| Responsive web first (not native) | Faster iteration, single codebase |
| Governance is correct, keep it | Protects against knowledge drift |
| Supplements were intentionally deferred | Allergen foundation had to be solid first |
| Profile switcher is the unlock | Both scenarios require "check for whom?" |
| 20 supplement interactions is enough for v1 | Covers common cases without data licensing |

---

## Coding Constraints (From Cursor Codebase Analysis)

### File Structure
| Category | Location |
|----------|----------|
| API routes | `api/` — top-level file = route (`api/profile.ts` → `/api/profile`) |
| API shared logic | `api/_lib/` — subdirs: `inference/`, `persistence/`, `vigilance/`, etc. |
| React pages | `src/pages/` — PascalCase (`AskPage.tsx`, `InsightsPage.tsx`) |
| React components | `src/components/` — grouped: `layout/`, `ui/`, `shared/` |
| Types | `src/types/*.ts` — shared types |
| Utilities | `src/lib/*.ts` |
| Phase tests | `eval/test-phase-*.ts` |
| Vitest tests | Next to source (`*.test.tsx`) |
| Migrations | `docs/migrations/NNN_description.sql` |
| Schemas | `docs/contracts/*.schema.json` |

### TypeScript
- Strict mode: `"strict": true`
- ESM imports: use `.js` extension (e.g., `from "./allergenTaxonomy.js"`)
- Path alias: `@/*` → `src/*`
- Avoid `any` except API handlers and catch blocks

### API Pattern
```typescript
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  // ...
}
```

### Error Response Shape
```typescript
{ error: string, details: null }
```

### Database
- Migrations: `docs/migrations/NNN_description.sql`
- Idempotent: `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
- Required: `created_at timestamptz NOT NULL DEFAULT now()`
- UUID: `gen_random_uuid()` (not `uuid_generate_v4()`)

### localStorage Keys
- `allergyangel_profile`
- `allergyangel_history`
- `allergyangel_selected_profile` (Phase 16)

### Determinism (CRITICAL)
- `checkRisk.ts`: pure, no DB writes, no Date.now()
- Stable sorting: alphabetical tie-breakers
- No fuzzy matching in inference

### Cursor MUST NOT
- Add DB writes in `api/_lib/inference/*`
- Create standalone API routes (consolidate)
- Use Date.now() in deterministic outputs
- Bypass PR packager for taxonomy changes
- Add heavyweight libs to inference runtime
- Persist raw images

---

## Retrospective Summary

### How Drift Happened
1. Long ChatGPT conversations exceeded context limits
2. Cross-conversation context was lost
3. Each session responded to immediate bugs, not original vision
4. "Family allergy tool" became "enterprise healthcare platform"

### What Was Right
- Governance infrastructure (replay gates, determinism)
- Allergen taxonomy and matching
- "Elliptical enlightenment" philosophy

### What Was Missing
- Profile switcher (family = multiple profiles)
- Supplement processing in checkRisk
- Photo input for scanning

### Triangle of Perspectives
- **ChatGPT**: Built governance first to prevent drift; allergen bugs consumed supplement time
- **Gemini**: "Family Shield" model; multi-profile should have been earlier
- **Claude**: Scaffolding is solid; need to fill registries and connect features
- **Cursor**: Provided actual codebase conventions to correct prompt assumptions

---

## If Starting a New Conversation

Say this:

```
I'm continuing work on Allergy Angel. Please read these files first:
- docs/PRODUCT_CONSTITUTION.md
- docs/GOVERNANCE_BLUEPRINT.md
- docs/SESSION_HANDOFF.md

Then help me with [specific task].
```

### For Phase 16:
```
Read docs/PHASE_16_PROMPT.md and implement multi-profile support.
Run regression tests first: npm run test:phase-10i, test:phase-13, test:phase-15_3_integration
```

### For Phase 17:
```
Read docs/PHASE_17_PROMPT.md and implement photo input + medication interactions.
Prerequisite: Phase 16 must be complete.
```

### For Phase 18:
```
Read docs/PHASE_18_PROMPT.md and implement PWA + mobile camera + UI polish.
Prerequisite: Phase 16 + 17 complete.
```

---

## File Quick Reference

| Component | Path |
|-----------|------|
| Inference engine | `api/_lib/inference/checkRisk.ts` |
| Allergen taxonomy | `api/_lib/inference/allergenTaxonomy.ts` |
| Functional classes | `api/_lib/inference/functionalClasses.ts` |
| Extraction | `api/_lib/extractFromText.ts` |
| Persistence | `api/_lib/persistence/saveExtractionRun.ts` |
| Supabase client | `api/_lib/supabaseClient.js` |
| Vigilance | `api/_lib/vigilance/computeVigilance.ts` |
| Report builder | `api/_lib/report/buildCheckReport.ts` |
| Replay gate | `eval/replay-validate.ts` |
| Phase tests | `eval/test-phase-*.ts` |
| Health event schema | `docs/contracts/health-event.schema.json` |
| Migrations | `docs/migrations/` |

---

## Success Criteria

v1 is **done** when:

1. ☐ Create profiles for Amber and Shajey
2. ☐ Switch between them in the UI
3. ☐ Photo a product label at Walgreens
4. ☐ Amber's check catches her allergens → HIGH RISK
5. ☐ Shajey's check catches medication interactions → MEDIUM RISK
6. ☐ Both get clear verdicts with reasons
7. ☐ All phase tests passing
8. ☐ All regression tests passing

---

## Contact / Context

- **Human**: Shajey (product manager, parent with allergy-prone kids)
- **Original architect**: ChatGPT (built governance + allergen foundation)
- **Validator**: Gemini (joined mid-project)
- **Retrospective**: Claude (this session)
- **Codebase expert**: Cursor (provided actual conventions)

This is a weekend project, 4 weekends in. Next step: Deploy to production and test on phone (Phase 18.8–18.9).