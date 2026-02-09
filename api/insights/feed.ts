import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { analyzeTrajectory } from "../_lib/inference/analyzeTrajectory.js";
import { insightFingerprint } from "../_lib/inference/insightFingerprint.js";
import { buildEvidenceContext } from "../_lib/inference/negativeEvidence.js";
import type { EvidenceContext } from "../_lib/inference/negativeEvidence.js";
import { detectFunctionalStacking } from "../_lib/inference/detectFunctionalStacking.js";
import type { StackingInsight } from "../_lib/inference/detectFunctionalStacking.js";
import { getSupabaseClient } from "../_lib/supabaseClient.js";

/**
 * Vercel Serverless Function
 * GET /api/insights/feed
 *
 * Returns a ranked, scored "Top Insights" feed derived from the existing
 * trajectory analysis. The scoring is independent of (and overwrites)
 * the scores produced by analyzeTrajectory — the trajectory module is
 * called read-only and its insights are re-scored here.
 *
 * Query params:
 *   profileId   – required; returns 400 if missing
 *   windowHours – optional; default 48, max 168 (7 days)
 *   limit       – optional; default 20, max 100
 *
 * Scoring rules (deterministic):
 *   baseScore by insight.type:
 *     trigger_symptom            = 50
 *     medication_symptom_cluster = 60
 *     repeated_symptom           = 40
 *   Proximity bucket bonus (trigger_symptom only):
 *     strong +15, medium +5, weak +0
 *   Allergy-related terms in label or description:
 *     +25 if label/description contains peanut, nuts, allergen, allergy
 *   Cluster inherent bonus:
 *     +10 if type === medication_symptom_cluster
 *
 * Phase 10E – Negative Evidence adjustments (trigger_symptom only):
 *   +20 if exposures >= 3 AND lift >= 2.0
 *   -30 if exposures >= 5 AND hits === 0
 *   -10 if exposures < 3   (unless allergy-related → no penalty)
 *   Allergen-related insights are never suppressed.
 *
 * Phase 10F – Feedback Loop adjustments:
 *   +15 if user voted "relevant"
 *   -40 if user voted "not_relevant"
 *     0 if "unsure" or no vote
 *   Each insight includes fingerprint and userVote in the response.
 *
 * Phase 10G – Functional Stacking:
 *   Merges functional_stacking insights from detectFunctionalStacking().
 *   Base score = 75.
 *   +20 proximity bonus if a symptom occurs within 0–6h after the stacking check.
 *   Final score clamped to [0, 150].
 *   Optional scoreBreakdown when INSIGHTS_DEBUG="true".
 *
 * Sort order:
 *   1. score DESC
 *   2. supportingEvents.length ASC  (fewer = more selective = preferred)
 *   3. label+description string ASC (stable tie-breaker)
 *
 * Env vars (see .env.local):
 *   SUPABASE_URL              – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – service-role key
 */

// ── Scoring constants ────────────────────────────────────────────────

const FEED_BASE_SCORES: Record<string, number> = {
  trigger_symptom: 50,
  medication_symptom_cluster: 60,
  repeated_symptom: 40,
  functional_stacking: 75,
};

const PROXIMITY_BONUS: Record<string, number> = {
  strong: 15,
  medium: 5,
  weak: 0,
};

const ALLERGY_TERMS = ["peanut", "nuts", "allergen", "allergy"];

// Phase 10G: score clamp range
const SCORE_MIN = 0;
const SCORE_MAX = 150;

// Phase 10G: symptom proximity bonus window (hours)
const STACKING_PROXIMITY_WINDOW_HOURS = 6;
const STACKING_PROXIMITY_BONUS = 20;

// ── Helpers ──────────────────────────────────────────────────────────

function containsAllergyTerm(text: string): boolean {
  const lower = text.toLowerCase();
  return ALLERGY_TERMS.some((term) => lower.includes(term));
}

// ── Exported insight type (extends trajectory Insight with feed score) ─

interface InsightEvidence {
  exposures: number;
  hits: number;
  lift: number;
}

/** Phase 10G: optional debug breakdown of how a score was computed. */
interface ScoreBreakdown {
  base: number;
  proximityBonus: number;
  evidenceAdjust: number;
  voteAdjust: number;
  clampApplied: boolean;
}

