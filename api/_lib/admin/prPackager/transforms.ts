/**
 * Phase 12.3 – PR Packager Pure Transforms
 *
 * Deterministic transforms for taxonomy and registry.
 * No I/O, no DB, no LLM.
 */

import type { LoadedTaxonomy } from "../../knowledge/loadAllergenTaxonomy.js";
import type { LoadedRegistry } from "../../knowledge/loadFunctionalRegistry.js";
import type { FunctionalClassEntry } from "../../inference/functionalClasses.js";

export type TaxonomyEditMode = "crossReactive" | "child";

export interface TaxonomyTransformInput {
  currentTaxonomy: LoadedTaxonomy;
  terms: string[];
  mode: TaxonomyEditMode;
  parent: string;
  newVersion?: string;
}

export interface RegistryTransformInput {
  currentRegistry: LoadedRegistry;
  names: string[];
  functionClass?: string | null;
}

/**
 * Add terms to taxonomy as crossReactive under parent OR as children under parent.
 * Refuses if parent does not exist. No new parents.
 */
export function applyTaxonomyEdits(input: TaxonomyTransformInput): LoadedTaxonomy {
  const { currentTaxonomy, terms, mode, parent, newVersion } = input;
  const trimmed = [...terms].filter(Boolean).map((t) => t.trim());
  const seen = new Map<string, string>();
  for (const t of trimmed) {
    const k = t.toLowerCase();
    if (!seen.has(k)) seen.set(k, t);
  }
  const deduped = [...seen.values()].sort((a, b) => a.localeCompare(b));

  const parentExists =
    parent in currentTaxonomy.taxonomy ||
    currentTaxonomy.crossReactive.some((cr) => cr.source === parent);
  if (!parentExists) {
    throw new Error(`Parent "${parent}" not found in taxonomy.`);
  }

  const result: LoadedTaxonomy = {
    version: newVersion ?? currentTaxonomy.version,
    taxonomy: JSON.parse(JSON.stringify(currentTaxonomy.taxonomy)),
    severity: { ...currentTaxonomy.severity },
    crossReactive: currentTaxonomy.crossReactive.map((cr) => ({
      ...cr,
      related: [...cr.related],
    })),
  };

  if (mode === "crossReactive") {
    let found = false;
    for (const cr of result.crossReactive) {
      if (cr.source === parent) {
        for (const term of deduped) {
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
        related: [...deduped],
        riskModifier: 10,
      });
      result.crossReactive.sort((a, b) => a.source.localeCompare(b.source));
    }
  } else {
    const entry = result.taxonomy[parent];
    if (entry) {
      for (const term of deduped) {
        if (!entry.children.includes(term)) {
          entry.children.push(term);
        }
      }
      entry.children.sort((a, b) => a.localeCompare(b));
    }
  }

  return result;
}

/**
 * Phase 12.6: Append aliases to a target node. Validates target exists.
 * Dedupes, normalizes (lowercase), sorts alphabetically. Bumps version.
 */
export function applyAliasEdits(input: {
  currentTaxonomy: LoadedTaxonomy;
  targetNodeId: string;
  newAliases: string[];
  newVersion?: string;
}): LoadedTaxonomy {
  const { currentTaxonomy, targetNodeId, newAliases, newVersion } = input;
  const targetNorm = targetNodeId.toLowerCase().trim();

  const allTermIds = new Set<string>();
  for (const entry of Object.values(currentTaxonomy.taxonomy)) {
    for (const c of entry.children) allTermIds.add(c.toLowerCase().trim());
  }
  for (const cr of currentTaxonomy.crossReactive) {
    for (const r of cr.related) allTermIds.add(r.toLowerCase().trim());
  }
  if (!allTermIds.has(targetNorm)) {
    throw new Error(`Target node "${targetNodeId}" not found in taxonomy.`);
  }

  const normalized = newAliases
    .map((a) => a.toLowerCase().trim())
    .filter((a) => a && a !== targetNorm);
  const existing = currentTaxonomy.aliases?.[targetNorm] ?? [];
  const combined = [...new Set([...existing, ...normalized])].sort((a, b) =>
    a.localeCompare(b)
  );

  const result: LoadedTaxonomy = {
    version: newVersion ?? currentTaxonomy.version,
    taxonomy: JSON.parse(JSON.stringify(currentTaxonomy.taxonomy)),
    severity: { ...currentTaxonomy.severity },
    crossReactive: currentTaxonomy.crossReactive.map((cr) => ({
      ...cr,
      related: [...cr.related],
    })),
    aliases: { ...(currentTaxonomy.aliases ?? {}) },
  };
  result.aliases![targetNorm] = combined;

  return result;
}

const UNCATEGORIZED_KEY = "_promoted";

/**
 * Add names to registry. New terms go into _promoted class (functionClass null/blank).
 */
export function applyRegistryEdits(input: RegistryTransformInput): LoadedRegistry {
  const { currentRegistry, names, functionClass } = input;
  const trimmed = [...names].filter(Boolean).map((n) => n.trim().toLowerCase());
  const deduped = [...new Set(trimmed)].sort((a, b) => a.localeCompare(b));

  const result = { ...currentRegistry } as LoadedRegistry;

  if (functionClass && functionClass in result) {
    const entry = result[functionClass];
    for (const name of deduped) {
      if (!entry.terms.includes(name)) {
        entry.terms.push(name);
      }
    }
    entry.terms.sort((a, b) => a.localeCompare(b));
    return result;
  }

  const existing = result[UNCATEGORIZED_KEY] as FunctionalClassEntry | undefined;
  const terms = existing ? [...existing.terms] : [];
  for (const name of deduped) {
    if (!terms.includes(name)) {
      terms.push(name);
    }
  }
  terms.sort((a, b) => a.localeCompare(b));
  result[UNCATEGORIZED_KEY] = {
    label: "Promoted (uncategorized)",
    terms,
    examples: terms.slice(0, 5),
  };

  return result;
}
