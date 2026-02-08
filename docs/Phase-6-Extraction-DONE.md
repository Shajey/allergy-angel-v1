# Phase 6 — Extraction DONE (Lock)
## Status
Phase 6 is locked as **DONE** as of: 2026-02-08
## What’s delivered
- Deterministic (heuristic) extraction path
- LLM extraction path
- Router selects path based on extraction mode
- Output contract is stable: { events[], followUpQuestions[], warnings[] }
- Multi-event extraction works (Meal + Med + Symptom)
- Post-processing: confidenceScore (0-100) added
- Schema Validation: AJV guardrails active in LLM path
