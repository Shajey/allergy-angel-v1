/**
 * Phase 12.3 – Promotion PR Packager (Pure, Deterministic)
 *
 * Given a promotion export JSON and a list of terms to promote,
 * produces a PR-ready bundle: proposed taxonomy edits, replay scenario
 * stubs, allowlist fingerprint stubs, and a markdown checklist.
 *
 * No I/O, no DB, no LLM. Pure functions only.
 */

import { createHash } from "crypto";
import type { LoadedTaxonomy } from "../knowledge/loadAllergenTaxonomy.js";

// ── Types ────────────────────────────────────────────────────────────

export type PromoMode = "crossReactive" | "child";

export interface PromoPackInput {
  exportJson: PromoExportShape;
  selectedTerms: string[];
  mode: PromoMode;
  parent: string;
  currentTaxonomy: LoadedTaxonomy;
}

export interface PromoExportShape {
  meta: {
    taxonomyVersion: string | null;
    [key: string]: unknown;
  };
  candidates: Array<{
    candidate: string;
    kind: string;
    count: number;
    highRiskCount: number;
    riskRate: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface PromoBundle {
  bundleId: string;
  proposedTaxonomy: LoadedTaxonomy;
  bumpedVersion: string;
  scenarioStubs: ScenarioStub[];
  allowlistFingerprints: AllowlistFingerprintStub[];
  checklist: string;
  filesChanged: string[];
}

export interface ScenarioStub {
  scenarioId: string;
  profile: {
    profileId: string;
    known_allergies: string[];
    current_medications: never[];
  };
  events: Array<{
    type: string;
    created_at: string;
    event_data: { meal: string };
  }>;
}

export interface AllowlistFingerprintStub {
  scenarioId: string;
  expected: {
    riskLevelFrom: string;
    riskLevelTo: string;
    addedMatches: string[];
    removedMatches: string[];
    candidateTaxonomyVersion: string;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Deterministic bundle ID from sorted inputs. */
export function computeBundleId(
  selectedTerms: string[],
  mode: PromoMode,
  parent: string,
  currentVersion: string
): string {
  const sorted = [...selectedTerms].sort((a, b) => a.localeCompare(b));
  const payload = `${sorted.join(",")}|${mode}|${parent}|${currentVersion}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 12);
}

/**
 * Bump a taxonomy version string's patch segment.
 * Pattern: "10i.2" → "10i.3", "10i.99" → "10i.100"
 */
export function bumpPatchVersion(version: string): string {
  const dotIdx = version.lastIndexOf(".");
  if (dotIdx === -1) return `${version}.1`;
  const prefix = version.slice(0, dotIdx);
  const patch = parseInt(version.slice(dotIdx + 1), 10);
  if (isNaN(patch)) return `${version}.1`;
  return `${prefix}.${patch + 1}`;
}

// ── Core logic ───────────────────────────────────────────────────────

export function validateInputs(input: PromoPackInput): string[] {
  const errors: string[] = [];

  if (!input.exportJson?.candidates || !Array.isArray(input.exportJson.candidates)) {
    errors.push("Export JSON missing or has invalid candidates array.");
  }

  if (input.selectedTerms.length === 0) {
    errors.push("No terms selected for promotion.");
  }

  const candidateValues = new Set(
    (input.exportJson?.candidates ?? []).map((c) => c.candidate.toLowerCase())
  );
  for (const term of input.selectedTerms) {
    if (!candidateValues.has(term.toLowerCase())) {
      errors.push(`Selected term "${term}" not found in export candidates.`);
    }
  }

  if (input.mode === "crossReactive" || input.mode === "child") {
    const parentExists =
      input.parent in input.currentTaxonomy.taxonomy ||
      input.currentTaxonomy.crossReactive.some((cr) => cr.source === input.parent);
    if (!parentExists) {
      errors.push(`Parent "${input.parent}" not found in taxonomy.`);
    }
  }

  return errors;
}

export function buildPromoBundle(input: PromoPackInput): PromoBundle {
  const { currentTaxonomy, selectedTerms, mode, parent } = input;
  const sortedTerms = [...selectedTerms].sort((a, b) => a.localeCompare(b));
  const bumpedVersion = bumpPatchVersion(currentTaxonomy.version);
  const bundleId = computeBundleId(sortedTerms, mode, parent, currentTaxonomy.version);

  const proposedTaxonomy = applyEdits(currentTaxonomy, sortedTerms, mode, parent, bumpedVersion);
  const scenarioStubs = buildScenarioStubs(sortedTerms, mode, parent);
  const allowlistFingerprints = buildAllowlistStubs(sortedTerms, mode, bumpedVersion);
  const filesChanged = buildFilesChanged(mode);
  const checklist = buildChecklist(sortedTerms, mode, parent, bumpedVersion, filesChanged);

  return {
    bundleId,
    proposedTaxonomy,
    bumpedVersion,
    scenarioStubs,
    allowlistFingerprints,
    checklist,
    filesChanged,
  };
}

function applyEdits(
  taxonomy: LoadedTaxonomy,
  terms: string[],
  mode: PromoMode,
  parent: string,
  newVersion: string
): LoadedTaxonomy {
  const result: LoadedTaxonomy = {
    version: newVersion,
    taxonomy: JSON.parse(JSON.stringify(taxonomy.taxonomy)),
    severity: { ...taxonomy.severity },
    crossReactive: taxonomy.crossReactive.map((cr) => ({
      ...cr,
      related: [...cr.related],
    })),
  };

  if (mode === "crossReactive") {
    let found = false;
    for (const cr of result.crossReactive) {
      if (cr.source === parent) {
        for (const term of terms) {
          if (!cr.related.includes(term)) {
            cr.related.push(term);
          }
        }
        cr.related.sort((a, b) => a.localeCompare(b));
        found = true;
        break;
      }
    }
    if (!found) {
      result.crossReactive.push({
        source: parent,
        related: [...terms].sort((a, b) => a.localeCompare(b)),
        riskModifier: 10,
      });
    }
  } else {
    const entry = result.taxonomy[parent];
    if (entry) {
      for (const term of terms) {
        if (!entry.children.includes(term)) {
          entry.children.push(term);
        }
      }
      entry.children.sort((a, b) => a.localeCompare(b));
    }
  }

  return result;
}

function buildScenarioStubs(
  terms: string[],
  mode: PromoMode,
  parent: string
): ScenarioStub[] {
  return terms.map((term) => ({
    scenarioId: `scn_${mode}_${term.replace(/\s+/g, "_")}`,
    profile: {
      profileId: "00000000-0000-0000-0000-000000000001",
      known_allergies: [parent],
      current_medications: [] as never[],
    },
    events: [
      {
        type: "meal",
        created_at: "2026-01-15T10:00:00.000Z",
        event_data: { meal: `${term} smoothie` },
      },
    ],
  }));
}

function buildAllowlistStubs(
  terms: string[],
  mode: PromoMode,
  bumpedVersion: string
): AllowlistFingerprintStub[] {
  const riskLevelTo = mode === "crossReactive" ? "medium" : "high";
  return terms.map((term) => ({
    scenarioId: `scn_${mode}_${term.replace(/\s+/g, "_")}`,
    expected: {
      riskLevelFrom: "none",
      riskLevelTo,
      addedMatches: [term],
      removedMatches: [],
      candidateTaxonomyVersion: bumpedVersion,
    },
  }));
}

function buildFilesChanged(mode: PromoMode): string[] {
  const files = [
    "api/_lib/inference/allergenTaxonomy.ts",
    "eval/fixtures/replay/knowledge/candidate-taxonomy.json",
    "eval/fixtures/replay/scenarios.json",
    "eval/fixtures/replay/allowlist.json",
  ];
  if (mode === "child") {
    files.push("eval/fixtures/replay/knowledge/baseline-taxonomy.json");
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function buildChecklist(
  terms: string[],
  mode: PromoMode,
  parent: string,
  bumpedVersion: string,
  filesChanged: string[]
): string {
  const termList = terms.map((t) => `\`${t}\``).join(", ");
  const lines: string[] = [
    `# Promotion PR Checklist`,
    ``,
    `## Summary`,
    `Promote ${termList} as **${mode}** under \`${parent}\`.`,
    `Taxonomy version: → \`${bumpedVersion}\``,
    ``,
    `## Files to update`,
    ...filesChanged.map((f) => `- [ ] \`${f}\``),
    ``,
    `## Steps`,
    `- [ ] Apply taxonomy edits (see proposed-taxonomy.json in bundle)`,
    `- [ ] Update ALLERGEN_TAXONOMY_VERSION to \`${bumpedVersion}\``,
    `- [ ] Add scenario stubs to \`eval/fixtures/replay/scenarios.json\``,
    `- [ ] Add fingerprint stubs to \`eval/fixtures/replay/allowlist.json\``,
    `- [ ] Update candidate taxonomy fixture version to \`${bumpedVersion}\``,
    ``,
    `## Validation commands`,
    "```bash",
    `npm run replay:validate:ci`,
    `npm run test:phase-11`,
    `npm run test:phase-12_1`,
    `npm run test:phase-12_2`,
    `npm run test:phase-12_3`,
    `npm run test:phase-13`,
    "```",
    ``,
    `## Manual verification`,
    `- [ ] Check UI vigilance banner for ${termList} + \`${parent}\` profile`,
    `- [ ] Verify \`GET /api/admin/unmapped\` no longer lists promoted terms`,
    `- [ ] Review replay-diff.json output for expected changes only`,
    ``,
  ];
  return lines.join("\n");
}
