/**
 * Phase 10G – Functional Stacking Detector
 *
 * Detects when ≥2 ingestibles from the same functional class occur within
 * a single check.  Emits deterministic `functional_stacking` insights
 * that can be merged into the insights feed alongside trajectory-derived
 * insights.
 *
 * Architecture:
 *   - Standalone module — does NOT modify analyzeTrajectory.ts.
 *   - Queries Supabase directly (read-only) for checks + health_events.
 *   - Uses the functional-class registry for matching.
 *
 * Matching scope:
 *   - medication events  → event_data.medication
 *   - supplement events  → event_data.supplement OR event_data.name (defensive)
 *   - meal events        → ignored (unless explicitly opted in later)
 */

import { getSupabaseClient } from "../supabaseClient.js";
import {
  matchFunctionalClasses,
  FUNCTIONAL_CLASS_REGISTRY,
  type FunctionalClassKey,
} from "./functionalClasses.js";

// ── Types ────────────────────────────────────────────────────────────

export interface StackingInput {
  profileId: string;
  /** How far back to look, in hours (default 48). */
  windowHours?: number;
}

export interface StackingInsight {
  type: "functional_stacking";
  label: string;
  description: string;
  /** check_ids where the stacking was observed. */
  supportingEvents: string[];
  supportingEventCount: number;
  /** Metadata for downstream scoring / UI. */
  meta: {
    classKey: FunctionalClassKey;
    items: string[];
    matchedBy: "registry";
  };
  /** Populated during scoring in feed.ts — left undefined here. */
  score?: number;
  priorityHints: Record<string, unknown>;
  whyIncluded: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Extract the human-readable ingestible name from an event row.
 * Returns null for non-ingestible event types.
 */
function extractIngestibleName(
  eventType: string,
  eventData: Record<string, unknown>,
): string | null {
  switch (eventType) {
    case "medication":
      return eventData.medication
        ? String(eventData.medication)
        : null;
    case "supplement":
      // Defensive: accept both "supplement" and "name" keys
      return eventData.supplement
        ? String(eventData.supplement)
        : eventData.name
          ? String(eventData.name)
          : null;
    default:
      // Meals explicitly excluded for stacking detection
      return null;
  }
}

// ── Main detector ────────────────────────────────────────────────────

export async function detectFunctionalStacking(
  input: StackingInput,
): Promise<StackingInsight[]> {
  const { profileId, windowHours = 48 } = input;
  const supabase = getSupabaseClient();

  const cutoff = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();

  // ── 1. Fetch checks in window ────────────────────────────────────
  const { data: checks, error: checksErr } = await supabase
    .from("checks")
    .select("id, created_at")
    .eq("profile_id", profileId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true });

  if (checksErr) {
    throw new Error(
      `detectFunctionalStacking: checks query failed: ${checksErr.message}`,
    );
  }

  if (!checks || checks.length === 0) return [];

  const checkIds = checks.map((c: any) => c.id);

  // ── 2. Fetch health events for those checks ──────────────────────
  const { data: events, error: eventsErr } = await supabase
    .from("health_events")
    .select("check_id, event_type, event_data")
    .in("check_id", checkIds);

  if (eventsErr) {
    throw new Error(
      `detectFunctionalStacking: health_events query failed: ${eventsErr.message}`,
    );
  }

  if (!events || events.length === 0) return [];

  // ── 3. Group events by check_id ──────────────────────────────────
  const eventsByCheck = new Map<
    string,
    { event_type: string; event_data: Record<string, unknown> }[]
  >();

  for (const ev of events as any[]) {
    const list = eventsByCheck.get(ev.check_id) ?? [];
    list.push({
      event_type: ev.event_type,
      event_data: ev.event_data ?? {},
    });
    eventsByCheck.set(ev.check_id, list);
  }

  // ── 4. For each check, detect stacking ───────────────────────────
  const insights: StackingInsight[] = [];

  for (const checkId of checkIds) {
    const checkEvents = eventsByCheck.get(checkId);
    if (!checkEvents) continue;

    // Map: FunctionalClassKey → Set<item name>
    const classItems = new Map<FunctionalClassKey, Set<string>>();

    for (const ev of checkEvents) {
      const name = extractIngestibleName(ev.event_type, ev.event_data);
      if (!name) continue;

      const classes = matchFunctionalClasses(name);
      for (const cls of classes) {
        const items = classItems.get(cls) ?? new Set<string>();
        items.add(name);
        classItems.set(cls, items);
      }
    }

    // Emit an insight for each class with ≥2 distinct matched items
    for (const [classKey, items] of classItems) {
      if (items.size < 2) continue;

      const entry = FUNCTIONAL_CLASS_REGISTRY[classKey];
      const itemList = Array.from(items);
      const exampleA = itemList[0];
      const exampleB = itemList[1];

      insights.push({
        type: "functional_stacking",
        label: `Functional Stack Detected: ${entry.label}`,
        description: `Multiple items with ${entry.label} properties taken together (e.g., ${exampleA} + ${exampleB}).`,
        supportingEvents: [checkId],
        supportingEventCount: 1,
        meta: {
          classKey,
          items: itemList,
          matchedBy: "registry",
        },
        priorityHints: {
          classKey,
          items: itemList,
        },
        whyIncluded: [
          `functional_stack_${classKey}_${items.size}_items`,
        ],
      });
    }
  }

  return insights;
}
