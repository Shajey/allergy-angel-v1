# Allergy Angel System Governance Blueprint

Constitution-level document defining how the system works, what is allowed, what is forbidden, and how components interact. Repo-grounded. Deterministic-focused. Usable as a prompt seed for AI agents and cross-LLM portability.

---

## 0. Domain Primer

Allergy Angel helps people with allergies, food sensitivities, and chronic conditions track what they eat and take, then tells them when something is dangerous. Users are parents managing a child's tree nut allergy, patients juggling multiple food allergies alongside medications, and caregivers coordinating complex dietary restrictions. For these users, a missed allergen match is not a bug -- it is a health risk.

**Health Event:** When a user reports "I had pad thai for lunch," the system extracts structured events: meal ingredients (peanut, shrimp, soy sauce), medications taken, supplements ingested. A single input can produce multiple health events, each with type, fields, confidence, and provenance.

**Risk Verdict:** The inference engine evaluates extracted events against the user's known allergies and medications. If a tree-nut-allergic user ate cashew chicken, the verdict is `high` with `matched: ["cashew"]` and `matchedCategory: "tree_nut"`. If mango is cross-reactive with tree nuts, the verdict is `medium` with reasoning explaining the latex-fruit association. If nothing triggers, verdict is `none`. Every verdict is deterministic and reproducible.

**Vigilance Score:** Tracks cumulative risk pressure over a time window. If a user has had three medium-risk exposures in the past 12 hours, vigilance is active and the score reflects compounding danger. This tells caregivers "pay extra attention right now."

**Taxonomy:** A versioned knowledge graph mapping allergen categories to children (tree_nut -> cashew, pistachio, walnut) and cross-reactive associations (tree_nut -> mango via latex-fruit syndrome). The taxonomy is the system's understanding of what is dangerous. It grows only through a governed promotion flow with replay validation.

Every technical decision in this system traces back to keeping these users safe.

---

## 1. System Purpose and Philosophy

**Core Model:** Deterministic Safety Engine with LLM-assisted extraction.

- **Deterministic inference:** Risk verdicts, vigilance scoring, and replay validation are rules-based. Same inputs produce same outputs. No probabilistic runtime reasoning.
- **LLM-assisted extraction:** Raw text is parsed into structured health events via heuristic or LLM. LLM output is never trusted without schema validation (AJV).
- **Human-in-the-loop promotion:** Ontology growth (taxonomy, registry) requires explicit human selection, PR packaging, replay gate pass, and apply+verify. No autonomous ontology mutation.
- **Replay Gate as safety authority:** Before any taxonomy change is merged, replay validation must pass. Replay is the constitutional safety court.

**Explicit Non-Goals:**

- No probabilistic runtime reasoning (inference is deterministic)
- No DB writes during inference (inference reads profile/events, computes verdict; persistence is a separate step after extraction)
- No auto-promotion (human must select terms and run PR packager)
- No silent knowledge mutation (all taxonomy changes flow through PR packager and replay gate)

---

## 2. High-Level Data Flow (End-to-End Map)

```
User input
  -> Extraction (LLM or heuristic)
  -> Structured persistence (Supabase)
  -> Deterministic inference engine
  -> Report verdict
  -> Vigilance scoring
  -> Discovery (unmapped)
  -> Promotion Export
  -> Replay Gate
  -> PR Packager
  -> Apply + Verify
  -> New Knowledge Version
```

| Step | File/Route | Deterministic? | Mutates State? |
|------|------------|----------------|----------------|
| User input | Client (`src/`) | N/A | No |
| Extraction | `api/extract.ts` -> `api/_lib/extractFromText.ts` | Heuristic: yes. LLM: schema-validated | No |
| Persistence | `api/_lib/persistence/saveExtractionRun.ts` | No (async DB) | Yes (checks, health_events) |
| Inference | `api/_lib/inference/checkRisk.ts` | Yes | No |
| Report | `api/report/check/index.ts` -> `api/_lib/report/buildCheckReport.ts` | Yes | No |
| Vigilance | `api/vigilance.ts` -> `api/_lib/vigilance/computeVigilance.ts` | Yes (within ageBucket) | No |
| Discovery | `api/admin/unmapped.ts` -> `api/_lib/admin/unmappedDiscovery.ts` | Yes | No |
| Promotion Export | `api/admin/promotion-export.ts` -> `api/_lib/admin/promotionExport.ts` | Yes | No |
| Replay Gate | `eval/replay-validate.ts` -> `api/_lib/eval/replayDiff.ts` | Yes | No |
| PR Packager | `eval/pr-packager.ts` -> `api/_lib/admin/prPackager/index.ts` | Yes | No (writes eval/out) |
| Apply + Verify | `eval/apply-pr-package.ts` | Yes | Yes (copies to fixture) |

