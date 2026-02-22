/**
 * Phase 11 – AA Team Discovery Engine
 *
 * Deterministic discovery of unmapped ingestible entities from stored
 * history to guide taxonomy growth. Read-only, no LLM, no schema changes.
 *
 * Hygiene: We exclude generic meal-shape tokens (ice, cream, sandwich, etc.)
 * via MEAL_GENERIC_TOKENS so the candidates list surfaces actionable taxonomy
 * gaps rather than stopword artifacts. Extend MEAL_GENERIC_TOKENS when new
 * noise patterns emerge.
 */

import { getSupabaseClient } from "../supabaseClient.js";
import { ALLERGEN_TAXONOMY } from "../inference/allergenTaxonomy.js";
import {
  FUNCTIONAL_CLASS_REGISTRY,
  matchFunctionalClasses,
  normalizeTerm as fcNormalize,
} from "../inference/functionalClasses.js";
import { buildEvidence } from "./unmappedEvidence.js";

// ── Stopwords for meal tokenization ────────────────────────────────────
const MEAL_STOPWORDS = new Set([
  "with",
  "and",
  "or",
  "of",
  "the",
  "a",
  "an",
  "for",
  "my",
  "mg",
  "g",
  "grams",
  "carbs",
  "protein",
  "breakfast",
  "lunch",
  "dinner",
]);

/**
 * Generic meal-shape words to exclude from meal_token candidates.
 * These are high-frequency, low-actionability tokens that dominate the list
 * without representing taxonomy gaps. Extend this set as needed when new
 * noise patterns emerge.
 */
const MEAL_GENERIC_TOKENS = new Set([
  "ice",
  "cream",
  "sweet",
  "sandwich",
  "cookie",
  "cookies",
  "biscuit",
  "biscuits",
  "pie",
  "steak",
  "sirloin",
  "potato",
  "potatoes",
]);

/**
 * Canonicalize a meal token for deduplication and quality checks.
 * - Lowercase, trim, strip punctuation
 * - Collapse simple plurals: es (mangoes->mango), trailing s (biscuits->biscuit)
 * - Skips "ies" rule (berries->berry) to avoid cookies->cooky
 */
function canonicalizeMealToken(token: string): string {
  let t = token
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return t;
  // Multiword: canonicalize each word part and rejoin
  if (t.includes(" ")) {
    return t
      .split(/\s+/)
      .map((w) => canonicalizeMealToken(w))
      .filter(Boolean)
      .join(" ");
  }
  // Plural: es (mangoes->mango) for words > 4
  if (t.length > 4 && t.endsWith("es")) {
    t = t.slice(0, -2);
  }
  // Plural: trailing s (biscuits->biscuit) for words > 3
  else if (t.length > 3 && t.endsWith("s")) {
    t = t.slice(0, -1);
  }
  return t;
}

// ── Multiword taxonomy children (for phrase extraction) ──────────────────
const MULTIWORD_CHILDREN: string[] = [];
for (const entry of Object.values(ALLERGEN_TAXONOMY)) {
  for (const child of entry.children) {
    if (child.includes(" ")) {
      MULTIWORD_CHILDREN.push(child);
    }
  }
}
// Sort by length desc so we match longer phrases first (e.g. "brazil nut" before "nut")
MULTIWORD_CHILDREN.sort((a, b) => b.length - a.length);

// ── Mapped terms: allergen taxonomy + functional classes ────────────────
const MAPPED_TERMS = new Set<string>();

for (const key of Object.keys(ALLERGEN_TAXONOMY)) {
  MAPPED_TERMS.add(key.toLowerCase());
}
for (const entry of Object.values(ALLERGEN_TAXONOMY)) {
  for (const child of entry.children) {
    MAPPED_TERMS.add(child.toLowerCase());
  }
}
for (const entry of Object.values(FUNCTIONAL_CLASS_REGISTRY)) {
  for (const term of entry.terms) {
    MAPPED_TERMS.add(fcNormalize(term));
  }
}