interface FeedInsight {
  type: string;
  label: string;
  description: string;
  supportingEvents: string[];
  supportingEventCount: number;
  priorityHints: Record<string, unknown>;
  score: number;
  proximityBucket?: string;
  hoursDelta?: number;
  whyIncluded: string[];
  /** Phase 10E: exposure/hit/lift stats (trigger_symptom only). */
  evidence?: InsightEvidence;
  /** Phase 10F: stable insight identifier for feedback. */
  fingerprint: string;
  /** Phase 10F: user's existing vote, if any. */
  userVote?: string;
  /** Phase 10G: functional class metadata (functional_stacking only). */
  meta?: { classKey: string; items: string[]; matchedBy: string };
  /** Phase 10G: score breakdown (only when INSIGHTS_DEBUG=true). */
  scoreBreakdown?: ScoreBreakdown;
}

interface FeedResponse {
  profileId: string;
  windowHours: number;
  analyzedChecks: number;
  insights: FeedInsight[];
  /** Non-fatal warnings (e.g. evidence computation failed). */
  warnings?: string[];
}

// ── Handler ──────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }

  try {
    // ── Resolve profileId (required) ───────────────────────────────
    const profileId =
      typeof req.query.profileId === "string"
        ? req.query.profileId.trim()
        : "";

    if (!profileId) {
      return res.status(400).json({
        error: "Missing required query parameter: profileId",
        details: null,
      });
    }

    // ── Parse optional params ──────────────────────────────────────
    const windowHours = Math.min(
      Math.max(parseInt(String(req.query.windowHours), 10) || 48, 1),
      168,
    );

    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit), 10) || 20, 1),
      100,
    );

    // ── Fetch profile allergens (best-effort) ──────────────────────
    let knownAllergies: string[] = [];
    try {
      const supabase = getSupabaseClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("known_allergies")
        .eq("id", profileId)
        .maybeSingle();

      knownAllergies = profile?.known_allergies ?? [];
    } catch {
      console.warn("[InsightsFeed] Could not fetch profile allergens; continuing without.");
    }

    // ── Run trajectory analysis (read-only) ────────────────────────
    const trajectoryResult = await analyzeTrajectory({
      profileId,
      windowHours,
      knownAllergies,
    });

    // ── Phase 10E: build evidence context (best-effort) ─────────────
    let evidenceCtx: EvidenceContext | null = null;
    const warnings: string[] = [];

    try {
      evidenceCtx = await buildEvidenceContext(profileId, windowHours);
    } catch (evErr: any) {
      console.warn("[InsightsFeed] Evidence computation failed:", evErr?.message);
      warnings.push(`Evidence computation failed: ${evErr?.message ?? "unknown"}`);
    }

    // ── Phase 10G: detect functional stacking (best-effort) ──────────
    let stackingInsights: StackingInsight[] = [];

    try {
      stackingInsights = await detectFunctionalStacking({
        profileId,
        windowHours,
      });
    } catch (stackErr: any) {
      console.warn("[InsightsFeed] Functional stacking detection failed:", stackErr?.message);
      warnings.push(`Stacking detection failed: ${stackErr?.message ?? "unknown"}`);
    }

    // Phase 10G: preload symptom events for proximity scoring of stacking insights.
    // Map: check_id → earliest symptom timestamp within 6h after the check.
    let stackingCheckTimestamps = new Map<string, string>();
    let symptomEventsForProximity: { check_id: string; created_at: string; event_type: string }[] = [];

    if (stackingInsights.length > 0) {
      try {
        const supabase = getSupabaseClient();

        // Collect all check_ids referenced by stacking insights
        const stackCheckIds = [
          ...new Set(stackingInsights.flatMap((si) => si.supportingEvents)),
        ];

        // Fetch timestamps for those checks
        const { data: stackChecks } = await supabase
          .from("checks")
          .select("id, created_at")
          .in("id", stackCheckIds);

        if (stackChecks) {
          for (const c of stackChecks as any[]) {
            stackingCheckTimestamps.set(c.id, c.created_at);
          }
        }

        // Fetch symptom events for the profile in the window for proximity check
        const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
        const { data: symptomRows } = await supabase
          .from("health_events")
          .select("check_id, event_type, created_at")
          .eq("profile_id", profileId)
          .eq("event_type", "symptom")
          .gte("created_at", cutoff);

        if (symptomRows) {
          symptomEventsForProximity = symptomRows as any[];
        }
      } catch (proxErr: any) {
        console.warn("[InsightsFeed] Stacking proximity preload failed:", proxErr?.message);
      }
    }

    // ── Phase 10F: fetch existing votes (best-effort) ────────────────
    let votesMap: Record<string, string> = {};

    try {
      const supabase = getSupabaseClient();
      const { data: voteRows } = await supabase
        .from("insight_feedback")
        .select("insight_fingerprint, vote")
        .eq("profile_id", profileId)
        .limit(500);

      for (const row of voteRows ?? []) {
        votesMap[row.insight_fingerprint] = row.vote;
      }
    } catch (voteErr: any) {
      console.warn("[InsightsFeed] Feedback fetch failed:", voteErr?.message);
      warnings.push(`Feedback fetch failed: ${voteErr?.message ?? "unknown"}`);
    }

    // ── Determine debug mode ──────────────────────────────────────────
    const isDebug = process.env.INSIGHTS_DEBUG === "true";

    // ── Re-score each trajectory insight with feed-specific rules ────
    const scored: FeedInsight[] = trajectoryResult.insights.map((insight) => {
      const base = FEED_BASE_SCORES[insight.type] ?? 30;
      let score = base;
      let proximityBonus = 0;
      let evidenceAdjust = 0;
      let voteAdjust = 0;

      // Proximity bucket bonus
      if (insight.proximityBucket) {
        proximityBonus = PROXIMITY_BONUS[insight.proximityBucket] ?? 0;
        score += proximityBonus;
      }

      // Allergy-related terms in label or description
      const isAllergyRelated =
        containsAllergyTerm(insight.label) ||
        containsAllergyTerm(insight.description);

      if (isAllergyRelated) {
        score += 25;
      }

      // Cluster inherent bonus
      if (insight.type === "medication_symptom_cluster") {
        score += 10;
      }

      // Phase 10E: negative evidence adjustments (trigger_symptom only)
      let evidence: InsightEvidence | undefined;

      if (
        insight.type === "trigger_symptom" &&
        evidenceCtx &&
        insight.priorityHints.triggerValue &&
        insight.priorityHints.symptomValue
      ) {
        const stats = evidenceCtx.getEvidence(
          insight.priorityHints.triggerValue,
          insight.priorityHints.symptomValue,
        );
        evidence = stats;

        // +20 if exposures >= 3 AND lift >= 2.0
        if (stats.exposures >= 3 && stats.lift >= 2.0) {
          evidenceAdjust += 20;
        }

        // -30 if exposures >= 5 AND hits === 0
        if (stats.exposures >= 5 && stats.hits === 0) {
          evidenceAdjust -= 30;
        }

        // -10 if exposures < 3 (unless allergy-related → no penalty)
        if (stats.exposures < 3 && !isAllergyRelated) {
          evidenceAdjust -= 10;
        }

        score += evidenceAdjust;
      }

      // Phase 10F: compute fingerprint and apply vote adjustment
      const fp = insightFingerprint({
        type: insight.type,
        priorityHints: { ...insight.priorityHints } as {
          triggerValue?: string;
          symptomValue?: string;
          [key: string]: unknown;
        },
        supportingEvents: insight.supportingEvents,
      });

      const userVote = votesMap[fp];

      if (userVote === "relevant") {
        voteAdjust = 15;
      } else if (userVote === "not_relevant") {
        voteAdjust = -40;
      }
      score += voteAdjust;

      // Phase 10G: clamp to [SCORE_MIN, SCORE_MAX]
      const preClamp = score;
      score = Math.max(SCORE_MIN, Math.min(SCORE_MAX, score));
      const clampApplied = score !== preClamp;

      const feedInsight: FeedInsight = {
        type: insight.type,
        label: insight.label,
        description: insight.description,
        supportingEvents: insight.supportingEvents,
        supportingEventCount: insight.supportingEventCount,
        priorityHints: { ...insight.priorityHints } as Record<string, unknown>,
        score,
        proximityBucket: insight.proximityBucket,
        hoursDelta: insight.hoursDelta,
        whyIncluded: insight.whyIncluded,
        evidence,
        fingerprint: fp,
        ...(userVote ? { userVote } : {}),
        ...(isDebug
          ? {
              scoreBreakdown: {
                base,
                proximityBonus,
                evidenceAdjust,
                voteAdjust,
                clampApplied,
              },
            }
          : {}),
      };

      return feedInsight;
    });

    // ── Phase 10G: score and merge functional_stacking insights ──────
    for (const si of stackingInsights) {
      const base = FEED_BASE_SCORES.functional_stacking;
      let score = base;
      let proximityBonus = 0;
      let voteAdjust = 0;

      // +20 proximity bonus if a symptom occurs within 0–6h after the stacking check
      const stackCheckId = si.supportingEvents[0];
      const stackCheckTime = stackingCheckTimestamps.get(stackCheckId);

      if (stackCheckTime) {
        const stackMs = new Date(stackCheckTime).getTime();
        const windowMs = STACKING_PROXIMITY_WINDOW_HOURS * 60 * 60 * 1000;

        const hasNearbySymptom = symptomEventsForProximity.some((sym) => {
          const symMs = new Date(sym.created_at).getTime();
          return symMs > stackMs && symMs - stackMs <= windowMs;
        });

        if (hasNearbySymptom) {
          proximityBonus = STACKING_PROXIMITY_BONUS;
          score += proximityBonus;
        }
      }

      // Fingerprint + vote adjustment
      const fp = insightFingerprint({
        type: si.type,
        priorityHints: si.priorityHints as {
          triggerValue?: string;
          symptomValue?: string;
          [key: string]: unknown;
        },
        supportingEvents: si.supportingEvents,
      });

      const userVote = votesMap[fp];

      if (userVote === "relevant") {
        voteAdjust = 15;
      } else if (userVote === "not_relevant") {
        voteAdjust = -40;
      }
      score += voteAdjust;

      // Clamp
      const preClamp = score;
      score = Math.max(SCORE_MIN, Math.min(SCORE_MAX, score));
      const clampApplied = score !== preClamp;

      scored.push({
        type: si.type,
        label: si.label,
        description: si.description,
        supportingEvents: si.supportingEvents,
        supportingEventCount: si.supportingEventCount,
        priorityHints: si.priorityHints,
        score,
        whyIncluded: si.whyIncluded,
        fingerprint: fp,
        meta: si.meta,
        ...(userVote ? { userVote } : {}),
        ...(isDebug
          ? {
              scoreBreakdown: {
                base,
                proximityBonus,
                evidenceAdjust: 0,
                voteAdjust,
                clampApplied,
              },
            }
          : {}),
      });
    }

    // ── Sort ───────────────────────────────────────────────────────
    scored.sort((a, b) => {
      // 1. score DESC
      if (b.score !== a.score) return b.score - a.score;
      // 2. supportingEvents.length ASC (fewer = more selective)
      if (a.supportingEvents.length !== b.supportingEvents.length) {
        return a.supportingEvents.length - b.supportingEvents.length;
      }
      // 3. stable tie-breaker: label+description ASC
      const aKey = `${a.label}${a.description}`;
      const bKey = `${b.label}${b.description}`;
      return aKey.localeCompare(bKey);
    });

    // ── Apply limit ────────────────────────────────────────────────
    const topInsights = scored.slice(0, limit);

    const response: FeedResponse = {
      profileId,
      windowHours,
      analyzedChecks: trajectoryResult.analyzedChecks,
      insights: topInsights,
      ...(warnings.length > 0 ? { warnings } : {}),
    };

    return res.status(200).json(response);
  } catch (err: any) {
    console.error("[InsightsFeed]", err?.message);
    return res.status(500).json({
      error: err?.message ?? "Insights feed failed",
      details: null,
    });
  }
}

