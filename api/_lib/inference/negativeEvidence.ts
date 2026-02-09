/**
 * Phase 10E – Negative Evidence & Rate-of-Association
 *
 * Computes per-trigger "exposure vs hit" ratios from the raw timeline,
 * enabling the insights feed to penalise spurious correlations and boost
 * genuine associations.
 *
 * All data comes from the existing `checks` + `health_events` tables
 * (read-only — no mutations, no schema changes).
 *
 * Key concepts:
 *   exposures(triggerKey)          – number of ingestible events for that trigger
 *   hits(triggerKey, symptomKey)   – symptom events within ≤ 12 h after that trigger
 *   baselineSymptomRate(symptomKey)– symptom count / total ingestible events in window
 *   lift                           – (hits / exposures) / baselineSymptomRate
 *                                    (guarded against divide-by-zero)
 */

import { getSupabaseClient } from "../supabaseClient.js";

// ── Types ────────────────────────────────────────────────────────────

/** A lightweight timeline row (only the columns we need). */
interface TimelineRow {
  check_id: string;
  created_at: string;
  event_type: string;
  event_data: Record<string, unknown>;
}

export interface EvidenceStats {
  exposures: number;
  hits: number;
  lift: number;
}

/**
 * Pre-loaded evidence context for a profile + window.
 * Call `getEvidence(triggerKey, symptomKey)` to look up a specific pair.
 */
export interface EvidenceContext {
  /** Total ingestible events (meal + medication + supplement) in window. */
  totalIngestibles: number;
  /** Look up exposure/hit/lift for a trigger→symptom pair. */
  getEvidence: (triggerKey: string, symptomKey: string) => EvidenceStats;
}

// ── Constants ────────────────────────────────────────────────────────

const INGESTIBLE_TYPES = new Set(["meal", "medication", "supplement"]);

/** Maximum hours between trigger and symptom to count as a "hit". */
const HIT_WINDOW_HOURS = 12;

// ── Helpers ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function eventLabel(row: TimelineRow): string {
  const d = row.event_data;
  switch (row.event_type) {
    case "meal":
      return String(d.meal ?? "unknown meal");
    case "medication":
      return String(d.medication ?? "unknown medication");
    case "supplement":
      return String(d.supplement ?? "unknown supplement");
    case "symptom":
      return String(d.symptom ?? "unknown symptom");
    default:
      return row.event_type;
  }
}

// ── Data loader ──────────────────────────────────────────────────────

async function loadTimeline(
  profileId: string,
  windowHours: number,
): Promise<TimelineRow[]> {
  const supabase = getSupabaseClient();
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  // Fetch check ids + timestamps in one go
  const { data: checks, error: checksErr } = await supabase
    .from("checks")
    .select("id, created_at")
    .eq("profile_id", profileId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true });

  if (checksErr) {
    throw new Error(`negativeEvidence: checks query failed: ${checksErr.message}`);
  }
  if (!checks || checks.length === 0) return [];

  const checkIds = checks.map((c: any) => c.id);
  const timeMap = new Map<string, string>(
    checks.map((c: any) => [c.id, c.created_at]),
  );

  // Fetch only the columns we need from health_events
  const { data: events, error: eventsErr } = await supabase
    .from("health_events")
    .select("check_id, event_type, event_data")
    .in("check_id", checkIds);

  if (eventsErr) {
    throw new Error(`negativeEvidence: health_events query failed: ${eventsErr.message}`);
  }

  return (events ?? []).map((ev: any) => ({
    check_id: ev.check_id,
    created_at: timeMap.get(ev.check_id) ?? "",
    event_type: ev.event_type,
    event_data: ev.event_data ?? {},
  }));
}

// ── Main: build evidence context ─────────────────────────────────────

/**
 * Load the raw timeline for a profile + window and return a context
 * object that can answer exposure/hit/lift queries in O(1).
 *
 * The heavy work (two Supabase queries + building the lookup maps)
 * happens once; subsequent `getEvidence()` calls are pure lookups.
 */
export async function buildEvidenceContext(
  profileId: string,
  windowHours: number,
): Promise<EvidenceContext> {
  const timeline = await loadTimeline(profileId, windowHours);

  // ── Partition into ingestibles and symptoms ────────────────────────
  const ingestibles: TimelineRow[] = [];
  const symptoms: TimelineRow[] = [];

  for (const row of timeline) {
    if (INGESTIBLE_TYPES.has(row.event_type)) {
      ingestibles.push(row);
    } else if (row.event_type === "symptom") {
      symptoms.push(row);
    }
  }

  const totalIngestibles = ingestibles.length;

  // ── exposures: count per normalised trigger label ──────────────────
  const exposureMap = new Map<string, number>();
  for (const ing of ingestibles) {
    const key = normalize(eventLabel(ing));
    exposureMap.set(key, (exposureMap.get(key) ?? 0) + 1);
  }

  // ── baselineSymptomRate: per normalised symptom label ──────────────
  //    rate = symptomCount / totalIngestibles  (or 0 if no ingestibles)
  const symptomCountMap = new Map<string, number>();
  for (const sym of symptoms) {
    const key = normalize(eventLabel(sym));
    symptomCountMap.set(key, (symptomCountMap.get(key) ?? 0) + 1);
  }

  // ── hits: for each (trigger, symptom) pair, count symptom occurrences
  //    within HIT_WINDOW_HOURS after the trigger ─────────────────────
  const hitMap = new Map<string, number>();

  // Sort both arrays by time for efficient scanning
  ingestibles.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  symptoms.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const hitWindowMs = HIT_WINDOW_HOURS * 60 * 60 * 1000;

  for (const ing of ingestibles) {
    const ingTime = new Date(ing.created_at).getTime();
    const triggerKey = normalize(eventLabel(ing));

    for (const sym of symptoms) {
      const symTime = new Date(sym.created_at).getTime();
      // Symptom must come after the trigger
      if (symTime <= ingTime) continue;
      // Past the hit window — since symptoms are sorted, no point continuing
      if (symTime - ingTime > hitWindowMs) break;

      const symptomKey = normalize(eventLabel(sym));
      const pairKey = `${triggerKey}\0${symptomKey}`;
      hitMap.set(pairKey, (hitMap.get(pairKey) ?? 0) + 1);
    }
  }

  // ── Return context with O(1) lookup ────────────────────────────────
  return {
    totalIngestibles,

    getEvidence(triggerKey: string, symptomKey: string): EvidenceStats {
      const tKey = normalize(triggerKey);
      const sKey = normalize(symptomKey);
      const exposures = exposureMap.get(tKey) ?? 0;
      const hits = hitMap.get(`${tKey}\0${sKey}`) ?? 0;

      // baselineSymptomRate = symptom count / totalIngestibles
      const symptomCount = symptomCountMap.get(sKey) ?? 0;
      const baselineRate =
        totalIngestibles > 0 ? symptomCount / totalIngestibles : 0;

      // lift = (hits / exposures) / baselineRate, guarded
      let lift = 0;
      if (exposures > 0 && baselineRate > 0) {
        lift = hits / exposures / baselineRate;
      }

      // Round to 2 decimal places for readability
      lift = Math.round(lift * 100) / 100;

      return { exposures, hits, lift };
    },
  };
}
