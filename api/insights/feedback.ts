import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { insightFingerprint } from "../_lib/inference/insightFingerprint.js";
import { getSupabaseClient } from "../_lib/supabaseClient.js";

/**
 * Vercel Serverless Function
 * POST /api/insights/feedback – upsert a vote on an insight
 * GET  /api/insights/feedback – retrieve existing votes for a profile
 *
 * POST body:
 *   {
 *     profileId: string,
 *     insight: { type, priorityHints: { triggerValue?, symptomValue? }, supportingEvents: string[] },
 *     vote: 'relevant' | 'not_relevant' | 'unsure'
 *   }
 *
 * GET query params:
 *   profileId – required
 *   limit     – optional, default 200, max 500
 *
 * Returns:
 *   POST → { ok: true, fingerprint: string }
 *   GET  → { votes: { [fingerprint]: vote } }
 */

const VALID_VOTES = new Set(["relevant", "not_relevant", "unsure"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── POST: upsert vote ──────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const body = req.body as Record<string, unknown> | null;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Request body required", details: null });
      }

      const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
      if (!profileId) {
        return res.status(400).json({ error: "Missing profileId", details: null });
      }

      const vote = typeof body.vote === "string" ? body.vote.trim() : "";
      if (!VALID_VOTES.has(vote)) {
        return res.status(400).json({
          error: `Invalid vote: expected one of relevant, not_relevant, unsure`,
          details: null,
        });
      }

      const insight = body.insight as Record<string, unknown> | undefined;
      if (!insight || typeof insight !== "object") {
        return res.status(400).json({ error: "Missing insight object", details: null });
      }

      // Compute fingerprint
      const fingerprint = insightFingerprint({
        type: String(insight.type ?? ""),
        priorityHints: (insight.priorityHints ?? {}) as {
          triggerValue?: string;
          symptomValue?: string;
          [key: string]: unknown;
        },
        supportingEvents: Array.isArray(insight.supportingEvents)
          ? insight.supportingEvents.map(String)
          : [],
      });

      // Upsert into insight_feedback
      const supabase = getSupabaseClient();
      const { error: upsertErr } = await supabase
        .from("insight_feedback")
        .upsert(
          {
            profile_id: profileId,
            insight_fingerprint: fingerprint,
            vote,
            created_at: new Date().toISOString(),
          },
          { onConflict: "profile_id,insight_fingerprint" },
        );

      if (upsertErr) {
        throw new Error(`Upsert failed: ${upsertErr.message}`);
      }

      return res.status(200).json({ ok: true, fingerprint });
    } catch (err: any) {
      console.error("[InsightFeedback POST]", err?.message);
      return res.status(500).json({
        error: err?.message ?? "Feedback storage failed",
        details: null,
      });
    }
  }

  // ── GET: retrieve votes ────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const profileId =
        typeof req.query.profileId === "string" ? req.query.profileId.trim() : "";

      if (!profileId) {
        return res.status(400).json({ error: "Missing profileId", details: null });
      }

      const limit = Math.min(
        Math.max(parseInt(String(req.query.limit), 10) || 200, 1),
        500,
      );

      const supabase = getSupabaseClient();
      const { data, error: queryErr } = await supabase
        .from("insight_feedback")
        .select("insight_fingerprint, vote")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (queryErr) {
        throw new Error(`Query failed: ${queryErr.message}`);
      }

      // Build fingerprint → vote map
      const votes: Record<string, string> = {};
      for (const row of data ?? []) {
        votes[row.insight_fingerprint] = row.vote;
      }

      return res.status(200).json({ votes });
    } catch (err: any) {
      console.error("[InsightFeedback GET]", err?.message);
      return res.status(500).json({
        error: err?.message ?? "Failed to retrieve feedback",
        details: null,
      });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed", details: null });
}

/*
 * ── Test commands ──────────────────────────────────────────────────
 *
 * # Submit a vote:
 * curl -s -X POST http://localhost:3000/api/insights/feedback \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "profileId": "a0000000-0000-0000-0000-000000000001",
 *     "insight": {
 *       "type": "trigger_symptom",
 *       "priorityHints": { "triggerValue": "peanut butter sandwich", "symptomValue": "headache" },
 *       "supportingEvents": ["check-id-1", "check-id-2"]
 *     },
 *     "vote": "relevant"
 *   }' | jq .
 *
 * # Retrieve votes:
 * curl -s "http://localhost:3000/api/insights/feedback?profileId=a0000000-0000-0000-0000-000000000001" | jq .
 */
