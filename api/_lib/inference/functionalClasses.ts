/**
 * Phase 10G – Functional Class Registry
 *
 * Deterministic metadata registry that maps ingestible names (medication,
 * supplement, brand, generic) to functional classes. Used by the
 * functional-stacking detector to identify redundant intake patterns.
 *
 * Design decisions:
 *   - Case-insensitive exact + alias matching (no fuzzy/ML).
 *   - Brand→generic aliases included (e.g., "advil" → nsaids).
 *   - Ashwagandha listed as herbal_hint, not pharma anticoagulant.
 *   - Registry is intentionally small & hand-curated for precision;
 *     extend via adding entries to FUNCTIONAL_CLASS_REGISTRY.
 */

// ── Types ────────────────────────────────────────────────────────────

export type FunctionalClassKey =
  | "anticoagulants"
  | "nsaids"
  | "proton_pump_inhibitors"
  | "stimulant_laxatives";

export interface FunctionalClassEntry {
  label: string;
  /** Lowercase terms (generic names, brand names, aliases) for matching. */
  terms: string[];
  /** Human-readable examples shown in insight descriptions. */
  examples: string[];
}

// ── Registry ─────────────────────────────────────────────────────────

export const FUNCTIONAL_CLASS_REGISTRY: Record<
  FunctionalClassKey,
  FunctionalClassEntry
> = {
  anticoagulants: {
    label: "Anticoagulant / Blood Thinner",
    terms: [
      "aspirin",
      "warfarin",
      "coumadin",
      "clopidogrel",
      "plavix",
      "apixaban",
      "eliquis",
      "rivaroxaban",
      "xarelto",
      "heparin",
      "enoxaparin",
      "lovenox",
      // herbal hint — flagged but not treated as pharma-grade
      "ashwagandha",
    ],
    examples: ["aspirin", "warfarin", "eliquis", "plavix"],
  },
  nsaids: {
    label: "NSAID",
    terms: [
      "ibuprofen",
      "advil",
      "motrin",
      "naproxen",
      "aleve",
      "celecoxib",
      "celebrex",
      "diclofenac",
      "voltaren",
      "meloxicam",
      "mobic",
      "indomethacin",
      "indocin",
    ],
    examples: ["ibuprofen", "naproxen", "advil", "aleve"],
  },
  proton_pump_inhibitors: {
    label: "Proton Pump Inhibitor",
    terms: [
      "omeprazole",
      "prilosec",
      "esomeprazole",
      "nexium",
      "lansoprazole",
      "prevacid",
      "pantoprazole",
      "protonix",
      "rabeprazole",
      "aciphex",
    ],
    examples: ["omeprazole", "nexium", "prilosec"],
  },
  stimulant_laxatives: {
    label: "Stimulant Laxative",
    terms: [
      "bisacodyl",
      "dulcolax",
      "sennosides",
      "senna",
      "senokot",
      "cascara",
    ],
    examples: ["bisacodyl", "senna", "dulcolax"],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Normalise an ingestible name for matching: lowercase, trim,
 * strip surrounding quotes/parentheses.
 */
export function normalizeTerm(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^["'(]+|["')]+$/g, "");
}

// Pre-build a reverse lookup: normalisedTerm → FunctionalClassKey[]
const _termIndex = new Map<string, FunctionalClassKey[]>();

for (const [key, entry] of Object.entries(FUNCTIONAL_CLASS_REGISTRY) as [
  FunctionalClassKey,
  FunctionalClassEntry,
][]) {
  for (const term of entry.terms) {
    const norm = normalizeTerm(term);
    const existing = _termIndex.get(norm);
    if (existing) {
      if (!existing.includes(key)) existing.push(key);
    } else {
      _termIndex.set(norm, [key]);
    }
  }
}

/**
 * Return all functional classes that match a given ingestible name.
 *
 * Matching strategy: exact match of the full normalised name against
 * every term in the registry. This is intentionally strict — no
 * substring or fuzzy matching — to avoid false positives.
 */
export function matchFunctionalClasses(name: string): FunctionalClassKey[] {
  const norm = normalizeTerm(name);
  return _termIndex.get(norm) ?? [];
}
