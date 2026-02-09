/**
 * Phase 10A/10B/10C – Trajectory & Sequence Inference
 *
 * Detects temporal patterns across a profile's time-ordered checks and events.
 * Produces computed insights — never persists new state or mutates the profile.
 *
 * Pattern detectors (all deterministic, no ML):
 *
 *   A) Trigger → Symptom   – A meal/supplement/medication followed by a symptom
 *                             within a configurable hour window.
 *   B) Repeated Symptom    – The same symptom appearing ≥ minOccurrences times
 *                             within the window.
 *   C) Medication → Symptom – A medication ingestion followed by a symptom cluster
 *                             (≥ 2 distinct symptoms) within the window.
 *
 * Phase 10C – Data Hygiene:
 *   - Proximity gating: trigger_symptom includes proximityBucket + hoursDelta;
 *     weak associations are gated unless allergen-related or unique trigger.
 *   - Cluster suppression: trigger_symptom pairs fully covered by a
 *     medication_symptom_cluster are suppressed.
 *   - Dedup: trigger_symptom deduped by (trigger, symptom), keeping strongest bucket.
 *   - Default minOccurrences bumped to 3 for repeated_symptom.
 *   - whyIncluded: every insight carries an explainable filter-pass array.
 *
 * Every insight includes the supporting check IDs so the UI can link back to
 * the original evidence.
 */

import { getSupabaseClient } from "../supabaseClient.js";

// ── Types ────────────────────────────────────────────────────────────

export interface TrajectoryInput {
  profileId: string;
  /** How far back to look, in hours (default 48) */
  windowHours?: number;
  /** Minimum occurrences for the "repeated symptom" detector (default 3) */
  minOccurrences?: number;
  /** Profile's known allergens — used for scoring + gating (default []) */
  knownAllergies?: string[];
}

export interface PriorityHints {
  triggerKind?: "meal" | "medication" | "supplement";
  triggerValue?: string;
  symptomValue?: string;
}

export type ProximityBucket = "strong" | "medium" | "weak";

export interface Insight {
  type: "trigger_symptom" | "repeated_symptom" | "medication_symptom_cluster";
  label: string;
  description: string;
  supportingEvents: string[]; // check_ids
  supportingEventCount: number;
  priorityHints: PriorityHints;
  score: number;
  /** Only for trigger_symptom: 0–6h = strong, 6–12h = medium, 12–48h = weak */
  proximityBucket?: ProximityBucket;
  /** Only for trigger_symptom: hours between trigger and symptom */
  hoursDelta?: number;
  /** Explainable: which hygiene filter(s) this insight passed to be included */
  whyIncluded: string[];
}

export interface TrajectoryResult {
  profileId: string;
  windowHours: number;
  analyzedChecks: number;
  insights: Insight[];
}

/** A flattened row joining checks + health_events. */
interface TimelineEvent {
  check_id: string;
  check_created_at: string;
  event_type: string;
  event_data: Record<string, unknown>;
}

/** Internal insight before scoring is applied. */
interface RawInsight {
  type: Insight["type"];
  label: string;
  description: string;
  supportingEvents: string[];
  priorityHints: PriorityHints;
  proximityBucket?: ProximityBucket;
  hoursDelta?: number;
  whyIncluded: string[];
}

/** Candidate pair from trigger_symptom detector (before gating/dedup). */
interface TriggerSymptomCandidate {
  triggerCheckId: string;
  symptomCheckId: string;
  triggerLabel: string;
  symptomLabel: string;
  triggerType: string;
  hoursDelta: number;
  proximityBucket: ProximityBucket;
}

// ── Helpers ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function stripTrailingS(s: string): string {
  return s.endsWith("s") ? s.slice(0, -1) : s;
}

function hoursBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60);
}

/** Extract a human-readable name from an event's data based on its type. */
function eventLabel(ev: TimelineEvent): string {
  const d = ev.event_data;
  switch (ev.event_type) {
    case "meal":
      return String(d.meal ?? "unknown meal");
    case "medication":
      return String(d.medication ?? "unknown medication");
    case "supplement":
      return String(d.supplement ?? "unknown supplement");
    case "symptom":
      return String(d.symptom ?? "unknown symptom");
    default:
      return ev.event_type;
  }
}

