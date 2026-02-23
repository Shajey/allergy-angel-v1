/**
 * Phase 12.3 – PR Packager Unit Tests
 *
 * Tests pure transform functions for taxonomy and registry.
 * - mango added to crossReactive under tree_nut
 * - alphabetical sorting preserved
 * - no duplicates
 * - determinism (same input → same JSON)
 * - registry additions appended deterministically and sorted
 */

import { loadAllergenTaxonomy } from "../api/_lib/knowledge/loadAllergenTaxonomy.js";
import { loadFunctionalRegistry } from "../api/_lib/knowledge/loadFunctionalRegistry.js";
import {
  applyTaxonomyEdits,
  applyRegistryEdits,
  type TaxonomyEditMode,
} from "../api/_lib/admin/prPackager/transforms.js";
import {
  buildPRPackagerOutput,
  validatePRPackagerInput,
  computeBundleHash,
  type PRPackagerInput,
} from "../api/_lib/admin/prPackager/index.js";

const profileId = "a0000000-0000-0000-0000-000000000001";

const mockPromotion = {
  meta: {
    exportVersion: "v0-promo-12.1",
    generatedAt: new Date().toISOString(),
    profileId,
    windowHours: 168,
    limit: 20,
    candidateCount: 5,
    taxonomyVersion: "10i.3",
    registryVersion: null,
  },
  candidates: [
    { candidate: "mango", kind: "meal_token" as const, count: 1, highRiskCount: 0, riskRate: 0, firstSeenAt: "", lastSeenAt: "", examples: [], sources: {} },
    { candidate: "tiger nut", kind: "meal_token" as const, count: 1, highRiskCount: 0, riskRate: 0, firstSeenAt: "", lastSeenAt: "", examples: [], sources: {} },
    { candidate: "tylenol", kind: "medication" as const, count: 1, highRiskCount: 0, riskRate: 0, firstSeenAt: "", lastSeenAt: "", examples: [], sources: {} },
  ],
  proposals: {
    taxonomyAdditions: [
      { term: "mango", suggestedParent: "tree_nut", confidence: "blank" as const, evidence: { highRiskCount: 0, count: 1, riskRate: 0, examples: [] }, notes: "" },
      { term: "tiger nut", suggestedParent: "tree_nut", confidence: "blank" as const, evidence: { highRiskCount: 0, count: 1, riskRate: 0, examples: [] }, notes: "" },
    ],
    registryAdditions: [
      { name: "tylenol", kind: "medication" as const, suggestedFunctionClass: null, confidence: "blank" as const, evidence: { highRiskCount: 0, count: 1, riskRate: 0, examples: [] }, notes: "" },
    ],
  },
};

