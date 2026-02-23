/**
 * Phase 12.2 – Allergen Taxonomy Loader
 *
 * Deterministic loader for taxonomy. Production uses in-repo default.
 * Eval/replay can override via ALLERGEN_TAXONOMY_PATH or explicit path param.
 * No network, no randomness. Sync file read in eval context only.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  ALLERGEN_TAXONOMY,
  ALLERGEN_TAXONOMY_VERSION,
  ALIASES,
  CROSS_REACTIVE_REGISTRY,
  type AllergenParentKey,
} from "../inference/allergenTaxonomy.js";

export interface LoadedTaxonomy {
  version: string;
  taxonomy: Record<string, { label: string; children: string[] }>;
  severity: Record<string, number>;
  crossReactive: Array<{ source: string; related: string[]; riskModifier: number }>;
  /** Phase 12.6: canonical id → sorted aliases. Lowercase, unique, alphabetically sorted. */
  aliases?: Record<string, string[]>;
}

const DEFAULT_SEVERITY: Record<string, number> = {
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

function getDefaultTaxonomy(): LoadedTaxonomy {
  const severity = { ...DEFAULT_SEVERITY };
  for (const k of Object.keys(ALLERGEN_TAXONOMY)) {
    if (!(k in severity)) severity[k] = 50;
  }

  return {
    version: ALLERGEN_TAXONOMY_VERSION,
    taxonomy: ALLERGEN_TAXONOMY as Record<string, { label: string; children: string[] }>,
    severity,
    crossReactive: [...CROSS_REACTIVE_REGISTRY],
    aliases: { ...ALIASES },
  };
}

/**
 * Load taxonomy from path or env. When no override, returns in-repo default.
 * @param overridePath - explicit file path; overrides ALLERGEN_TAXONOMY_PATH env
 */
export function loadAllergenTaxonomy(overridePath?: string): LoadedTaxonomy {
  const pathToUse = overridePath ?? process.env.ALLERGEN_TAXONOMY_PATH;
  if (!pathToUse) {
    return getDefaultTaxonomy();
  }

  const absPath = resolve(process.cwd(), pathToUse);
  let raw: string;
  try {
    raw = readFileSync(absPath, "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`loadAllergenTaxonomy: failed to read ${absPath}: ${msg}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`loadAllergenTaxonomy: invalid JSON in ${absPath}: ${msg}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`loadAllergenTaxonomy: expected object in ${absPath}`);
  }

  const obj = parsed as Record<string, unknown>;
  const version = typeof obj.version === "string" ? obj.version : "unknown";
  const taxonomy =
    obj.taxonomy && typeof obj.taxonomy === "object"
      ? (obj.taxonomy as Record<string, { label: string; children: string[] }>)
      : {};
  const severity =
    obj.severity && typeof obj.severity === "object"
      ? (obj.severity as Record<string, number>)
      : {};
  const crossReactive = Array.isArray(obj.crossReactive)
    ? (obj.crossReactive as Array<{ source: string; related: string[]; riskModifier: number }>)
    : [];
  const aliases =
    obj.aliases && typeof obj.aliases === "object"
      ? (obj.aliases as Record<string, string[]>)
      : undefined;

  return { version, taxonomy, severity, crossReactive, aliases };
}
