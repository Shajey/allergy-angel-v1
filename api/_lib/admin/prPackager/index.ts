/**
 * Phase 12.3 – PR Packager (Deterministic)
 *
 * Produces a ready-to-commit patch bundle for taxonomy/registry updates.
 * Pure, deterministic. No DB writes.
 */

import { createHash } from "crypto";
import type { LoadedTaxonomy } from "../../knowledge/loadAllergenTaxonomy.js";
import type { LoadedRegistry } from "../../knowledge/loadFunctionalRegistry.js";
import type { PromotionExportResult } from "../promotionExport.js";
import { applyTaxonomyEdits, applyRegistryEdits, type TaxonomyEditMode } from "./transforms.js";

export interface PRPackagerInput {
  promotion: PromotionExportResult;
  selection: {
    taxonomy: string[];
    registry: string[];
  };
  taxonomyMode: TaxonomyEditMode;
  taxonomyParent: string;
  currentTaxonomy: LoadedTaxonomy;
  currentRegistry: LoadedRegistry;
  options?: {
    bumpTaxonomyVersionTo?: string;
    bumpRegistryVersionTo?: string;
  };
}

export interface PRPackagerOutput {
  bundleHash: string;
  proposedTaxonomy: LoadedTaxonomy;
  proposedRegistry: LoadedRegistry;
  manifest: PRPackagerManifest;
}

export interface PRPackagerManifest {
  inputs: {
    profileId: string;
    windowHours: number;
    taxonomySelection: string[];
    registrySelection: string[];
    taxonomyMode: string;
    taxonomyParent: string;
    bumpTaxonomyVersionTo?: string;
  };
  selectedTerms: string[];
  selectedRegistry: string[];
  outputPaths: string[];
  suggestedAllowlistScenarioIds: string[];
  pressureEvidenceNote: string;
}

const VERSION_REGEX = /^[a-zA-Z0-9]+\.[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)?$/;

export function validatePRPackagerInput(input: PRPackagerInput): string[] {
  const errors: string[] = [];

  const taxonomyProposalTerms = new Set(
    (input.promotion.proposals?.taxonomyAdditions ?? []).map((t) => t.term.toLowerCase())
  );
  const registryProposalNames = new Set(
    (input.promotion.proposals?.registryAdditions ?? []).map((r) => r.name.toLowerCase())
  );

  for (const term of input.selection.taxonomy) {
    if (!taxonomyProposalTerms.has(term.toLowerCase())) {
      errors.push(`Taxonomy term "${term}" not in promotion proposals.`);
    }
  }
  for (const name of input.selection.registry) {
    if (!registryProposalNames.has(name.toLowerCase())) {
      errors.push(`Registry name "${name}" not in promotion proposals.`);
    }
  }

  const parentExists =
    input.taxonomyParent in input.currentTaxonomy.taxonomy ||
    input.currentTaxonomy.crossReactive.some((cr) => cr.source === input.taxonomyParent);
  if (!parentExists) {
    errors.push(`Parent "${input.taxonomyParent}" not found in taxonomy.`);
  }

  if (input.options?.bumpTaxonomyVersionTo && !VERSION_REGEX.test(input.options.bumpTaxonomyVersionTo)) {
    errors.push(`Invalid taxonomy version format: ${input.options.bumpTaxonomyVersionTo}`);
  }

  return errors;
}

export function computeBundleHash(input: PRPackagerInput): string {
  const payload = JSON.stringify({
    taxonomy: [...input.selection.taxonomy].sort((a, b) => a.localeCompare(b)),
    registry: [...input.selection.registry].sort((a, b) => a.localeCompare(b)),
    mode: input.taxonomyMode,
    parent: input.taxonomyParent,
    version: input.currentTaxonomy.version,
    bumpTo: input.options?.bumpTaxonomyVersionTo ?? "",
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 12);
}

export function buildPRPackagerOutput(input: PRPackagerInput): PRPackagerOutput {
  const errors = validatePRPackagerInput(input);
  if (errors.length > 0) {
    throw new Error(`Validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }

  const sortedTaxonomy = [...input.selection.taxonomy].sort((a, b) => a.localeCompare(b));
  const sortedRegistry = [...input.selection.registry].sort((a, b) => a.localeCompare(b));

  const newVersion =
    input.options?.bumpTaxonomyVersionTo ?? input.currentTaxonomy.version;

  const proposedTaxonomy = applyTaxonomyEdits({
    currentTaxonomy: input.currentTaxonomy,
    terms: sortedTaxonomy,
    mode: input.taxonomyMode,
    parent: input.taxonomyParent,
    newVersion,
  });

  const proposedRegistry = applyRegistryEdits({
    currentRegistry: input.currentRegistry,
    names: sortedRegistry,
    functionClass: null,
  });

  const bundleHash = computeBundleHash(input);

  const suggestedScenarioIds = sortedTaxonomy.map(
    (t) => `scn_${input.taxonomyMode}_${t.replace(/\s+/g, "_")}`
  );

  const manifest: PRPackagerManifest = {
    inputs: {
      profileId: input.promotion.meta.profileId,
      windowHours: input.promotion.meta.windowHours,
      taxonomySelection: sortedTaxonomy,
      registrySelection: sortedRegistry,
      taxonomyMode: input.taxonomyMode,
      taxonomyParent: input.taxonomyParent,
      bumpTaxonomyVersionTo: input.options?.bumpTaxonomyVersionTo,
    },
    selectedTerms: sortedTaxonomy,
    selectedRegistry: sortedRegistry,
    outputPaths: [
      "proposed-taxonomy.json",
      "proposed-registry.json",
      "patches/taxonomy.diff",
      "patches/registry.diff",
      "PACKAGER.md",
      "manifest.json",
    ],
    suggestedAllowlistScenarioIds: suggestedScenarioIds,
    pressureEvidenceNote:
      "Run GET /api/vigilance?profileId=... to capture pressureSources (weightedScore, maxWeighted) for promoted terms.",
  };

  return {
    bundleHash,
    proposedTaxonomy,
    proposedRegistry,
    manifest,
  };
}
