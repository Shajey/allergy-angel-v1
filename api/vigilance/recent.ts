import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient } from "../_lib/supabaseClient.js";
import {
  computeRecentTriggersFromChecks,
  type RecentTriggerCheck,
} from "../_lib/vigilance/recentTriggers.js";

/**
 * Phase 13.2 – Recent Vigilance Triggers API
 *
 * GET /api/vigilance/recent
 *
 * Read-only: returns recent medium/high risk triggers for a profile.
 *
 * Query params:
 *   profileId   – required (falls back to DEFAULT_PROFILE_ID)
 *   windowHours – optional; default 12, max 168
 *   limit       – optional; default 10, max 50
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }

  try {
    const profileId =
      (typeof req.query.profileId === "string"
        ? req.query.profileId.trim()
        : "") ||
      process.env.DEFAULT_PROFILE_ID ||
      "";

    if (!profileId) {
      return res.status(400).json({
        error: "Missing required query parameter: profileId",
        details: null,
      });
    }

    const windowHours = Math.min(
      Math.max(parseInt(String(req.query.windowHours), 10) || 12, 1),
      168
    );

    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit), 10) || 10, 1),
      50
    );

    const supabase = getSupabaseClient();
    const since = new Date(
      Date.now() - windowHours * 60 * 60 * 1000
    ).toISOString();

    const { data: checks, error } = await supabase
      .from("checks")
      .select("id, verdict, created_at")
      .eq("profile_id", profileId)
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Recent triggers query failed: ${error.message}`);
    }

    const triggers = computeRecentTriggersFromChecks(
      (checks ?? []) as RecentTriggerCheck[],
      limit
    );

    return res.status(200).json({
      profileId,
      windowHours,
      limit,
      triggers,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Recent triggers fetch failed";
    console.error("[Vigilance/recent]", message);
    return res.status(500).json({ error: message, details: null });
  }
}
