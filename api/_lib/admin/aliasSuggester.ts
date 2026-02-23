/**
 * Phase 12.6 – Alias Suggester (Promotion Consultant Only)
 *
 * Advisory module for suggesting potential aliases during promotion.
 * Uses natural.PorterStemmer and natural.JaroWinklerDistance.
 *
 * CRITICAL: This file MUST NOT be imported by inference runtime files.
 * Runtime matching is strictly deterministic via CANONICAL_MAP.
 */

import natural from "natural";

const stemmer = natural.PorterStemmer;
const jaroWinkler = natural.JaroWinklerDistance as (s1: string, s2: string, opts?: { ignoreCase?: boolean }) => number;

export interface AliasSuggestion {
  candidate: string;
  suggestedTarget: string;
  similarity: number;
  stemMatch: boolean;
}

/**
 * Suggest potential alias for an unmapped term against existing taxonomy ids.
 * Advisory only. Human must review before adding to taxonomy.
 *
 * Criteria:
 *   - similarity > 0.85 (Jaro-Winkler)
 *   - stems match
 *   - length difference <= 2
 */
export function suggestAliasTarget(
  unmappedTerm: string,
  existingTaxonomyIds: string[]
): AliasSuggestion | null {
  const candidate = unmappedTerm.toLowerCase().trim();
  if (!candidate) return null;

  const candidateStem = stemmer.stem(candidate);
  const candidateLen = candidate.length;

  let best: AliasSuggestion | null = null;

  for (const target of existingTaxonomyIds) {
    const targetNorm = target.toLowerCase().trim();
    if (targetNorm === candidate) continue;

    const similarity = jaroWinkler(candidate, targetNorm);
    if (similarity <= 0.85) continue;

    const targetStem = stemmer.stem(targetNorm);
    const stemMatch = candidateStem === targetStem;
    const lenDiff = Math.abs(candidateLen - targetNorm.length);
    if (lenDiff > 2) continue;

    if (!best || similarity > best.similarity) {
      best = {
        candidate,
        suggestedTarget: targetNorm,
        similarity,
        stemMatch,
      };
    }
  }

  return best;
}

/**
 * Batch suggest aliases for multiple unmapped terms.
 */
export function suggestAliasesForUnmapped(
  unmappedTerms: string[],
  existingTaxonomyIds: string[]
): AliasSuggestion[] {
  const results: AliasSuggestion[] = [];
  for (const term of unmappedTerms) {
    const suggestion = suggestAliasTarget(term, existingTaxonomyIds);
    if (suggestion) results.push(suggestion);
  }
  return results;
}