/** Check whether a string contains any known allergen term (case-insensitive, plural-aware). */
function containsAllergen(text: string, allergens: string[]): boolean {
  const t = normalize(text);
  for (const allergen of allergens) {
    const term = normalize(allergen);
    if (t.includes(term) || t.includes(stripTrailingS(term))) {
      return true;
    }
  }
  return false;
}

function proximityBucketFor(hours: number): ProximityBucket {
  if (hours <= 6) return "strong";
  if (hours <= 12) return "medium";
  return "weak";
}

const BUCKET_RANK: Record<ProximityBucket, number> = {
  strong: 3,
  medium: 2,
  weak: 1,
};

// ── Data loader ──────────────────────────────────────────────────────

async function loadTimeline(
  profileId: string,
  windowHours: number
): Promise<{ timeline: TimelineEvent[]; checkCount: number }> {
  const supabase = getSupabaseClient();

  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  const { data: checks, error: checksError } = await supabase
    .from("checks")
    .select("id, created_at")
    .eq("profile_id", profileId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true });

  if (checksError) {
    throw new Error(`Trajectory: checks query failed: ${checksError.message}`);
  }

  if (!checks || checks.length === 0) {
    return { timeline: [], checkCount: 0 };
  }

  const checkIds = checks.map((c: any) => c.id);
  const checkTimeMap = new Map<string, string>(
    checks.map((c: any) => [c.id, c.created_at])
  );

  const { data: events, error: eventsError } = await supabase
    .from("health_events")
    .select("check_id, event_type, event_data")
    .in("check_id", checkIds);

  if (eventsError) {
    throw new Error(`Trajectory: health_events query failed: ${eventsError.message}`);
  }

  const timeline: TimelineEvent[] = (events ?? [])
    .map((ev: any) => ({
      check_id: ev.check_id,
      check_created_at: checkTimeMap.get(ev.check_id) ?? "",
      event_type: ev.event_type,
      event_data: ev.event_data ?? {},
    }))
    .sort(
      (a, b) =>
        new Date(a.check_created_at).getTime() - new Date(b.check_created_at).getTime()
    );

  return { timeline, checkCount: checks.length };
}

// ── Detector A: Trigger → Symptom (with proximity + gating) ─────────

function detectTriggerSymptom(
  timeline: TimelineEvent[],
  windowHours: number,
  knownAllergies: string[]
): RawInsight[] {
  const triggerTypes = new Set(["meal", "medication", "supplement"]);
  const triggers = timeline.filter((ev) => triggerTypes.has(ev.event_type));
  const symptoms = timeline.filter((ev) => ev.event_type === "symptom");

  // ── Step 1: Collect ALL candidates with proximity ──────────────────
  const candidates: TriggerSymptomCandidate[] = [];

  for (const trigger of triggers) {
    for (const symptom of symptoms) {
      if (new Date(symptom.check_created_at) <= new Date(trigger.check_created_at))
        continue;

      const delta = hoursBetween(trigger.check_created_at, symptom.check_created_at);
      if (delta > windowHours) continue;

      candidates.push({
        triggerCheckId: trigger.check_id,
        symptomCheckId: symptom.check_id,
        triggerLabel: eventLabel(trigger),
        symptomLabel: eventLabel(symptom),
        triggerType: trigger.event_type,
        hoursDelta: Math.round(delta * 100) / 100,
        proximityBucket: proximityBucketFor(delta),
      });
    }
  }

  // ── Step 2: Dedup by (normalizedTrigger, normalizedSymptom), keep strongest ──
  const deduped = new Map<string, TriggerSymptomCandidate>();

  for (const c of candidates) {
    const key = `${normalize(c.triggerLabel)}→${normalize(c.symptomLabel)}`;
    const existing = deduped.get(key);
    if (
      !existing ||
      BUCKET_RANK[c.proximityBucket] > BUCKET_RANK[existing.proximityBucket]
    ) {
      deduped.set(key, c);
    }
  }

  // ── Step 3: Count trigger occurrences for uniqueness check ─────────
  const triggerCounts = new Map<string, number>();
  for (const trigger of triggers) {
    const key = normalize(eventLabel(trigger));
    triggerCounts.set(key, (triggerCounts.get(key) ?? 0) + 1);
  }

  // ── Step 4: Apply gating rules ─────────────────────────────────────
  const insights: RawInsight[] = [];

  for (const [, c] of deduped) {
    const whyIncluded: string[] = [];
    const isAllergenRelated =
      c.triggerType === "meal" &&
      knownAllergies.length > 0 &&
      containsAllergen(c.triggerLabel, knownAllergies);

    const isUniqueTrigger =
      (triggerCounts.get(normalize(c.triggerLabel)) ?? 0) <= 1;

    // Gate: at least one condition must pass
    if (c.proximityBucket === "strong") {
      whyIncluded.push("proximity_strong");
    }
    if (isAllergenRelated) {
      whyIncluded.push("allergen_related");
    }
    if (isUniqueTrigger) {
      whyIncluded.push("unique_trigger");
    }

    // If no gating rule passed, skip this insight
    if (whyIncluded.length === 0) continue;

    const typeLabel =
      c.triggerType === "meal"
        ? "Meal"
        : c.triggerType === "medication"
          ? "Medication"
          : "Supplement";

    insights.push({
      type: "trigger_symptom",
      label: `${typeLabel} → Symptom`,
      description: `${typeLabel} "${c.triggerLabel}" was followed by "${c.symptomLabel}" within ${c.hoursDelta}h (${c.proximityBucket}).`,
      supportingEvents: [...new Set([c.triggerCheckId, c.symptomCheckId])],
      priorityHints: {
        triggerKind: c.triggerType as "meal" | "medication" | "supplement",
        triggerValue: c.triggerLabel,
        symptomValue: c.symptomLabel,
      },
      proximityBucket: c.proximityBucket,
      hoursDelta: c.hoursDelta,
      whyIncluded,
    });
  }

  return insights;
}