function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeMeal(mealText: string): string[] {
  return tokenizeMealWithRaw(mealText).map((t) => t.canonical);
}

/**
 * Tokenize meal text returning (canonical, raw) pairs for evidence examples.
 * Raw = original form before canonicalization (e.g. "mangoes" -> canonical "mango").
 */
function tokenizeMealWithRaw(mealText: string): { canonical: string; raw: string }[] {
  const seen = new Set<string>();
  const result: { canonical: string; raw: string }[] = [];
  const lower = mealText.toLowerCase();

  // 1. Extract multiword taxonomy children present as substrings (e.g. "brazil nut")
  for (const phrase of MULTIWORD_CHILDREN) {
    if (lower.includes(phrase)) {
      const canonical = canonicalizeMealToken(phrase);
      if (canonical && !seen.has(canonical)) {
        seen.add(canonical);
        result.push({ canonical, raw: phrase });
      }
    }
  }

  // 2. Tokenize: lowercase, strip punctuation, split on spaces, remove stopwords
  const words = normalizeToken(mealText)
    .split(/\s+/)
    .filter((w) => w.length > 0 && !MEAL_STOPWORDS.has(w));

  for (const w of words) {
    const canonical = canonicalizeMealToken(w);
    if (!canonical) continue;
    // Quality gates: length >= 3, not generic
    if (canonical.length < 3) continue;
    if (MEAL_GENERIC_TOKENS.has(canonical) || MEAL_GENERIC_TOKENS.has(w.toLowerCase())) continue;
    if (!seen.has(canonical)) {
      seen.add(canonical);
      result.push({ canonical, raw: w });
    }
  }

  return result;
}

function isMapped(candidate: string): boolean {
  const norm = normalizeToken(candidate);
  if (!norm) return true; // treat empty as mapped to exclude
  if (MAPPED_TERMS.has(norm)) return true;
  if (matchFunctionalClasses(candidate).length > 0) return true;
  return false;
}

export interface UnmappedCandidate {
  value: string;
  kind: "meal_token" | "medication" | "supplement";
  count: number;
  highRiskCount: number;
  sampleCheckIds: string[];
  /** Phase 11.3 evidence fields */
  firstSeenAt: string;
  lastSeenAt: string;
  examples: string[];
  sources: Record<string, number>;
  riskRate: number;
}

export interface UnmappedDiscoveryOptions {
  profileId: string;
  windowHours?: number;
  limit?: number;
}

export interface UnmappedDiscoveryResult {
  profileId: string;
  windowHours: number;
  candidates: UnmappedCandidate[];
}

/** Check row shape (minimal for discovery). */
export interface MockCheck {
  id: string;
  verdict?: { riskLevel?: string };
}

/** Event row shape (minimal for discovery). created_at required for evidence. */
export interface MockEvent {
  check_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  /** ISO timestamp; fallback to epoch when missing for backward compat */
  created_at?: string;
}

/** Aggregation value with evidence accumulation. */
interface AggValue {
  kind: UnmappedCandidate["kind"];
  count: number;
  highRiskCount: number;
  sampleCheckIds: Set<string>;
  firstTs: string;
  lastTs: string;
  examplesByType: Map<string, Map<string, string>>;
  sources: { meal: number; supplement: number; medication: number };
}

const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

function addExample(
  examplesByType: Map<string, Map<string, string>>,
  eventType: string,
  example: string,
  ts: string
): void {
  let typeMap = examplesByType.get(eventType);
  if (!typeMap) {
    typeMap = new Map();
    examplesByType.set(eventType, typeMap);
  }
  const existing = typeMap.get(example);
  if (!existing || ts < existing) {
    typeMap.set(example, ts);
  }
}

function initSources(): { meal: number; supplement: number; medication: number } {
  return { meal: 0, supplement: 0, medication: 0 };
}