---

## 2A. Layered Authority Model

The system is organized into four architectural layers. Each layer has a defined scope and strict mutation boundaries.

```
LAYER 4 — KNOWLEDGE MUTATION (writes new knowledge versions)
  eval/pr-packager.ts, eval/apply-pr-package.ts, allergenTaxonomy.ts version bump

LAYER 3 — GOVERNANCE (validates and gates knowledge changes)
  eval/fixtures/replay/knowledge/*, eval/fixtures/replay/allowlist.json
  eval/replay-validate.ts, api/_lib/eval/replayDiff.ts

LAYER 2 — DISCOVERY (read-only analysis of gaps)
  api/admin/unmapped.ts, api/admin/promotion-export.ts
  api/_lib/vigilance/computeVigilance.ts (pressureSources)

LAYER 1 — RUNTIME (serves users, computes verdicts)
  api/extract.ts, api/_lib/persistence/saveExtractionRun.ts
  api/_lib/inference/checkRisk.ts
  api/report/check/index.ts, api/vigilance.ts
```

**Cardinal rule: No layer may mutate a layer above it.**

| Boundary | Constraint |
|----------|------------|
| Runtime -> Governance | Runtime cannot modify replay fixtures, allowlist, or scenarios. |
| Governance -> Runtime | Governance cannot modify runtime code directly. It validates; it does not deploy. |
| Knowledge Mutation -> Runtime | Knowledge mutation must pass governance (replay gate) before affecting runtime. The promotion flow enforces this. |
| Discovery -> Knowledge | Discovery surfaces candidates. It never writes taxonomy or registry. Human selection is required. |

---

## 3. The Learning Loop (Governed)

| Stage | Artifact | Safety Guarantee | Breaks If Misused |
|-------|----------|------------------|-------------------|
| **Discovery Radar** (Phase 11) -- Surfaces terms in user input not yet in taxonomy. How the system learns what it doesn't know. | `api/admin/unmapped` -> candidates | Read-only; no ontology change | N/A |
| **Evidence Export** (Phase 12.1) -- Packages discovery candidates with frequency, risk rate, and examples for human review. | `api/admin/promotion-export` -> JSON | Read-only; human selects terms | N/A |
| **Replay Safety Gate** (Phase 12.2) -- Regression test comparing baseline vs candidate taxonomy over fixture scenarios. Constitutional safety court. | `eval/replay-validate.ts` -> `replay-diff.json` | Fingerprinted allowlist; version pinned | Version mismatch fails gate |
| **Bundle Packager** (Phase 12.3) -- Produces deterministic PR package with patches, replay-candidate taxonomy, and manifest. | `eval/pr-packager.ts` -> `eval/out/pr-packages/<hash>/` | Deterministic bundle; version pinned | Missing fixture fails |
| **Apply + Verify** (Phase 12.4) -- Copies proposed taxonomy to fixture and guides human through verification. | `eval/apply-pr-package.ts` | Dirty tree check; human reviews | Force overwrites without review |
| **UX Safety Layer** (Phase 13) -- Report and vigilance APIs that surface verdicts to users. Read-only over stored data. | Report, vigilance APIs | No inference writes | N/A |
| **Pressure Ranking** (Phase 15.3) -- Ranks terms contributing to vigilance pressure. Deterministic sort order enforced by tests. | `computeVigilance.ts` -> pressureSources | Sorted: weightedScore desc, count desc, term asc | Determinism test fails |

---

## 4. System Invariants (Golden Rules)

