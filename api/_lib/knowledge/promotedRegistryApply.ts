/**
 * O8.1 — Build CanonicalEntity snapshots from alias proposals for shared registry writes.
 */

import type { AliasProposal, RegistryType } from "../admin/aliasProposalStore.js";
import type { CanonicalEntity } from "./types.js";
import {
  getStaticCanonicalEntity,
  mergeStaticAndPromotedForType,
} from "./registryMerge.js";

function normalizeAlias(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

function uniqueAliases(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of list) {
    const n = normalizeAlias(a);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function parseEntityType(pe: Record<string, unknown> | undefined): CanonicalEntity["type"] {
  const t = typeof pe?.type === "string" ? pe.type : "food";
  if (t === "drug") return "drug";
  if (t === "supplement") return "supplement";
  if (t === "allergen") return "allergen";
  return "food";
}

function parseRiskTags(pe: Record<string, unknown> | undefined): string[] | undefined {
  const riskRaw = pe?.riskTags ?? pe?.risk_tags;
  if (!Array.isArray(riskRaw)) return undefined;
  const tags = riskRaw.filter((x): x is string => typeof x === "string");
  return tags.length ? tags : undefined;
}

function parseClass(pe: Record<string, unknown> | undefined): string | undefined {
  if (typeof pe?.class === "string") return pe.class;
  if (typeof pe?.family === "string") return pe.family;
  return undefined;
}

/** create-entry: full entity from proposal + proposed_entry. */
export function canonicalEntityFromCreateEntryProposal(
  p: AliasProposal
): CanonicalEntity {
  const pe = p.proposed_entry as Record<string, unknown> | undefined;
  const aliasInputs: string[] = [p.canonical_id, p.proposed_alias];
  if (Array.isArray(pe?.aliases)) {
    for (const a of pe!.aliases as unknown[]) {
      if (typeof a === "string") aliasInputs.push(a);
    }
  }
  const aliases = uniqueAliases(aliasInputs);
  return {
    id: p.canonical_id.trim(),
    type: parseEntityType(pe),
    aliases: aliases.length ? aliases : [normalizeAlias(p.canonical_id)],
    class: parseClass(pe),
    riskTags: parseRiskTags(pe),
  };
}

function mergeAliasesOnto(
  base: CanonicalEntity,
  extraAlias: string
): CanonicalEntity {
  const merged = uniqueAliases([...base.aliases, extraAlias]);
  return {
    ...base,
    aliases: merged,
  };
}

function stripAlias(base: CanonicalEntity, aliasToRemove: string): CanonicalEntity {
  const n = normalizeAlias(aliasToRemove);
  const aliases = base.aliases.filter((a) => normalizeAlias(a) !== n);
  return { ...base, aliases };
}

/**
 * Resolve base entity for add-alias: static, or promoted overlay (batch map / prior DB).
 */
export function resolveBaseForMerge(
  registryType: RegistryType,
  canonicalId: string,
  promotedByCanonical: Map<string, CanonicalEntity>
): CanonicalEntity | null {
  const key = `${registryType}:${canonicalId.toLowerCase().trim()}`;
  const fromMap = promotedByCanonical.get(key);
  if (fromMap) return fromMap;
  return getStaticCanonicalEntity(registryType, canonicalId);
}

/** Merged static + promoted view for dependency ordering within a promotion batch. */
export function buildPromotedLookupMap(
  promoted: CanonicalEntity[]
): Map<string, CanonicalEntity> {
  const m = new Map<string, CanonicalEntity>();
  for (const t of ["drug", "supplement", "food"] as const) {
    const merged = mergeStaticAndPromotedForType(t, promoted);
    for (const e of merged) {
      m.set(`${t}:${e.id.toLowerCase().trim()}`, e);
    }
  }
  return m;
}

/**
 * Produce the CanonicalEntity to persist for this proposal.
 * Returns null if the proposal should not produce a runtime row (e.g. unknown base for add-alias).
 */
export function canonicalEntityForProposalExport(
  p: AliasProposal,
  promotedByCanonical: Map<string, CanonicalEntity>
): CanonicalEntity | null {
  const rt = p.registry_type;
  if (p.proposal_action === "create-entry") {
    return canonicalEntityFromCreateEntryProposal(p);
  }
  if (p.proposal_action === "add-alias") {
    const base = resolveBaseForMerge(rt, p.canonical_id, promotedByCanonical);
    if (!base) return null;
    return mergeAliasesOnto(base, p.proposed_alias);
  }
  if (p.proposal_action === "remove-alias") {
    const base = resolveBaseForMerge(rt, p.canonical_id, promotedByCanonical);
    if (!base) return null;
    return stripAlias(base, p.proposed_alias);
  }
  return null;
}
