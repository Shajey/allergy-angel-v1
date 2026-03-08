import type { VercelRequest, VercelResponse } from "@vercel/node";
import { insightFingerprint } from "../inference/insightFingerprint.js";
import { getSupabaseClient } from "../supabaseClient.js";

const VALID_VOTES = new Set(["relevant", "not_relevant", "unsure"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Feedback storage failed";
      console.error("[InsightFeedback POST]", msg);
      return res.status(500).json({ error: msg, details: null });
    }
  }

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

      const votes: Record<string, string> = {};
      for (const row of data ?? []) {
        votes[(row as { insight_fingerprint: string; vote: string }).insight_fingerprint] = (
          row as { insight_fingerprint: string; vote: string }
        ).vote;
      }

      return res.status(200).json({ votes });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to retrieve feedback";
      console.error("[InsightFeedback GET]", msg);
      return res.status(500).json({ error: msg, details: null });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed", details: null });
}