- Taxonomy children sorted alphabetically (`api/_lib/admin/prPackager/transforms.ts`)
- No `Date.now` in deterministic outputs; vigilance uses `getAgeBucket(hoursSince)` and accepts `nowIso` for testability
- Replay fixture candidate version must be pinned to match allowlist fingerprints
- Promotion requires replay PASS before merge
- No LLM output trusted without AJV schema validation; invalid output triggers safe fallback
- Inference engine (`checkRisk.ts`) never writes to DB
- Vigilance output deterministic within same ageBucket
- `pressureSources` sorted by: weightedScore desc, count desc, term asc

### Change Risk Classification

| Risk | Files/Patterns | Agent Authority | Required Gates |
|------|----------------|-----------------|----------------|
| CRITICAL | `api/_lib/inference/allergenTaxonomy.ts`, `api/_lib/inference/checkRisk.ts`, `eval/fixtures/replay/knowledge/candidate-taxonomy.json`, `eval/fixtures/replay/allowlist.json`, `eval/fixtures/replay/scenarios.json` | Stop and confirm with human | Full replay + all phase tests + human review |
| ELEVATED | `api/_lib/vigilance/computeVigilance.ts`, `api/_lib/extractFromTextHeuristic.ts`, `api/_lib/extractFromTextLLM.ts`, `api/_lib/report/buildCheckReport.ts`, `api/_lib/admin/prPackager/transforms.ts` | Proceed with full test suite | All phase tests must pass |
| STANDARD | `api/admin/unmapped.ts`, `api/_lib/admin/unmappedDiscovery.ts`, `api/admin/promotion-export.ts`, `api/_lib/admin/promotionExport.ts`, `eval/pr-packager.ts`, `eval/apply-pr-package.ts` | Proceed with relevant tests | Related phase tests |
| SAFE | `docs/`, comments, logging, `eval/VERIFY_PROMOTION.md` | Proceed freely | None required |

---

## 4A. Determinism Contract

Determinism is required because safety-critical users depend on reproducible verdicts. If the same profile and events produce different risk levels on different runs, the system cannot be trusted. Replay validation enforces this: it re-runs inference against fixture scenarios and expects identical results. Any non-determinism in the inference or vigilance path makes replay meaningless.

| Component | Deterministic? | Time Allowed? | Randomness Allowed? |
|-----------|----------------|---------------|---------------------|
| Inference (`checkRisk.ts`) | Yes, strictly | No | No |
| Replay (`replay-validate.ts`) | Yes, strictly | No | No |
| Vigilance (`computeVigilance.ts`) | Yes, within ageBucket | Bucketed only (`getAgeBucket`) | No |
| Extraction (heuristic) | Yes | Timestamp on output only | No |
| Extraction (LLM) | No (LLM is stochastic) | Yes | Yes, but output must pass AJV schema validation; invalid output triggers safe fallback |
| Persistence (`saveExtractionRun.ts`) | No (async DB) | Yes (DB timestamps) | UUID generation for check IDs |

---

## 5. Knowledge System

**Taxonomy versioning:** Format `10i.1` -> `10i.2` -> `10i.3`. Increment when taxonomy changes. Defined in `api/_lib/inference/allergenTaxonomy.ts` as `ALLERGEN_TAXONOMY_VERSION` and in `eval/fixtures/replay/knowledge/candidate-taxonomy.json` for replay.

**Registry:** `api/_lib/inference/functionalClasses.ts` defines `FUNCTIONAL_CLASS_REGISTRY`. Used for medication/supplement stacking and unmapped discovery. `api/_lib/knowledge/loadFunctionalRegistry.ts` loads it.

**Version flow:**

- `verdict.meta.taxonomyVersion` -- set by `checkRisk` from `ALLERGEN_TAXONOMY_VERSION`; persisted in `checks.verdict` JSONB.
- `vigilance.trigger.taxonomyVersion` -- read from stored verdict; reported in `api/vigilance` response.
- `replay candidate fixture` -- `eval/fixtures/replay/knowledge/candidate-taxonomy.json`; version must match allowlist fingerprints.

**Version mismatch fails replay gate:** `api/_lib/eval/replayDiff.ts` `evaluateGateFingerprinted` checks `candidateTaxonomyVersion` against each fingerprint. Mismatch produces failure.

---

## 5A. Knowledge Authority Hierarchy

