/**
 * Phase 21c – Read-Only Registry Browser
 *
 * Provides list, search, and single-entry access for admin UI.
 * Does NOT mutate registries.
 */

import { DRUGS } from "../knowledge/drugs.registry.js";
import { SUPPLEMENTS } from "../knowledge/supplements.registry.js";
import { FOODS } from "../knowledge/foods.registry.js";
import { REGISTRY_VERSIONS } from "../knowledge/registryVersions.js";
import type { CanonicalEntity } from "../knowledge/types.js";

export type RegistryType = "drug" | "supplement" | "food";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

function getRegistry(type: RegistryType): CanonicalEntity[] {
  switch (type) {
    case "drug":
      return DRUGS;
    case "supplement":
      return SUPPLEMENTS;
    case "food":
      return FOODS;
    default:
      return [];
  }
}

export interface RegistryEntrySummary {
  id: string;
  type: RegistryType;
  aliases: string[];
  class?: string;
  aliasCount: number;
  source: "static";
}

export interface RegistryListResult {
  meta: {
    type: RegistryType;
    version: string;
    count: number;
  };
  entries: RegistryEntrySummary[];
}

export function listRegistry(type: RegistryType): RegistryListResult {
  const entities = getRegistry(type);
  const version = REGISTRY_VERSIONS[type];
  const entries: RegistryEntrySummary[] = entities.map((e) => ({
    id: e.id,
    type,
    aliases: [...e.aliases],
    class: e.class,
    aliasCount: e.aliases.length,
    source: "static",
  }));
  return {
    meta: { type, version, count: entries.length },
    entries,
  };
}

export interface SearchResult {
  id: string;
  type: RegistryType;
  matchedOn: string;
  aliases: string[];
  class?: string;
  source: "static";
}

export interface RegistrySearchResult {
  results: SearchResult[];
}

export function searchRegistry(
  search: string,
  type?: RegistryType
): RegistrySearchResult {
  const q = normalize(search);
  if (!q || q.length < 2) return { results: [] };

  const types: RegistryType[] = type ? [type] : ["drug", "supplement", "food"];
  const results: SearchResult[] = [];

  for (const t of types) {
    const entities = getRegistry(t);
    for (const e of entities) {
      const matchedAlias = e.aliases.find(
        (a) => normalize(a).includes(q) || q.includes(normalize(a))
      );
      if (matchedAlias || normalize(e.id).includes(q)) {
        results.push({
          id: e.id,
          type: t,
          matchedOn: matchedAlias ?? e.id,
          aliases: [...e.aliases],
          class: e.class,
          source: "static",
        });
      }
    }
  }

  return { results };
}

export interface RegistryEntryDetail {
  id: string;
  type: RegistryType;
  aliases: string[];
  class?: string;
  source: "static";
}

export function getRegistryEntry(
  type: RegistryType,
  id: string
): RegistryEntryDetail | null {
  const entities = getRegistry(type);
  const idNorm = normalize(id);
  const entity = entities.find((e) => normalize(e.id) === idNorm);
  if (!entity) return null;
  return {
    id: entity.id,
    type,
    aliases: [...entity.aliases],
    class: entity.class,
    source: "static",
  };
}

export function aliasExistsInStaticRegistry(alias: string): boolean {
  const q = normalize(alias);
  const all = [...DRUGS, ...SUPPLEMENTS, ...FOODS];
  for (const e of all) {
    for (const a of e.aliases) {
      if (normalize(a) === q) return true;
    }
  }
  return false;
}

export function getEntryByCanonicalId(
  type: RegistryType,
  canonicalId: string
): CanonicalEntity | null {
  const entities = getRegistry(type);
  const idNorm = normalize(canonicalId);
  return entities.find((e) => normalize(e.id) === idNorm) ?? null;
}