/**
 * Run discovery on pre-fetched checks + events. Used for testing with fixtures.
 * Evidence: firstSeenAt, lastSeenAt, examples (kind-isolated), sources, riskRate.
 */
export function discoverUnmappedFromRecords(
  profileId: string,
  checks: MockCheck[],
  events: MockEvent[],
  limit = 20
): UnmappedDiscoveryResult {
  const verdictMap = new Map<string, { riskLevel?: string }>();
  for (const c of checks) {
    verdictMap.set(c.id, c.verdict ?? {});
  }

  const agg = new Map<string, AggValue>();

  for (const ev of events) {
    const checkId = ev.check_id;
    const ts = ev.created_at ?? EPOCH_ISO;
    const verdict = verdictMap.get(checkId);
    const riskLevel = verdict?.riskLevel ?? "none";
    const isHighRisk = riskLevel === "high" || riskLevel === "medium";
    const data = ev.event_data ?? {};

    if (ev.event_type === "medication") {
      const v = data.medication;
      if (typeof v === "string" && v.trim()) {
        const key = normalizeToken(v);
        if (!key) continue;
        if (!isMapped(key)) {
          const cur = agg.get(key);
          const example = v.trim();
          if (cur) {
            cur.count++;
            if (isHighRisk) cur.highRiskCount++;
            cur.sampleCheckIds.add(checkId);
            if (ts < cur.firstTs) cur.firstTs = ts;
            if (ts > cur.lastTs) cur.lastTs = ts;
            addExample(cur.examplesByType, "medication", example, ts);
            cur.sources.medication++;
          } else {
            agg.set(key, {
              kind: "medication",
              count: 1,
              highRiskCount: isHighRisk ? 1 : 0,
              sampleCheckIds: new Set([checkId]),
              firstTs: ts,
              lastTs: ts,
              examplesByType: new Map(),
              sources: { ...initSources(), medication: 1 },
            });
            addExample(agg.get(key)!.examplesByType, "medication", example, ts);
          }
        }
      }
    } else if (ev.event_type === "supplement") {
      const v = (data.supplement ?? data.name) as string | undefined;
      if (typeof v === "string" && v.trim()) {
        const key = normalizeToken(v);
        if (!key) continue;
        if (!isMapped(key)) {
          const cur = agg.get(key);
          const example = v.trim();
          if (cur) {
            cur.count++;
            if (isHighRisk) cur.highRiskCount++;
            cur.sampleCheckIds.add(checkId);
            if (ts < cur.firstTs) cur.firstTs = ts;
            if (ts > cur.lastTs) cur.lastTs = ts;
            addExample(cur.examplesByType, "supplement", example, ts);
            cur.sources.supplement++;
          } else {
            agg.set(key, {
              kind: "supplement",
              count: 1,
              highRiskCount: isHighRisk ? 1 : 0,
              sampleCheckIds: new Set([checkId]),
              firstTs: ts,
              lastTs: ts,
              examplesByType: new Map(),
              sources: { ...initSources(), supplement: 1 },
            });
            addExample(agg.get(key)!.examplesByType, "supplement", example, ts);
          }
        }
      }
    } else if (ev.event_type === "meal") {
      const meal = data.meal;
      if (typeof meal === "string" && meal.trim()) {
        const tokensWithRaw = tokenizeMealWithRaw(meal);
        for (const { canonical, raw } of tokensWithRaw) {
          const key = normalizeToken(canonical);
          if (!key) continue;
          if (!isMapped(key)) {
            const cur = agg.get(key);
            const example = raw;
            if (cur) {
              cur.count++;
              if (isHighRisk) cur.highRiskCount++;
              cur.sampleCheckIds.add(checkId);
              if (ts < cur.firstTs) cur.firstTs = ts;
              if (ts > cur.lastTs) cur.lastTs = ts;
              addExample(cur.examplesByType, "meal", example, ts);
              cur.sources.meal++;
            } else {
              agg.set(key, {
                kind: "meal_token",
                count: 1,
                highRiskCount: isHighRisk ? 1 : 0,
                sampleCheckIds: new Set([checkId]),
                firstTs: ts,
                lastTs: ts,
                examplesByType: new Map(),
                sources: { ...initSources(), meal: 1 },
              });
              addExample(agg.get(key)!.examplesByType, "meal", example, ts);
            }
          }
        }
      }
    }
  }

  const candidates: UnmappedCandidate[] = Array.from(agg.entries())
    .map(([value, v]) => {
      const evidence = buildEvidence({
        kind: v.kind,
        count: v.count,
        highRiskCount: v.highRiskCount,
        firstTs: v.firstTs,
        lastTs: v.lastTs,
        examplesByType: v.examplesByType,
        sources: v.sources,
      });
      return {
        value,
        kind: v.kind,
        count: v.count,
        highRiskCount: v.highRiskCount,
        sampleCheckIds: Array.from(v.sampleCheckIds),
        firstSeenAt: evidence.firstSeenAt,
        lastSeenAt: evidence.lastSeenAt,
        examples: evidence.examples,
        sources: evidence.sources,
        riskRate: evidence.riskRate,
      };
    })
    .filter((c) => {
      // Actionability filter: meal_token only; include if highRiskCount >= 1 OR count >= 3
      if (c.kind === "meal_token") {
        return c.highRiskCount >= 1 || c.count >= 3;
      }
      return true;
    })
    .sort((a, b) => {
      // Ranking: highRiskCount desc, riskRate desc, count desc, lastSeenAt desc, candidate asc.
      // Tie-breakers ensure deterministic "rare-but-deadly" ordering; final candidate asc is stable.
      if (b.highRiskCount !== a.highRiskCount) return b.highRiskCount - a.highRiskCount;
      if (b.riskRate !== a.riskRate) return b.riskRate > a.riskRate ? 1 : b.riskRate < a.riskRate ? -1 : 0;
      if (b.count !== a.count) return b.count - a.count;
      const lastCmp = b.lastSeenAt.localeCompare(a.lastSeenAt);
      if (lastCmp !== 0) return lastCmp;
      return a.value.localeCompare(b.value);
    })
    .slice(0, limit);

  return { profileId, windowHours: 168, candidates };
}