| Role | Source of Truth | Purpose |
|------|----------------|---------|
| Runtime knowledge | `api/_lib/inference/allergenTaxonomy.ts` | Active taxonomy used by `checkRisk` for live verdicts |
| Replay baseline | `eval/fixtures/replay/knowledge/baseline-taxonomy.json` | Previous taxonomy version; replay compares baseline vs candidate |
| Replay candidate | `eval/fixtures/replay/knowledge/candidate-taxonomy.json` | Proposed taxonomy version; replay validates this before it becomes runtime |
| Proposed mutation | `eval/out/pr-packages/<hash>/proposed-taxonomy.json` | PR packager output; becomes candidate after apply |

Replay validation binds changes to a specific `candidateTaxonomyVersion`. Runtime version bump must follow successful replay.

Runtime knowledge and replay baseline must remain aligned through the governed promotion flow. Direct edits to runtime taxonomy without replay validation violate constitutional boundaries.

---

## 6. Replay Gate Authority Model

**What replay validates:** Compares baseline vs candidate taxonomy over fixture scenarios (`eval/fixtures/replay/scenarios.json`). For each scenario, computes baseline verdict and candidate verdict. Diff determines riskLevel changes, added/removed matches.

**Fingerprinted allowlist:** `eval/fixtures/replay/allowlist.json` contains a `fingerprints` array. Each entry: `scenarioId`, `expected.riskLevelFrom`, `expected.riskLevelTo`, `expected.addedMatches`, `expected.removedMatches`, `expected.candidateTaxonomyVersion`. Replay passes only if all expected changes match and no unexpected changes occur (strict mode).

**Why candidateTaxonomyVersion must match:** Fingerprints are tied to a specific taxonomy version. If the candidate version differs, the fingerprint expectations are invalid. Replay fails with `candidateTaxonomyVersion mismatch`.

**Why replay is the final authority:** No taxonomy change can be merged without replay passing. Replay is the constitutional safety court that blocks unsafe ontology mutations.

---

## 7. CLI Command Library (Operational Map)

| Command | Purpose | Safe? | Mutates Repo? | Mutates DB? |
|---------|---------|-------|---------------|-------------|
| `npm run test:phase-10i` | Taxonomy guardrails tests | Yes | No | No |
| `npm run test:phase-14_3a` | Advice snapshot regression (Phase 14.3A) | Yes | No | No |
| `npm run replay:validate:ci` | Replay gate (STRICT mode) | Yes | No | No |
| `npm run pr:pack` | Build PR package bundle | Yes | No (writes eval/out) | No |
| `npm run pr:apply` | Apply proposed taxonomy to fixture | Yes | Yes | No |
| `npm run test:phase-15_3_integration` | Vigilance pressureSources determinism | Yes | No | No |

### Failure Recovery Protocols

**If `test:phase-10i` fails:**
1. Read test output to identify which taxonomy assertion failed.
2. If children not sorted: check `api/_lib/admin/prPackager/transforms.ts` sort logic.
3. If missing parent or child: verify `api/_lib/inference/allergenTaxonomy.ts` has the expected entries.
4. Fix the taxonomy definition. Re-run. If fails again with a different error, escalate to human.

**If `replay:validate:ci` fails:**
1. Read `eval/out/replay-diff.json` for scenario-level diffs.
2. If `candidateTaxonomyVersion mismatch`: update `eval/fixtures/replay/knowledge/candidate-taxonomy.json` version field to match expected version.
3. If unexpected riskLevel change: either update `eval/fixtures/replay/allowlist.json` fingerprints (if change is intentional) or revert the taxonomy change.
4. If new scenario has no fingerprint (strict mode): add a fingerprint entry to `allowlist.json`.
5. Re-run. If fails twice with different approaches, escalate to human with `replay-diff.json`.

**If `pr:pack` fails:**
1. If "Cannot determine expected replay candidate version": fixture `eval/fixtures/replay/knowledge/candidate-taxonomy.json` is missing. Restore it or use `--replayCandidateVersion=<version>`.
2. If "Taxonomy term not in promotion proposals": the `--selectTaxonomy` term is not in the export file. Verify export contains the term.
3. If "Parent not found": the `--parent` key does not exist in the current taxonomy. Check `allergenTaxonomy.ts`.
4. If replay fails within pack (with `--runReplay`): see replay recovery above.

