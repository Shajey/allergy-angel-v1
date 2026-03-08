/**
 * Phase 24.1 – Deduplication Against Static Registries
 *
 * Marks candidates as duplicate when they match existing registry entries.
 * Does not modify registries.
 */

import { DRUGS } from "../../api/_lib/knowledge/drugs.registry.js";
import { normalizeCanonicalId, normalizeAlias } from "./normalize.js";
import type { IngestionCandidate, MatchedExisting } from "../api/_lib/ingestion/types.js";

function buildRegistryIndex(): {
  canonicalIds: Set<string>;
  aliasToCanonical: Map<string, { id: string; matchType: "exact" | "alias" }>;
} {
  const canonicalIds = new Set<string>();
  const aliasToCanonical = new Map<string, { id: string; matchType: "exact" | "alias" }>();

  for (const e of DRUGS) {
    const normId = normalizeCanonicalId(e.id);
    canonicalIds.add(normId);
    aliasToCanonical.set(normId, { id: e.id, matchType: "exact" });
    for (const a of e.aliases) {
      const na = normalizeAlias(a);
      const nid = normalizeCanonicalId(a);
      if (na && !aliasToCanonical.has(na)) {
        aliasToCanonical.set(na, { id: e.id, matchType: "alias" });
      }
      if (nid && !aliasToCanonical.has(nid)) {
        aliasToCanonical.set(nid, { id: e.id, matchType: "alias" });
      }
    }
  }
  return { canonicalIds, aliasToCanonical };
}

let _index: ReturnType<typeof buildRegistryIndex> | null = null;

function getIndex() {
  if (!_index) _index = buildRegistryIndex();
  return _index;
}

export function dedupeCandidate(candidate: IngestionCandidate): IngestionCandidate {
  if (candidate.registryType !== "drug") return candidate;
  const { canonicalIds, aliasToCanonical } = getIndex();

  const normCanonical = normalizeCanonicalId(candidate.canonicalId);
  const existingByCanonical = canonicalIds.has(normCanonical);
  if (existingByCanonical) {
    const entry = aliasToCanonical.get(normCanonical);
    return {
      ...candidate,
      status: "duplicate",
      matchedExisting: {
        registryType: "drug",
        canonicalId: entry?.id ?? candidate.canonicalId,
        matchType: "exact",
      },
    };
  }

  for (const a of [candidate.name, ...candidate.aliases]) {
    const na = normalizeAlias(a);
    const nid = normalizeCanonicalId(a);
    const byAlias = aliasToCanonical.get(na) ?? aliasToCanonical.get(nid);
    if (byAlias) {
      return {
        ...candidate,
        status: "duplicate",
        matchedExisting: {
          registryType: "drug",
          canonicalId: byAlias.id,
          matchType: byAlias.matchType,
        },
      };
    }
  }

  return candidate;
}

export function dedupeCandidates(candidates: IngestionCandidate[]): IngestionCandidate[] {
  return candidates.map(dedupeCandidate);
}
