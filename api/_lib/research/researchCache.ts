/**
 * Phase 23.1 – Research Cache
 *
 * Persistent cache for research outputs. Identical requests return cached result.
 */

import { getSupabaseClient } from "../supabaseClient.js";

export const RESEARCH_PROMPT_VERSION = "v1";

/** Normalize entity name: lowercase, remove punctuation, trim, replace spaces with hyphens */
export function normalizeEntityName(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

/** Generate cache key for entity research */
export function generateEntityResearchKey(entity: string, entityType: string): string {
  const norm = normalizeEntityName(entity);
  const type = (entityType || "unknown").toLowerCase().trim();
  return `entity:${norm}:${type}:${RESEARCH_PROMPT_VERSION}`;
}

/** Generate cache key for combination research (ordered pair) */
export function generateCombinationResearchKey(
  entityA: string,
  entityB: string,
  typeA: string,
  typeB: string
): string {
  const a = normalizeEntityName(entityA);
  const b = normalizeEntityName(entityB);
  const [ea, eb] = a <= b ? [a, b] : [b, a];
  const ta = (typeA || "unknown").toLowerCase().trim();
  const tb = (typeB || "unknown").toLowerCase().trim();
  const [t1, t2] = ea === a ? [ta, tb] : [tb, ta];
  return `combo:${ea}:${eb}:${t1}:${t2}:${RESEARCH_PROMPT_VERSION}`;
}

export interface CachedResearch {
  research_key: string;
  research_type: "entity" | "combination";
  normalized_input: Record<string, unknown>;
  result: Record<string, unknown>;
  model: string | null;
  prompt_version: string | null;
}

export async function lookupCache(researchKey: string): Promise<CachedResearch | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("research_cache")
      .select("research_key, research_type, normalized_input, result, model, prompt_version")
      .eq("research_key", researchKey)
      .maybeSingle();
    if (error || !data) return null;
    return data as CachedResearch;
  } catch {
    return null;
  }
}

export async function storeCache(args: {
  researchKey: string;
  researchType: "entity" | "combination";
  normalizedInput: Record<string, unknown>;
  result: Record<string, unknown>;
  model?: string;
  promptVersion?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("research_cache").upsert(
      {
        research_key: args.researchKey,
        research_type: args.researchType,
        normalized_input: args.normalizedInput,
        result: args.result,
        model: args.model ?? null,
        prompt_version: args.promptVersion ?? RESEARCH_PROMPT_VERSION,
      },
      { onConflict: "research_key" }
    );
  } catch (err) {
    console.error("[Research Cache] Store failed:", err instanceof Error ? err.message : err);
  }
}
