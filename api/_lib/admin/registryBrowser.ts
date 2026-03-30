/**
 * Phase 21c – Registry access (static + O8.1 promoted runtime rows)
 *
 * List, search, and single-entry access for admin UI.
 * Merged view: ship static registries plus promoted_registry_entities.
 */

import { REGISTRY_VERSIONS } from "../knowledge/registryVersions.js";
import type { CanonicalEntity } from "../knowledge/types.js";
import { getPromotedRegistryEntities } from "../knowledge/entityResolver.js";
import {
  mergeStaticAndPromotedForType,
  type RegistryType,
} from "../knowledge/registryMerge.js";

export type { RegistryType };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

function getMergedRegistry(type: RegistryType): CanonicalEntity[] {
  return mergeStaticAndPromotedForType(type, getPromotedRegistryEntities());
}

export interface RegistryEntrySummary {
  id: string;
  type: RegistryType;
  aliases: string[];
  class?: string;
  aliasCount: number;
  /** O8.1 — unified read model (static + promoted) */
  source: "registry";
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
  const entities = getMergedRegistry(type);
  const version = REGISTRY_VERSIONS[type];
  const entries: RegistryEntrySummary[] = entities.map((e) => ({
    id: e.id,
    type,
    aliases: [...e.aliases],
    class: e.class,
    aliasCount: e.aliases.length,
    source: "registry",
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
  source: "registry";
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
    const entities = getMergedRegistry(t);
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
          source: "registry",
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
  source: "registry";
}

export function getRegistryEntry(
  type: RegistryType,
  id: string
): RegistryEntryDetail | null {
  const entities = getMergedRegistry(type);
  const idNorm = normalize(id);
  const entity = entities.find((e) => normalize(e.id) === idNorm);
  if (!entity) return null;
  return {
    id: entity.id,
    type,
    aliases: [...entity.aliases],
    class: entity.class,
    source: "registry",
  };
}

export function aliasExistsInStaticRegistry(alias: string): boolean {
  const q = normalize(alias);
  const all = [
    ...getMergedRegistry("drug"),
    ...getMergedRegistry("supplement"),
    ...getMergedRegistry("food"),
  ];
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
  const entities = getMergedRegistry(type);
  const idNorm = normalize(canonicalId);
  return entities.find((e) => normalize(e.id) === idNorm) ?? null;
}
