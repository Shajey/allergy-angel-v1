# Phase 6 – Extraction & Agent Boundary

**Status:** Planned  
**Depends on:**  
- `docs/MRD.md` (confidence philosophy & product intent)  
- `docs/Spec.md` (confidence types, gating rules)

---

## 1. Purpose

Phase 6 introduces a production-grade extraction layer that converts raw user input into structured, reviewable health events while maintaining a strict boundary between deterministic application code and probabilistic AI agents.

This phase explicitly **does not**:
- make medical claims
- replace clinician judgment
- create a medical record

Its goal is to **improve confidence through structure and provenance**, not certainty.

---

## 2. Core Principles

1. **Hard Agent Boundary**
   - The agent produces structured output only.
   - The agent never writes to the database.
   - The agent never decides product behavior.

2. **Provenance First**
   - Every extracted field must be traceable to source text.
   - Raw input is preserved indefinitely.

3. **Confidence is Explicit**
   - Confidence is attached per-field and per-event.
   - Confidence rules are defined in `MRD.md` and `Spec.md`.

4. **Deterministic App, Probabilistic Agent**
   - Validation, normalization, and persistence are deterministic.
   - Only extraction and ambiguity detection use an agent.

---

## 3. Extraction Unit: HealthEvent

All user input is interpreted as one or more `HealthEvent` objects.

### 3.1 Supported Event Types
- meal
- symptom
- medication
- supplement
- workout
- sleep
- glucose
- environment
- note (freeform)

### 3.2 HealthEvent (Conceptual Shape)

```ts
HealthEvent {
  id: string
  type: HealthEventType
  startTime?: ISODateTime
  endTime?: ISODateTime

  fields: {
    // event-specific structured fields
  }

  confidence: number // 0–1
  confidenceLevel: 'Low' | 'Medium' | 'High' // derived

  provenance: {
    sourceInputId: string
    sourceSpans: Array<{
      field: string
      startChar: number
      endChar: number
    }>
    modelVersion: string
    extractionVersion: string
  }

  needsClarification: boolean
}
