/**
 * Phase 10H – Allergen Taxonomy Expansion (Deterministic)
 *
 * Deterministic ontological expansion layer. When a profile lists a parent
 * allergen category (e.g., "tree_nut"), the system matches child allergens
 * (e.g., "pistachio", "cashew") in meal events — even if the exact child
 * term is not listed in the profile.
 *
 * Phase 10H++ – Taxonomy versioning + severity weighting:
 *   - ALLERGEN_TAXONOMY_VERSION: micro-version stamp for debugging/auditing
 *   - ALLERGEN_SEVERITY: deterministic severity weights per category (0–100)
 *   - getAllergenSeverity(): returns severity for category, default 50 for unknown
 *
 * Phase 10I – Taxonomy coverage + maintenance:
 *   - Expanded parents: fish, sesame, egg, dairy, wheat, soy
 *   - normalizeToken(): lowercase, trim, collapse whitespace, strip punctuation
 *   - Multi-word tokens (egg white, soy sauce) supported via phrase matching
 *
 * Phase 10J – Cross-reactivity weighting:
 *   - CROSS_REACTIVE_REGISTRY: graded associations (source → related tokens)
 *   - getCrossReactiveMatch(): deterministic cross-reactive lookup
 *   - Surfaces medium risk (not high) with explainable reasoning
 *
 * Phase 12.6 – Linguistic Bridge (Aliases):
 *   - TaxonomyNode: id, parent?, aliases? (optional, deterministic, sorted)
 *   - CANONICAL_MAP: O(1) alias → canonical resolution at load time
 *   - No fuzzy logic in runtime. Aliases must be explicitly stored.
 *
 * Zero LLM. Zero embeddings. Auditable and reproducible.
 */

// ── Taxonomy version (10H++) ─────────────────────────────────────────
/** Micro-version stamp for verdict meta and insight scoring. Bump when taxonomy changes. */
export const ALLERGEN_TAXONOMY_VERSION = "10i.3";

// ── Phase 12.6: TaxonomyNode & Aliases ────────────────────────────────

/** Phase 12.6: Node shape for taxonomy. Aliases optional, deterministic, alphabetically sorted. */
export interface TaxonomyNode {
  id: string;
  parent?: string;
  aliases?: string[];
}

/**
 * Phase 12.6: Deterministic alias registry. Canonical id → sorted aliases.
 * Aliases must be lowercase, unique, alphabetically sorted before export.
 */
export const ALIASES: Record<string, string[]> = {
  mango: ["mangoes", "mangos"],
};

// ── Severity weights (10H+) ───────────────────────────────────────────
/** Deterministic severity per allergen category (0–100). Higher = higher risk. */
const ALLERGEN_SEVERITY: Record<string, number> = {
  tree_nut: 90,
  peanut: 95,
  shellfish: 95,
  fish: 90,
  egg: 85,
  dairy: 80,
  legume: 60,
  sesame: 85,
  wheat: 70,
  soy: 65,
};

/** Returns severity for category key; default 50 for unknown. Deterministic, no ML. */
export function getAllergenSeverity(categoryKey: string): number {
  const key = categoryKey.toLowerCase().trim();
  return ALLERGEN_SEVERITY[key] ?? 50;
}

// ── Types ────────────────────────────────────────────────────────────

export type AllergenParentKey =
  | "tree_nut"
  | "shellfish"
  | "legume"
  | "fish"
  | "sesame"
  | "egg"
  | "dairy"
  | "wheat"
  | "soy";

export const ALLERGEN_TAXONOMY: Record<
  AllergenParentKey,
  { label: string; children: string[] }
> = {
  tree_nut: {
    label: "Tree Nut",
    children: [
      "almond",
      "walnut",
      "cashew",
      "pistachio",
      "pecan",
      "hazelnut",
      "brazil nut",
      "pine nut",
      "macadamia",
    ],
  },
  shellfish: {
    label: "Shellfish",
    children: [
      "shrimp",
      "crab",
      "lobster",
      "scallop",
      "oyster",
      "mussel",
    ],
  },
  legume: {
    label: "Legume",
    children: ["peanut", "soy", "lentil", "chickpea", "pea"],
  },
  fish: {
    label: "Fish",
    children: [
      "salmon",
      "tuna",
      "cod",
      "tilapia",
      "haddock",
      "anchovy",
      "sardine",
    ],
  },
  sesame: {
    label: "Sesame",
    children: ["sesame", "tahini"],
  },
  egg: {
    label: "Egg",
    children: ["egg", "eggs", "egg white", "egg yolk"],
  },
  dairy: {
    label: "Dairy",
    children: ["milk", "cheese", "butter", "yogurt", "whey", "casein"],
  },
  wheat: {
    label: "Wheat",
    children: ["wheat", "flour", "bread", "pasta", "gluten"],
  },
  soy: {
    label: "Soy",
    children: [
      "soy",
      "soya",
      "soybean",
      "tofu",
      "edamame",
      "tempeh",
      "soy sauce",
    ],
  },
};