// ── Detector B: Repeated Symptom ─────────────────────────────────────

function detectRepeatedSymptom(
  timeline: TimelineEvent[],
  windowHours: number,
  minOccurrences: number
): RawInsight[] {
  const insights: RawInsight[] = [];
  const symptoms = timeline.filter((ev) => ev.event_type === "symptom");

  const groups = new Map<string, { label: string; checkIds: Set<string> }>();

  for (const sym of symptoms) {
    const key = normalize(eventLabel(sym));
    if (!groups.has(key)) {
      groups.set(key, { label: eventLabel(sym), checkIds: new Set() });
    }
    groups.get(key)!.checkIds.add(sym.check_id);
  }

  for (const [, group] of groups) {
    if (group.checkIds.size >= minOccurrences) {
      insights.push({
        type: "repeated_symptom",
        label: "Repeated Symptom",
        description: `"${group.label}" occurred ${group.checkIds.size} times within the ${windowHours}-hour window.`,
        supportingEvents: Array.from(group.checkIds),
        priorityHints: {
          symptomValue: group.label,
        },
        whyIncluded: [`occurred_${group.checkIds.size}_times_gte_${minOccurrences}`],
      });
    }
  }

  return insights;
}

// ── Detector C: Medication → Symptom Cluster ─────────────────────────

interface ClusterDetectorResult {
  insights: RawInsight[];
  /** Keys like "normalizedMed→normalizedSymptom" for suppressing pairwise duplicates */
  suppressionKeys: Set<string>;
}

function detectMedicationSymptomCluster(
  timeline: TimelineEvent[],
  windowHours: number
): ClusterDetectorResult {
  const insights: RawInsight[] = [];
  const suppressionKeys = new Set<string>();

  const meds = timeline.filter((ev) => ev.event_type === "medication");
  const symptoms = timeline.filter((ev) => ev.event_type === "symptom");

  for (const med of meds) {
    const medLabel = eventLabel(med);
    const normalizedMed = normalize(medLabel);
    const following: TimelineEvent[] = [];

    for (const sym of symptoms) {
      if (new Date(sym.check_created_at) <= new Date(med.check_created_at)) continue;
      const gap = hoursBetween(med.check_created_at, sym.check_created_at);
      if (gap <= windowHours) {
        following.push(sym);
      }
    }

    const distinctSymptoms = new Set(following.map((s) => normalize(eventLabel(s))));
    if (distinctSymptoms.size >= 2) {
      const checkIds = new Set([med.check_id, ...following.map((s) => s.check_id)]);
      const symptomNames = Array.from(distinctSymptoms).join(", ");

      // Build suppression keys for each med→symptom pair covered by this cluster
      for (const sym of distinctSymptoms) {
        suppressionKeys.add(`${normalizedMed}→${sym}`);
      }

      insights.push({
        type: "medication_symptom_cluster",
        label: "Medication → Symptom Cluster",
        description: `"${medLabel}" was followed by ${distinctSymptoms.size} distinct symptoms (${symptomNames}) within the ${windowHours}-hour window.`,
        supportingEvents: Array.from(checkIds),
        priorityHints: {
          triggerKind: "medication",
          triggerValue: medLabel,
        },
        whyIncluded: [`cluster_${distinctSymptoms.size}_distinct_symptoms`],
      });
    }
  }

  return { insights, suppressionKeys };
}