function runTests(): void {
  let passed = 0;
  let failed = 0;

  const currentTaxonomy = loadAllergenTaxonomy();
  const currentRegistry = loadFunctionalRegistry();

  // ── 1) mango added to crossReactive under tree_nut ────────────────────
  const r1 = applyTaxonomyEdits({
    currentTaxonomy,
    terms: ["mango"],
    mode: "crossReactive",
    parent: "tree_nut",
    newVersion: "10i.3",
  });
  const treeNutCr = r1.crossReactive.find((cr) => cr.source === "tree_nut");
  if (!treeNutCr) {
    failed++;
    console.error("✗ tree_nut crossReactive entry not found");
  } else if (!treeNutCr.related.includes("mango")) {
    failed++;
    console.error(`✗ mango not in tree_nut.crossReactive; got ${JSON.stringify(treeNutCr.related)}`);
  } else {
    passed++;
    console.log("✓ mango added to crossReactive under tree_nut");
  }

  // ── 2) alphabetical sorting preserved ────────────────────────────────
  const r2 = applyTaxonomyEdits({
    currentTaxonomy,
    terms: ["zebra nut", "almond"],
    mode: "child",
    parent: "tree_nut",
  });
  const treeNutEntry = r2.taxonomy.tree_nut;
  if (!treeNutEntry) {
    failed++;
    console.error("✗ tree_nut taxonomy entry not found");
  } else {
    const children = treeNutEntry.children;
    const idxA = children.indexOf("almond");
    const idxZ = children.indexOf("zebra nut");
    if (idxA === -1 || idxZ === -1) {
      failed++;
      console.error("✗ terms not added");
    } else if (idxA >= idxZ) {
      failed++;
      console.error(`✗ children not sorted; almond at ${idxA}, zebra nut at ${idxZ}`);
    } else {
      passed++;
      console.log("✓ alphabetical sorting preserved");
    }
  }

  // ── 3) no duplicates ──────────────────────────────────────────────────
  const r3 = applyTaxonomyEdits({
    currentTaxonomy,
    terms: ["mango", "mango", "Mango"],
    mode: "crossReactive",
    parent: "tree_nut",
  });
  const cr3 = r3.crossReactive.find((c) => c.source === "tree_nut");
  const mangoCount = cr3?.related.filter((t) => t.toLowerCase() === "mango").length ?? 0;
  if (mangoCount > 1) {
    failed++;
    console.error(`✗ duplicate mango; count=${mangoCount}`);
  } else {
    passed++;
    console.log("✓ no duplicates");
  }

  // ── 4) determinism (same input → same JSON) ───────────────────────────
  const input4 = {
    currentTaxonomy,
    terms: ["mango", "tiger nut"],
    mode: "crossReactive" as TaxonomyEditMode,
    parent: "tree_nut",
    newVersion: "10i.3",
  };
  const out4a = applyTaxonomyEdits(input4);
  const out4b = applyTaxonomyEdits(input4);
  const j4a = JSON.stringify(out4a);
  const j4b = JSON.stringify(out4b);
  if (j4a !== j4b) {
    failed++;
    console.error("✗ same input produced different output");
  } else {
    passed++;
    console.log("✓ determinism (same input → same JSON)");
  }

  // ── 5) registry additions appended deterministically and sorted ────────
  const r5 = applyRegistryEdits({
    currentRegistry,
    names: ["tylenol", "protein", "acetaminophen"],
  });
  const uncat = r5["_promoted"];
  if (!uncat) {
    failed++;
    console.error("✗ _promoted registry entry not found");
  } else {
    const terms = uncat.terms;
    const sorted = [...terms].sort((a, b) => a.localeCompare(b));
    if (JSON.stringify(terms) !== JSON.stringify(sorted)) {
      failed++;
      console.error(`✗ registry terms not sorted; got ${JSON.stringify(terms)}`);
    } else if (!terms.includes("tylenol") || !terms.includes("acetaminophen")) {
      failed++;
      console.error(`✗ registry terms missing; got ${JSON.stringify(terms)}`);
    } else {
      passed++;
      console.log("✓ registry additions appended and sorted");
    }
  }

  // ── 6) validatePRPackagerInput rejects unknown terms ──────────────────
  const badInput: PRPackagerInput = {
    promotion: mockPromotion as PRPackagerInput["promotion"],
    selection: { taxonomy: ["unknown_term"], registry: [] },
    taxonomyMode: "crossReactive",
    taxonomyParent: "tree_nut",
    currentTaxonomy,
    currentRegistry,
  };
  const errs = validatePRPackagerInput(badInput);
  if (errs.length === 0) {
    failed++;
    console.error("✗ should reject terms not in promotion");
  } else {
    passed++;
    console.log("✓ validatePRPackagerInput rejects unknown terms");
  }

  // ── 7) computeBundleHash deterministic ────────────────────────────────
  const goodInput: PRPackagerInput = {
    promotion: mockPromotion as PRPackagerInput["promotion"],
    selection: { taxonomy: ["mango"], registry: [] },
    taxonomyMode: "crossReactive",
    taxonomyParent: "tree_nut",
    currentTaxonomy,
    currentRegistry,
  };
  const h1 = computeBundleHash(goodInput);
  const h2 = computeBundleHash(goodInput);
  if (h1 !== h2) {
    failed++;
    console.error(`✗ bundle hash not deterministic: ${h1} vs ${h2}`);
  } else {
    passed++;
    console.log("✓ computeBundleHash deterministic");
  }

  // ── 8) buildPRPackagerOutput produces valid output ────────────────────
  const fullInput: PRPackagerInput = {
    promotion: mockPromotion as PRPackagerInput["promotion"],
    selection: { taxonomy: ["mango"], registry: ["tylenol"] },
    taxonomyMode: "crossReactive",
    taxonomyParent: "tree_nut",
    currentTaxonomy,
    currentRegistry,
    options: { bumpTaxonomyVersionTo: "10i.3" },
  };
  const out = buildPRPackagerOutput(fullInput);
  if (out.proposedTaxonomy.version !== "10i.3") {
    failed++;
    console.error(`✗ version not bumped; got ${out.proposedTaxonomy.version}`);
  } else if (!out.proposedTaxonomy.crossReactive.find((c) => c.source === "tree_nut")?.related.includes("mango")) {
    failed++;
    console.error("✗ mango not in proposed taxonomy");
  } else if (!out.proposedRegistry["_promoted"]?.terms.includes("tylenol")) {
    failed++;
    console.error("✗ tylenol not in proposed registry");
  } else {
    passed++;
    console.log("✓ buildPRPackagerOutput produces valid output");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