/** Phase 10I: parent pairs that share a child token. Guardrail tests enforce no other overlaps. */
export const ALLOWED_OVERLAPS: [string, string][] = [
  ["legume", "soy"],
];

// ── Phase 10J: Cross-Reactivity ────────────────────────────────────────

export type CrossReactiveRelation = {
  source: string;
  related: string[];
  riskModifier: number;
};

/** v10j.1 seed data. Deterministic cross-reactive associations. */
export const CROSS_REACTIVE_REGISTRY: CrossReactiveRelation[] = [
  { source: "tree_nut", related: ["coconut", "mango", "pink peppercorn"], riskModifier: 10 },
  { source: "latex", related: ["banana", "avocado", "kiwi"], riskModifier: 15 },
  { source: "birch_pollen", related: ["apple", "carrot"], riskModifier: 10 },
];

/**
 * Phase 10J: Check if ingestible contains a cross-reactive term for any user allergy.
 * Returns match info or null. Uses phrase-safe matching (reuses 10H normalization).
 */
export function getCrossReactiveMatch(
  userAllergies: string[],
  ingestibleName: string
): { source: string; matchedTerm: string; modifier: number } | null {
  const normalizedIngestible = stripPunctuation(normalizeToken(ingestibleName));
  if (!normalizedIngestible) return null;

  const userAllergySet = new Set(
    userAllergies.map((a) => normalizeToken(a).replace(/\s+/g, "_"))
  );

  for (const rel of CROSS_REACTIVE_REGISTRY) {
    const sourceNorm = rel.source.toLowerCase();
    const sourceMatches =
      userAllergySet.has(sourceNorm) ||
      userAllergySet.has(sourceNorm + "s") ||
      [...userAllergySet].some((u) => u.replace(/s$/, "") === sourceNorm);

    if (!sourceMatches) continue;

    const sorted = [...rel.related].sort((a, b) => b.length - a.length);
    for (const term of sorted) {
      const variants = getTermsForMatching(term);
      const isCanonical = (t: string) => normalizeToken(t) === normalizeToken(term);
      for (const variant of variants) {
        const regex = isCanonical(variant) ? buildTermRegex(variant) : buildExactTermRegex(variant);
        if (regex.test(normalizedIngestible)) {
          return {
            source: rel.source,
            matchedTerm: term,
            modifier: rel.riskModifier,
          };
        }
      }
    }
  }

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Phase 10I: Normalize a token for matching. Deterministic.
 * - lowercase, trim
 * - collapse internal whitespace to single space
 * - strip surrounding punctuation, quotes, parens
 */
export function normalizeToken(s: string): string {
  let t = s.toLowerCase().trim();
  t = t.replace(/\s+/g, " ");
  t = t.replace(/^['"(\[\{]+|['")\]\}]+$/g, "").trim();
  return t;
}

// ── Phase 12.6: Canonical map (built after normalizeToken) ─────────────

function collectAllCanonicalTerms(): Set<string> {
  const terms = new Set<string>();
  for (const entry of Object.values(ALLERGEN_TAXONOMY)) {
    for (const child of entry.children) {
      terms.add(normalizeToken(child));
    }
  }
  for (const rel of CROSS_REACTIVE_REGISTRY) {
    for (const term of rel.related) {
      terms.add(normalizeToken(term));
    }
  }
  return terms;
}

function buildCanonicalMap(): Map<string, string> {
  const map = new Map<string, string>();
  const canonicals = collectAllCanonicalTerms();
  for (const id of canonicals) {
    map.set(id, id);
  }
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    const canonNorm = canonical.toLowerCase().trim();
    if (!map.has(canonNorm)) map.set(canonNorm, canonNorm);
    for (const a of aliases) {
      const aNorm = a.toLowerCase().trim();
      if (aNorm && !map.has(aNorm)) map.set(aNorm, canonNorm);
    }
  }
  return map;
}

const CANONICAL_MAP = buildCanonicalMap();

/** Phase 12.6: Resolve token to canonical id via precompiled map. O(1). */
export function resolveToCanonical(token: string): string | undefined {
  const norm = normalizeToken(token);
  return CANONICAL_MAP.get(norm);
}

/** Phase 12.6: Get all match strings for a canonical (canonical + aliases). */
function getTermsForMatching(canonical: string): string[] {
  const canonNorm = canonical.toLowerCase().trim();
  const aliases = ALIASES[canonNorm] ?? [];
  return [canonNorm, ...aliases];
}

/** Escape regex special characters for use in \b...\b pattern. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalize simple plurals: almonds → almond, nuts → nut. */
function normalizePlural(s: string): string {
  const trimmed = s.toLowerCase().trim();
  if (trimmed.endsWith("s") && trimmed.length > 1) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

/** Strip punctuation from a string (replaces with space for phrase matching). */
function stripPunctuation(s: string): string {
  return s.replace(/[^\w\s]/g, " ");
}

/**
 * Build a word-boundary regex for a term, including simple plural form.
 * Matches both "almond" and "almonds", "brazil nut" and "brazil nuts".
 */
function buildTermRegex(term: string): RegExp {
  const escaped = escapeRegex(term);
  const plural = term.endsWith("s") ? term.slice(0, -1) : term + "s";
  const escapedPlural = escapeRegex(plural);
  const pattern = `\\b(${escaped}|${escapedPlural})\\b`;
  return new RegExp(pattern, "i");
}

/** Phase 12.6: Exact match only. No plural expansion. Prevents "mangoe" matching "mangoes". */
function buildExactTermRegex(term: string): RegExp {
  const escaped = escapeRegex(term);
  return new RegExp(`\\b${escaped}\\b`, "i");
}

/**
 * Check whether meal text contains any allergen from the expanded set.
 * Phase 12.6: For each canonical, matches canonical + aliases via getTermsForMatching.
 * Returns canonical id on match. O(1) resolution via precompiled map.
 * Does NOT match partial words (e.g., "nutritional" does NOT match "nut").
 */
export function isAllergenMatch(
  mealText: string,
  expandedAllergens: Set<string>
): { matched: boolean; matchedTerm?: string } {
  const normalized = stripPunctuation(normalizeToken(mealText));
  if (!normalized) {
    return { matched: false };
  }

  // Sort canonicals by max term length descending (multi-word first).
  const sorted = [...expandedAllergens].sort((a, b) => {
    const aMax = Math.max(a.length, ...(getTermsForMatching(a).map((t) => t.length)));
    const bMax = Math.max(b.length, ...(getTermsForMatching(b).map((t) => t.length)));
    return bMax - aMax;
  });

  for (const canonical of sorted) {
    const terms = getTermsForMatching(canonical);
    const isCanonical = (t: string) => normalizeToken(t) === normalizeToken(canonical);
    for (const term of terms) {
      const regex = isCanonical(term) ? buildTermRegex(term) : buildExactTermRegex(term);
      if (regex.test(normalized)) {
        return { matched: true, matchedTerm: canonical };
      }
    }
  }

  return { matched: false };
}

/**
 * Get the parent taxonomy key for a child term, if it belongs to one.
 * Phase 12.6: Resolves alias to canonical first. Also checks crossReactive related.
 */
export function getParentKeyForTerm(term: string): AllergenParentKey | null {
  const canonical = resolveToCanonical(term) ?? normalizeToken(term);
  for (const [key, entry] of Object.entries(ALLERGEN_TAXONOMY)) {
    if (entry.children.some((c) => normalizeToken(c) === canonical)) {
      return key as AllergenParentKey;
    }
  }
  for (const rel of CROSS_REACTIVE_REGISTRY) {
    if (rel.related.some((r) => normalizeToken(r) === canonical)) {
      return rel.source as AllergenParentKey;
    }
  }
  return null;
}

/**
 * Resolve the category key for severity lookup. Prefers explicit severity
 * map entry (e.g. peanut), else taxonomy parent (e.g. tree_nut for pistachio).
 * Phase 12.6: Resolves alias to canonical first.
 */
export function resolveCategoryForSeverity(matchedTerm: string): string {
  const canonical = resolveToCanonical(matchedTerm) ?? normalizeToken(matchedTerm);
  if (canonical in ALLERGEN_SEVERITY) return canonical;
  const parent = getParentKeyForTerm(matchedTerm);
  if (parent) return parent;
  return canonical;
}

/**
 * Expand profile allergies: parent keys (e.g., "tree_nut") become all
 * children; direct terms stay as-is. Runs per request, no caching.
 */
export function expandAllergies(profileAllergies: string[]): Set<string> {
  const expanded = new Set<string>();

  for (const allergy of profileAllergies) {
    const key = normalizeToken(allergy);
    const parent = key as AllergenParentKey;

    if (parent in ALLERGEN_TAXONOMY) {
      const entry = ALLERGEN_TAXONOMY[parent];
      for (const child of entry.children) {
        expanded.add(child);
      }
    } else {
      expanded.add(normalizePlural(key));
    }
  }

  return expanded;
}
