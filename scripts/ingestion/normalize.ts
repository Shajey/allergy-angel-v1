/**
 * Phase 24.1 – Canonical ID Normalizer
 *
 * Deterministic: lowercase, remove apostrophes, collapse punctuation to hyphens, trim.
 */

export function normalizeCanonicalId(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/'/g, "")
    .replace(/[^\w\s-]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

export function normalizeAlias(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

export function dedupeStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of arr) {
    const n = normalizeAlias(a);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}