// ── Cluster Suppression ──────────────────────────────────────────────

/**
 * Remove trigger_symptom insights where triggerKind=medication and the
 * (trigger, symptom) pair is already covered by a medication_symptom_cluster.
 */
function applyClustersuppression(
  triggerInsights: RawInsight[],
  suppressionKeys: Set<string>
): RawInsight[] {
  if (suppressionKeys.size === 0) return triggerInsights;

  return triggerInsights.filter((ins) => {
    if (ins.priorityHints.triggerKind !== "medication") return true;

    const key = `${normalize(ins.priorityHints.triggerValue ?? "")}→${normalize(ins.priorityHints.symptomValue ?? "")}`;
    if (suppressionKeys.has(key)) {
      // Suppressed: this pairwise insight is subsumed by a cluster
      return false;
    }
    return true;
  });
}

// ── Scoring ──────────────────────────────────────────────────────────

const BASE_SCORES: Record<Insight["type"], number> = {
  medication_symptom_cluster: 60,
  trigger_symptom: 40,
  repeated_symptom: 20,
};

function scoreInsight(raw: RawInsight, knownAllergies: string[]): Insight {
  let score = BASE_SCORES[raw.type] ?? 0;

  const supportingEventCount = raw.supportingEvents.length;

  // +10 if 3 or more supporting checks
  if (supportingEventCount >= 3) {
    score += 10;
  }

  // +10 if trigger is a meal and its value contains a known allergen
  if (
    raw.priorityHints.triggerKind === "meal" &&
    raw.priorityHints.triggerValue &&
    knownAllergies.length > 0 &&
    containsAllergen(raw.priorityHints.triggerValue, knownAllergies)
  ) {
    score += 10;
  }

  return {
    ...raw,
    supportingEventCount,
    score,
  };
}

// ── Main ─────────────────────────────────────────────────────────────

export async function analyzeTrajectory(
  input: TrajectoryInput
): Promise<TrajectoryResult> {
  const windowHours = input.windowHours ?? 48;
  const minOccurrences = input.minOccurrences ?? 3; // Phase 10C: bumped from 2 to 3
  const knownAllergies = input.knownAllergies ?? [];

  const { timeline, checkCount } = await loadTimeline(input.profileId, windowHours);

  if (timeline.length === 0) {
    return {
      profileId: input.profileId,
      windowHours,
      analyzedChecks: 0,
      insights: [],
    };
  }

  // ── Run detectors ──────────────────────────────────────────────────

  // 1. Trigger → Symptom (with proximity gating + dedup)
  let triggerInsights = detectTriggerSymptom(timeline, windowHours, knownAllergies);

  // 2. Repeated Symptom
  const repeatedInsights = detectRepeatedSymptom(timeline, windowHours, minOccurrences);

  // 3. Medication → Symptom Cluster (also produces suppression keys)
  const { insights: clusterInsights, suppressionKeys } =
    detectMedicationSymptomCluster(timeline, windowHours);

  // ── Post-processing: cluster suppression ───────────────────────────
  triggerInsights = applyClustersuppression(triggerInsights, suppressionKeys);

  // ── Combine, score, and sort ───────────────────────────────────────
  const allRaw: RawInsight[] = [
    ...triggerInsights,
    ...repeatedInsights,
    ...clusterInsights,
  ];

  const insights: Insight[] = allRaw
    .map((r) => scoreInsight(r, knownAllergies))
    .sort(
      (a, b) => b.score - a.score || b.supportingEventCount - a.supportingEventCount
    );

  return {
    profileId: input.profileId,
    windowHours,
    analyzedChecks: checkCount,
    insights,
  };
}