/*
 * ── Test commands ──────────────────────────────────────────────────
 *
 * # Full feed with evidence + fingerprint + userVote + stacking:
 * curl -s "http://localhost:3000/api/insights/feed?profileId=$DEFAULT_PROFILE_ID&windowHours=48&limit=20" | jq .
 *
 * # Verify fingerprint and evidence on first 3 insights:
 * curl -s "http://localhost:3000/api/insights/feed?profileId=$DEFAULT_PROFILE_ID&limit=3" | jq '.insights[] | {fingerprint,score,userVote,evidence}'
 *
 * # Phase 10G: confirm functional_stacking appears + scoring:
 * curl -s "http://localhost:3000/api/insights/feed?profileId=$DEFAULT_PROFILE_ID&windowHours=48&limit=20" | jq '.insights[] | select(.type=="functional_stacking") | {type,label,score,meta}'
 *
 * # Phase 10G (debug): confirm scoreBreakdown (requires INSIGHTS_DEBUG=true):
 * curl -s "http://localhost:3000/api/insights/feed?profileId=$DEFAULT_PROFILE_ID&windowHours=48&limit=20" | jq '.insights[] | select(.type=="functional_stacking") | {type,score,scoreBreakdown}'
 *
 * # Phase 10F: submit a vote then re-check the feed:
 * FIRST=$(curl -s "http://localhost:3000/api/insights/feed?profileId=$DEFAULT_PROFILE_ID&limit=1" | jq -r '.insights[0]')
 * curl -s -X POST http://localhost:3000/api/insights/feedback \
 *   -H "Content-Type: application/json" \
 *   -d "{\"profileId\":\"$DEFAULT_PROFILE_ID\",\"insight\":$FIRST,\"vote\":\"not_relevant\"}" | jq .
 * curl -s "http://localhost:3000/api/insights/feed?profileId=$DEFAULT_PROFILE_ID&limit=3" | jq '.insights[] | {fingerprint: .fingerprint[:40], score, userVote}'
 *
 * # Missing profileId → 400:
 * curl -s "http://localhost:3000/api/insights/feed" | jq .
 */