**If `pr:apply` fails:**
1. If "Bundle folder missing": verify `--bundleId` matches a directory in `eval/out/pr-packages/`.
2. If "Working tree is dirty": commit or stash changes, or use `--force` if intentional.
3. If "patches missing" or "proposed-taxonomy.json missing": bundle is incomplete. Re-run `pr:pack` to regenerate.

---

## 8. Operational Promotion Checklist

1. Run unmapped discovery: `GET /api/admin/unmapped?profileId=...`
2. Run promotion export: `POST /api/admin/promotion-export` with `profileId`, `windowHours`, `limit`.
3. Save export to file (e.g. `promo-export.json`).
4. Run PR packager: `npm run pr:pack -- --export=promo-export.json --selectTaxonomy=<term> --parent=<parent> --mode=crossReactive --bumpTaxonomyVersionTo=<version> --runReplay --strict`
5. Review `eval/out/pr-packages/<hash>/PACKAGER.md` and `patches/*.diff`.
6. Apply: `npm run pr:apply -- --bundleId=<hash>`
7. Update `api/_lib/inference/allergenTaxonomy.ts` (ALLERGEN_TAXONOMY_VERSION, taxonomy, CROSS_REACTIVE_REGISTRY).
8. Run unit tests: `npm run test:phase-10i`, `npm run test:phase-13`, `npm run test:phase-14_3a`, `npm run test:phase-15_3_integration`
9. Run replay gate: `npm run replay:validate:ci`
10. Run real check + vigilance verification (see `eval/VERIFY_PROMOTION.md`).

### Worked Example: Adding "Mango" as Cross-Reactive to Tree Nuts

**Scenario:** Discovery radar found users reporting mango reactions who have tree nut allergies. Research confirms latex-fruit syndrome cross-reactivity.

**1. Discovery** (already done): `GET /api/admin/unmapped?profileId=abc123` returned `mango` in candidates.

**2. Export:**
```bash
curl -X POST http://localhost:3000/api/admin/promotion-export \
  -H "Content-Type: application/json" \
  -d '{"profileId":"abc123","windowHours":720,"limit":50}' > promo-export.json
```

**3. Package:**
```bash
npm run pr:pack -- \
  --export=promo-export.json \
  --selectTaxonomy=mango \
  --parent=tree_nut \
  --mode=crossReactive \
  --bumpTaxonomyVersionTo=10i.3 \
  --runReplay --strict
```

**4. Review:** Open `eval/out/pr-packages/<hash>/PACKAGER.md`. Verify `mango` appears under `tree_nut` cross-reactive. Confirm replay shows `PASSED`.

**5. Apply:** `npm run pr:apply -- --bundleId=<hash>`

**6. Verify:**
```bash
npm run test:phase-10i
npm run replay:validate:ci
```

**What success looks like:** `taxonomyVersion` in verdict matches `10i.3`. When a tree-nut-allergic profile encounters mango, verdict shows `riskLevel: "medium"` with `matched` containing mango. No regression in existing scenarios.

---

## 9. Extension Protocol (For Future Agents)

**Before coding:**
1. Read Sections 0-1 (Domain Primer + Philosophy).
2. Confirm invariants (Section 4) and check Risk Classification.
3. Confirm determinism (no `Date.now` in deterministic outputs; stable sort order).
4. Confirm replay impact (if taxonomy changes, replay fixtures and allowlist must be updated).

**If change touches taxonomy:** Must update replay fixtures, update allowlist fingerprints if riskLevel changes expected, re-run `npm run replay:validate:ci`.

**If change touches vigilance:** Must confirm `pressureSources` sort order, run `npm run test:phase-15_3_integration`.

**If change touches extraction:** LLM path must validate against schema; invalid output must trigger safe fallback. Heuristic path remains deterministic.

---

## 10. Anti-Patterns: What NOT To Do

**1. Direct Taxonomy Editing**
- DO NOT: Edit `allergenTaxonomy.ts` directly to add new allergen terms.
- DO: Use the full promotion flow (discovery -> export -> PR packager -> replay -> apply).
- CONSEQUENCE: Direct edits bypass replay validation. Untested taxonomy changes can produce wrong risk verdicts for real users.

