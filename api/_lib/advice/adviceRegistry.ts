/**
 * Phase 14.1 – Actionable Advice Registry (Deterministic)
 *
 * Pure data layer for actionable guidance alongside risk detection.
 * Term advice overrides parent advice. No LLM, no DB, no schema changes.
 * Does NOT affect inference, vigilance score, or replay gate.
 */

// ── Version ──────────────────────────────────────────────────────────

/** Micro-version stamp for advice layer. Bump when registry changes. */
export const ADVICE_REGISTRY_VERSION = "14a.1";

/** Phase 14.2: Fallback when match exists but no registry advice. Deterministic. */
export const GENERAL_SAFETY_FALLBACK: AdviceEntry = {
  id: "fallback:general_safety",
  level: "parent",
  target: "general",
  title: "General Safety",
  symptomsToWatch: [
    "Hives, itching, or swelling",
    "Tingling in mouth or throat",
    "Difficulty breathing or wheezing",
    "Stomach upset or vomiting",
  ],
  immediateActions: [
    "Stop eating immediately",
    "Rinse mouth with water",
    "Use epinephrine auto-injector if prescribed",
    "Seek emergency care for severe symptoms",
  ],
  education: [
    "When in doubt, avoid the food until you can confirm with your allergist.",
    "Check labels and ask about ingredients when dining out.",
  ],
  disclaimers: [
    "If trouble breathing, seek emergency care immediately.",
    "Standard guidance only. Consult a professional in emergencies.",
  ],
};

// ── Types ────────────────────────────────────────────────────────────

export type AdviceEntry = {
  id: string; // stable unique key, e.g. "term:mango" or "parent:tree_nut"
  level: "term" | "parent";
  target: string; // "mango" OR "tree_nut"
  title: string; // short label
  symptomsToWatch: string[];
  immediateActions: string[];
  education: string[];
  disclaimers: string[]; // e.g. "If trouble breathing, seek emergency care."
};

// ── Registry (pure deterministic data) ───────────────────────────────

