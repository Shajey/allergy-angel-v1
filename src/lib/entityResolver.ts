/**
 * Phase 21b – Client-Side Entity Resolver
 *
 * Lightweight resolver that fetches alias map from API and caches in memory.
 * Used for isItemInProfile canonical matching.
 */

let aliasMapCache: Record<string, string> | null = null;

async function getAliasMap(): Promise<Record<string, string>> {
  if (aliasMapCache) return aliasMapCache;
  const res = await fetch("/api/knowledge/aliases");
  if (!res.ok) throw new Error("Failed to fetch alias map");
  aliasMapCache = await res.json();
  return aliasMapCache!;
}

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

export interface ResolveResult {
  canonical: string;
  resolved: boolean;
}

/**
 * Resolve a raw string to canonical form.
 * Returns { canonical, resolved }.
 * Use resolveEntityAsync for async (fetches map on first call).
 */
export function resolveEntitySync(
  raw: string,
  aliasMap: Record<string, string>
): ResolveResult {
  const key = normalize(raw);
  const canonical = aliasMap[key];
  return {
    canonical: canonical ?? key,
    resolved: !!canonical,
  };
}

/**
 * Resolve a raw string to canonical form (async, fetches map if needed).
 */
export async function resolveEntityAsync(raw: string): Promise<ResolveResult> {
  const map = await getAliasMap();
  return resolveEntitySync(raw, map);
}

/**
 * Preload the alias map (call on app init to avoid latency on first resolve).
 */
export function preloadAliasMap(): Promise<Record<string, string>> {
  return getAliasMap();
}