**2. Trusting LLM Extraction Output**
- DO NOT: Pass LLM-extracted health events directly to inference without validation.
- DO: Always validate against AJV schema; trigger safe fallback on validation failure.
- CONSEQUENCE: Malformed events can crash inference or produce undefined behavior in `checkRisk`.

**3. Writing to DB During Inference**
- DO NOT: Add database writes inside `checkRisk.ts` or any inference module.
- DO: Keep inference pure. Persistence happens only in `saveExtractionRun.ts` after extraction.
- CONSEQUENCE: DB writes in inference break determinism, make replay impossible, and create side effects during read-only operations.

**4. Using Date.now in Deterministic Outputs**
- DO NOT: Use `Date.now()`, `new Date()`, or wall-clock time in inference, vigilance scoring, or replay outputs.
- DO: Accept time as a parameter (e.g., `nowIso`) and use deterministic buckets (`getAgeBucket`).
- CONSEQUENCE: Time-dependent outputs make tests flaky and break replay determinism.

**5. Skipping Replay After Taxonomy Changes**
- DO NOT: Merge taxonomy changes without running `npm run replay:validate:ci`.
- DO: Always run replay gate before merging. If replay fails, fix before proceeding.
- CONSEQUENCE: Unvalidated taxonomy changes may silently alter risk verdicts for existing scenarios.

**6. Adding Unsorted Children or Cross-Reactive Terms**
- DO NOT: Append terms to taxonomy arrays without sorting.
- DO: Use `applyTaxonomyEdits` in `transforms.ts` which enforces alphabetical sort.
- CONSEQUENCE: Unsorted arrays break determinism tests and make diffs noisy.

**7. Modifying Allowlist Without Understanding Fingerprints**
- DO NOT: Delete or edit allowlist entries to "make replay pass" without understanding what changed.
- DO: Read `eval/out/replay-diff.json`, understand the actual risk change, then update fingerprints to match.
- CONSEQUENCE: Blindly editing the allowlist defeats the purpose of the safety gate. Real risk changes get silently approved.

**8. Architectural Overreach**
- DO NOT: Introduce probabilistic or ML-based risk scoring directly into inference.
- DO: Keep inference rule-based and deterministic. Experimental scoring must live in a separate advisory layer and never override deterministic verdicts.
- CONSEQUENCE: Violates replay authority and breaks reproducibility guarantees for safety-critical users.

---

## 11. Agent Operating Protocol

**Before Starting Any Task:**
1. Re-read Sections 0-1 (Domain Primer + Philosophy).
2. Identify which subsystem(s) the task touches.
3. Check Risk Classification (Section 4) for those files.
4. Confirm which test commands apply.

**When to Stop and Ask:**
- Replay fails twice with different attempted fixes.
- Task requires touching CRITICAL files (taxonomy, inference, replay fixtures).
- Uncertain which taxonomy parent a new term belongs under (present options instead).
- Feature request seems to conflict with a Golden Rule (Section 4).

**When to Proceed Autonomously:**
- All relevant tests pass.
- Change touches only STANDARD or SAFE files.
- Clear precedent exists in codebase.
- Task is explicitly scoped in the prompt.

---

## 12. Feature Development Guide

**When you receive a feature prompt, follow this sequence:**

1. **Locate**: Which subsystem does this feature belong to?
   - User-facing data capture -> Extraction (`api/_lib/extractFromText*.ts`)
   - Risk evaluation logic -> Inference (`api/_lib/inference/checkRisk.ts`)
   - User-facing risk display -> Report/Vigilance (`api/report/`, `api/vigilance.ts`)
   - System learning -> Discovery/Promotion (`api/admin/`, `eval/pr-packager.ts`)

2. **Assess**: Does this feature require new knowledge (taxonomy/registry changes)?
   - If YES -> Full promotion flow required; cannot ship in a single change.
   - If NO -> Standard development, test, merge.

3. **Design within constraints:**
   - Can inference remain pure (no DB writes)? Must be yes.
   - Can output remain deterministic? Must be yes for inference/vigilance.
   - Does it require new LLM capability? Schema validation required.