export const ADVICE_REGISTRY: Record<string, AdviceEntry> = {
  // ── Parent-level advice ─────────────────────────────────────────────

  "parent:tree_nut": {
    id: "parent:tree_nut",
    level: "parent",
    target: "tree_nut",
    title: "Tree Nut Allergy",
    symptomsToWatch: [
      "Hives, itching, or swelling",
      "Tingling in mouth or throat",
      "Stomach pain, nausea, or vomiting",
      "Difficulty breathing or wheezing",
      "Dizziness or lightheadedness",
    ],
    immediateActions: [
      "Stop eating immediately",
      "Rinse mouth with water",
      "Use epinephrine auto-injector if prescribed",
      "Call 911 if severe symptoms develop",
    ],
    education: [
      "Tree nuts include almond, walnut, cashew, pistachio, pecan, hazelnut, Brazil nut, pine nut, macadamia.",
      "Check labels for \"may contain\" or \"processed in facility with tree nuts.\"",
      "Cross-contamination is common in bakeries and ice cream shops.",
    ],
    disclaimers: [
      "If trouble breathing, seek emergency care immediately.",
      "This is general guidance, not medical advice. Follow your allergist's plan.",
    ],
  },

  "parent:shellfish": {
    id: "parent:shellfish",
    level: "parent",
    target: "shellfish",
    title: "Shellfish Allergy",
    symptomsToWatch: [
      "Hives or skin rash",
      "Swelling of lips, face, or throat",
      "Stomach cramps or diarrhea",
      "Wheezing or difficulty breathing",
      "Anaphylaxis (severe allergic reaction)",
    ],
    immediateActions: [
      "Stop eating immediately",
      "Use epinephrine auto-injector if prescribed",
      "Seek emergency care for severe reactions",
      "Antihistamines may help mild symptoms only",
    ],
    education: [
      "Shellfish includes shrimp, crab, lobster, scallop, oyster, mussel.",
      "Crustaceans (shrimp, crab, lobster) and mollusks (scallop, oyster, mussel) may differ in reactivity.",
      "Avoid fish sauce, surimi, and some Asian sauces that may contain shellfish.",
    ],
    disclaimers: [
      "If trouble breathing, seek emergency care immediately.",
      "This is general guidance, not medical advice. Follow your allergist's plan.",
    ],
  },

  "parent:peanut": {
    id: "parent:peanut",
    level: "parent",
    target: "peanut",
    title: "Peanut Allergy",
    symptomsToWatch: [
      "Skin reactions (hives, redness, swelling)",
      "Itching or tingling in mouth",
      "Digestive upset",
      "Shortness of breath or throat tightness",
      "Anaphylaxis",
    ],
    immediateActions: [
      "Stop eating immediately",
      "Use epinephrine auto-injector if prescribed",
      "Call 911 for severe reactions",
      "Stay calm; lying flat can worsen blood pressure drop",
    ],
    education: [
      "Peanuts are legumes, not tree nuts. Many people allergic to peanuts can safely eat tree nuts.",
      "Cross-contamination is common. Avoid shared equipment and bulk bins.",
      "Peanut oil (refined) may be tolerated by some; cold-pressed or gourmet oils may contain protein.",
    ],
    disclaimers: [
      "If trouble breathing, seek emergency care immediately.",
      "This is general guidance, not medical advice. Follow your allergist's plan.",
    ],
  },

  "parent:fish": {
    id: "parent:fish",
    level: "parent",
    target: "fish",
    title: "Fish Allergy",
    symptomsToWatch: [
      "Hives or eczema flare",
      "Swelling of lips or face",
      "Nausea, vomiting, or diarrhea",
      "Wheezing or difficulty breathing",
      "Anaphylaxis",
    ],
    immediateActions: [
      "Stop eating immediately",
      "Use epinephrine auto-injector if prescribed",
      "Seek emergency care for severe reactions",
    ],
    education: [
      "Fish allergy is distinct from shellfish allergy. Some people are allergic to one or both.",
      "Fish can be hidden in Worcestershire sauce, Caesar dressing, and some Asian dishes.",
      "Fish gelatin and fish oil supplements may contain fish protein.",
    ],
    disclaimers: [
      "If trouble breathing, seek emergency care immediately.",
      "This is general guidance, not medical advice. Follow your allergist's plan.",
    ],
  },

  "parent:sesame": {
    id: "parent:sesame",
    level: "parent",
    target: "sesame",
    title: "Sesame Allergy",
    symptomsToWatch: [
      "Hives or rash",
      "Swelling of face or throat",
      "Stomach pain or vomiting",
      "Wheezing or difficulty breathing",
      "Anaphylaxis",
    ],
    immediateActions: [
      "Stop eating immediately",
      "Use epinephrine auto-injector if prescribed",
      "Seek emergency care for severe reactions",
    ],
    education: [
      "Sesame is now a major allergen requiring labeling in the US.",
      "Found in tahini, hummus, bagels, crackers, and many ethnic cuisines.",
      "Sesame oil (especially toasted) can contain protein and trigger reactions.",
    ],
    disclaimers: [
      "If trouble breathing, seek emergency care immediately.",
      "This is general guidance, not medical advice. Follow your allergist's plan.",
    ],
  },

  // ── Term-level advice (overrides parent when matched) ─────────────────

  "term:mango": {
    id: "term:mango",
    level: "term",
    target: "mango",
    title: "Mango (Cross-Reactive with Latex/Tree Nut)",
    symptomsToWatch: [
      "Itching or tingling in mouth (OAS)",
      "Hives or rash, especially around mouth",
      "Swelling of lips or throat",
      "Stomach upset",
    ],
    immediateActions: [
      "Stop eating immediately",
      "Rinse mouth with water",
      "Use epinephrine if prescribed and symptoms are severe",
    ],
    education: [
      "Mango can cross-react with latex or certain tree nuts due to similar proteins.",
      "Oral allergy syndrome (OAS) may cause mild mouth itching without full anaphylaxis.",
      "Peeling mango may reduce contact with allergenic compounds in the skin.",
    ],
    disclaimers: [
      "If trouble breathing, seek emergency care immediately.",
      "This is general guidance, not medical advice. Follow your allergist's plan.",
    ],
  },

  "term:almond": {
    id: "term:almond",
    level: "term",
    target: "almond",
    title: "Almond Allergy",
    symptomsToWatch: [
      "Hives, itching, or swelling",
      "Tingling in mouth or throat",
      "Stomach pain or vomiting",
      "Difficulty breathing",
    ],
    immediateActions: [
      "Stop eating immediately",
      "Rinse mouth with water",
      "Use epinephrine auto-injector if prescribed",
      "Call 911 if severe symptoms develop",
    ],
    education: [
      "Almond is a tree nut. Almond milk, marzipan, and many baked goods contain almond.",
      "Almond extract and almond oil may contain protein; check with your allergist.",
      "Cross-contamination is common in nut-free facilities that also process almonds.",
    ],
    disclaimers: [
      "If trouble breathing, seek emergency care immediately.",
      "This is general guidance, not medical advice. Follow your allergist's plan.",
    ],
  },
};

// ── Resolver (Phase 14.1: term overrides parent) ────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export type MatchedForAdvice = {
  matchedTerm: string;
  matchedCategory?: string;
};

/**
 * Resolve advice for matched terms. Deterministic.
 * 1) If matched term has advice → use term advice.
 * 2) Else if matchedCategory has advice → use parent advice.
 * 3) Else → no advice for that match.
 * Deduplicates by id and sorts: term before parent, then alphabetical by target.
 */
export function resolveAdviceForMatched(
  matched: MatchedForAdvice[],
  getParentForTerm?: (term: string) => string | null
): AdviceEntry[] {
  const seen = new Set<string>();
  const out: AdviceEntry[] = [];

  for (const m of matched) {
    const term = normalize(m.matchedTerm);
    const category = m.matchedCategory ?? getParentForTerm?.(term) ?? null;

    const termEntry = term ? ADVICE_REGISTRY[`term:${term}`] : undefined;
    if (termEntry && !seen.has(termEntry.id)) {
      seen.add(termEntry.id);
      out.push(termEntry);
      continue;
    }

    const parentEntry = category ? ADVICE_REGISTRY[`parent:${category}`] : undefined;
    if (parentEntry && !seen.has(parentEntry.id)) {
      seen.add(parentEntry.id);
      out.push(parentEntry);
    }
  }

  out.sort((a, b) => {
    const levelCmp = (a.level === "term" ? 0 : 1) - (b.level === "term" ? 0 : 1);
    if (levelCmp !== 0) return levelCmp;
    return a.target.localeCompare(b.target);
  });

  return out;
}