export async function discoverUnmapped(
  options: UnmappedDiscoveryOptions
): Promise<UnmappedDiscoveryResult> {
  const { profileId } = options;
  const windowHours = options.windowHours ?? 168;
  const limit = options.limit ?? 20;

  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  // Fetch checks with verdict for profile within window
  const { data: checks, error: checksError } = await supabase
    .from("checks")
    .select("id, verdict")
    .eq("profile_id", profileId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (checksError) {
    throw new Error(`checks query failed: ${checksError.message}`);
  }

  if (!checks || checks.length === 0) {
    return { profileId, windowHours, candidates: [] };
  }

  const checkIds = checks.map((c: { id: string }) => c.id);

  const { data: events, error: eventsError } = await supabase
    .from("health_events")
    .select("check_id, event_type, event_data, created_at")
    .in("check_id", checkIds);

  if (eventsError) {
    throw new Error(`health_events query failed: ${eventsError.message}`);
  }

  const mockChecks: MockCheck[] = checks as { id: string; verdict?: { riskLevel?: string } }[];
  const mockEvents: MockEvent[] = (events ?? []).map(
    (e: {
      check_id: string;
      event_type: string;
      event_data: Record<string, unknown>;
      created_at?: string;
    }) => ({
      check_id: e.check_id,
      event_type: e.event_type,
      event_data: e.event_data ?? {},
      created_at: e.created_at,
    })
  );

  const result = discoverUnmappedFromRecords(profileId, mockChecks, mockEvents, limit);
  return { ...result, windowHours };
}
