/**
 * Phase 23 – Deterministic Proposal Generator
 *
 * Normalizes LLM research output into the registry contract.
 * Does NOT write to registries.
 */

import type {
  RegistryType,
  EntityDraft,
  AliasDraft,
  RelationshipDraft,
} from "./proposalTypes.js";

/** Normalize string to canonical ID format (lowercase, hyphens for spaces) */
export function toCanonicalId(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

/** Dedupe and normalize aliases */
export function dedupeAliases(aliases: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of aliases) {
    const n = a.toLowerCase().trim().replace(/\s+/g, " ");
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/** Map category to registry type */
export function categoryToRegistryType(category: string): RegistryType {
  const c = category?.toLowerCase() ?? "";
  if (c.includes("drug") || c.includes("medication") || c.includes("pharma")) return "drug";
  if (c.includes("supplement") || c.includes("vitamin") || c.includes("herb")) return "supplement";
  if (c.includes("food") || c.includes("allergen")) return "food";
  return "supplement";
}

/** Generate entity draft from research output */
export function generateEntityDraft(raw: {
  proposalType: string;
  registryType?: string;
  entityDraft?: { canonicalName?: string; aliases?: string[]; class?: string };
  aliasDraft?: { canonicalId?: string; proposedAlias?: string };
  reasoning?: string;
  research?: { identity?: { canonicalName?: string; commonAliases?: string[]; category?: string; class?: string } };
}): { entityDraft?: EntityDraft; aliasDraft?: AliasDraft } {
  const registryType = (raw.registryType ?? categoryToRegistryType(raw.research?.identity?.category ?? "")) as RegistryType;
  if (raw.proposalType === "add-alias" && raw.aliasDraft) {
    return {
      aliasDraft: {
        registryType,
        canonicalId: toCanonicalId(raw.aliasDraft.canonicalId ?? ""),
        proposedAlias: (raw.aliasDraft.proposedAlias ?? "").toLowerCase().trim(),
        reasoning: raw.reasoning,
      },
    };
  }
  if (raw.proposalType === "create-entity" && (raw.entityDraft || raw.research?.identity)) {
    const identity = raw.entityDraft ?? raw.research?.identity;
    const canonicalName = (identity?.canonicalName ?? "").trim();
    const rawAliases = (identity as { commonAliases?: string[]; aliases?: string[] })?.commonAliases
      ?? (identity as { commonAliases?: string[]; aliases?: string[] })?.aliases
      ?? [canonicalName];
    const aliases = dedupeAliases(rawAliases);
    return {
      entityDraft: {
        registryType,
        canonicalName: canonicalName || "unknown",
        aliases: aliases.length ? aliases : [canonicalName || "unknown"],
        class: identity?.class?.trim() || undefined,
        reasoning: raw.reasoning,
      },
    };
  }
  return {};
}

/** Generate relationship draft from research output */
export function generateRelationshipDraft(raw: {
  proposalType: string;
  relationshipDraft?: {
    subjectType?: string;
    subjectId?: string;
    relationshipType?: string;
    objectType?: string;
    objectId?: string;
    evidenceLevel?: string;
    confidenceScore?: number;
    reasoning?: string;
  };
  research?: { entityA?: string; entityB?: string };
  meta?: { entityA?: string; entityB?: string };
}): RelationshipDraft | null {
  if (raw.proposalType !== "create-relationship" || !raw.relationshipDraft) return null;
  const d = raw.relationshipDraft;
  const entityA = raw.meta?.entityA ?? raw.research?.entityA ?? "";
  const entityB = raw.meta?.entityB ?? raw.research?.entityB ?? "";
  return {
    subjectType: (d.subjectType ?? "entity") as "entity" | "class",
    subjectId: toCanonicalId(d.subjectId ?? entityA),
    relationshipType: d.relationshipType ?? "may_interact_with",
    objectType: (d.objectType ?? "entity") as "entity" | "class",
    objectId: toCanonicalId(d.objectId ?? entityB),
    evidenceLevel: d.evidenceLevel ?? "unknown",
    confidenceScore: typeof d.confidenceScore === "number" ? d.confidenceScore : 0.5,
    reasoning: d.reasoning ?? "",
  };
}