4. **Prototype -> Test -> Gate:**
   - Build feature.
   - Add/update relevant phase tests.
   - Run full test suite.
   - If taxonomy touched -> run replay gate.

**Features that are IN BOUNDS:**
- New extraction heuristics (with schema validation)
- New report views (read-only)
- New vigilance calculations (deterministic, testable)
- New admin discovery queries (read-only)
- UX improvements to existing flows

**Features that require human discussion:**
- Changes to core inference logic (`checkRisk.ts`)
- New data persistence patterns
- Changes to the promotion flow itself
- Anything that would make inference non-deterministic

---

## 12A. Glossary

| Term | Definition |
|------|------------|
| **Health Event** | A structured record extracted from user input. Types: meal, medication, supplement, symptom. Each has fields, confidence, and provenance. |
| **Risk Verdict** | The output of `checkRisk`: a riskLevel (`none`, `medium`, `high`), reasoning string, matched rules, and meta (taxonomyVersion, severity). Deterministic for the same inputs. |
| **Cross-Reactive** | An association where an allergen in one category triggers a reaction related to another. Example: mango (fruit) cross-reacts with tree nuts via latex-fruit syndrome. Produces `medium` risk, not `high`. |
| **Taxonomy** | Versioned knowledge graph in `allergenTaxonomy.ts`. Maps parent allergen categories (e.g., `tree_nut`) to children (e.g., `cashew`, `pistachio`) and cross-reactive terms. |
| **Registry** | `FUNCTIONAL_CLASS_REGISTRY` in `functionalClasses.ts`. Maps medication/supplement names to functional classes for stacking detection and unmapped discovery. |
| **Replay Gate** | Deterministic regression test (`replay-validate.ts`) that compares baseline vs candidate taxonomy over fixture scenarios. Must pass before any taxonomy change is merged. |
| **Fingerprint (Allowlist)** | An entry in `allowlist.json` that declares an expected replay diff: which scenario, what risk change, which matches added/removed, and which taxonomy version. Makes expected changes explicit and auditable. |
| **Candidate Taxonomy** | The proposed next version of the taxonomy, stored at `eval/fixtures/replay/knowledge/candidate-taxonomy.json`. Replay validates this before it becomes the runtime taxonomy. |
| **Baseline Taxonomy** | The current (pre-change) taxonomy version stored at `eval/fixtures/replay/knowledge/baseline-taxonomy.json`. Replay compares candidate against this to detect regressions. |
| **Pressure Source** | A term contributing to vigilance pressure. Ranked by `weightedScore desc`, `count desc`, `term asc`. Tells caregivers which allergens are driving cumulative risk. |

---

## File Reference (Repo-Grounded)

| Component | Path |
|-----------|------|
| Extraction API | `api/extract.ts` |
| Extraction router | `api/_lib/extractFromText.ts` |
| LLM extraction | `api/_lib/extractFromTextLLM.ts` |
| Heuristic extraction | `api/_lib/extractFromTextHeuristic.ts` |
| Schemas | `docs/contracts/health-event.schema.json`, `extraction-response.schema.json` |
| Persistence | `api/_lib/persistence/saveExtractionRun.ts` |
| Inference engine | `api/_lib/inference/checkRisk.ts` |
| Taxonomy | `api/_lib/inference/allergenTaxonomy.ts` |
| Report builder | `api/_lib/report/buildCheckReport.ts` |
| Report API | `api/report/check/index.ts` |
| Vigilance | `api/vigilance.ts`, `api/_lib/vigilance/computeVigilance.ts` |
| Unmapped discovery | `api/admin/unmapped.ts`, `api/_lib/admin/unmappedDiscovery.ts` |
| Promotion export | `api/admin/promotion-export.ts`, `api/_lib/admin/promotionExport.ts` |
| Replay | `eval/replay-validate.ts`, `api/_lib/eval/replayDiff.ts` |
| PR packager | `eval/pr-packager.ts`, `api/_lib/admin/prPackager/index.ts` |
| Apply | `eval/apply-pr-package.ts` |
| Replay fixtures | `eval/fixtures/replay/knowledge/`, `scenarios.json`, `allowlist.json` |
| Verification runbook | `eval/VERIFY_PROMOTION.md` |
