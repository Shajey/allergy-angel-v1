/**
 * O8.1 — Persist promoted CanonicalEntity rows and hydrate the in-memory resolver overlay.
 */

import { getSupabaseClient } from "../supabaseClient.js";
import type { AliasProposal, RegistryType } from "../admin/aliasProposalStore.js";
import type { CanonicalEntity } from "./types.js";
import { setPromotedRegistryEntities } from "./entityResolver.js";
import {
  canonicalEntityForProposalExport,
  buildPromotedLookupMap,
} from "./promotedRegistryApply.js";
import { entityMatchesRegistryType } from "./registryMerge.js";

function isMissingTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /relation.*does not exist|table.*does not exist|does not exist/i.test(msg);
}

function replaceInPromotedList(
  list: CanonicalEntity[],
  registryType: RegistryType,
  entity: CanonicalEntity
): CanonicalEntity[] {
  const idNorm = entity.id.toLowerCase().trim();
  const filtered = list.filter((e) => {
    const sameId = e.id.toLowerCase().trim() === idNorm;
    const sameRt = entityMatchesRegistryType(e, registryType as "drug" | "supplement" | "food");
    return !(sameId && sameRt);
  });
  return [...filtered, entity];
}

export async function fetchPromotedEntitiesFromDb(): Promise<CanonicalEntity[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("promoted_registry_entities")
    .select("entity_json");

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`promoted_registry_entities read failed: ${error.message}`);
  }

  const out: CanonicalEntity[] = [];
  for (const row of data ?? []) {
    const ej = row.entity_json as Record<string, unknown> | null;
    if (!ej || typeof ej.id !== "string") continue;
    const entity: CanonicalEntity = {
      id: ej.id,
      type: ej.type as CanonicalEntity["type"],
      aliases: Array.isArray(ej.aliases)
        ? ej.aliases.filter((x): x is string => typeof x === "string")
        : [],
      class: typeof ej.class === "string" ? ej.class : undefined,
      riskTags: Array.isArray(ej.riskTags)
        ? ej.riskTags.filter((x): x is string => typeof x === "string")
        : undefined,
    };
    out.push(entity);
  }
  return out;
}

/**
 * Loads promoted rows from Supabase into entityResolver. Call at the start of
 * registry, profile, and consumer inference paths (serverless-safe).
 */
export async function ensurePromotedRegistryLoaded(): Promise<void> {
  try {
    const entities = await fetchPromotedEntitiesFromDb();
    setPromotedRegistryEntities(entities);
  } catch (e) {
    if (isMissingTable(e)) {
      setPromotedRegistryEntities([]);
    } else {
      throw e;
    }
  }
}

async function upsertPromotedRow(args: {
  registry_type: RegistryType;
  canonical_id: string;
  entity: CanonicalEntity;
  source_proposal_id: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("promoted_registry_entities").upsert(
    {
      registry_type: args.registry_type,
      canonical_id: args.canonical_id,
      entity_json: args.entity,
      source_proposal_id: args.source_proposal_id,
      promoted_at: new Date().toISOString(),
    },
    { onConflict: "registry_type,canonical_id" }
  );

  if (error) throw new Error(`promoted_registry_entities upsert failed: ${error.message}`);
}

/**
 * Apply governed promotion: persist each proposal as a registry snapshot and refresh memory.
 * Call before or after markProposalsExported; proposals must still be readable (pass full objects).
 */
export async function applyPromotedProposalsToSharedRegistry(
  proposals: AliasProposal[]
): Promise<void> {
  if (proposals.length === 0) return;

  let promoted = await fetchPromotedEntitiesFromDb();

  for (const p of proposals) {
    const map = buildPromotedLookupMap(promoted);
    const entity = canonicalEntityForProposalExport(p, map);
    if (!entity) {
      throw new Error(
        `Cannot apply promotion: missing base entity for ${p.registry_type}/${p.canonical_id} (${p.proposal_action})`
      );
    }
    await upsertPromotedRow({
      registry_type: p.registry_type,
      canonical_id: entity.id,
      entity,
      source_proposal_id: p.id,
    });
    promoted = replaceInPromotedList(promoted, p.registry_type, entity);
  }

  setPromotedRegistryEntities(promoted);
}
