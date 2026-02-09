import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { analyzeTrajectory } from "./_lib/inference/analyzeTrajectory.js";
import { getSupabaseClient } from "./_lib/supabaseClient.js";

/**
 * Vercel Serverless Function
 * GET /api/trajectory
 *
 * Computes temporal pattern insights over a profile's recent checks.
 * Results are derived on-the-fly — nothing is persisted.
 *
 * Phase 10B: Fetches the profile's known_allergies to enable allergen-aware
 * scoring. If the profile is not found, allergens default to [] and analysis
 * continues gracefully.
 *
 * Query params:
 *   profileId      – optional; falls back to DEFAULT_PROFILE_ID env var
 *   windowHours    – optional; default 48, max 168 (7 days)
 *   minOccurrences – optional; default 2, min 2
 *
 * Env vars (see .env.local):
 *   SUPABASE_URL              – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – service-role key
 *   DEFAULT_PROFILE_ID        – fallback profile id
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }

  try {
    // ── Resolve profileId ──────────────────────────────────────────
    const profileId =
      (typeof req.query.profileId === "string" ? req.query.profileId.trim() : "") ||
      process.env.DEFAULT_PROFILE_ID ||
      "";

    if (!profileId) {
      return res.status(400).json({ error: "Missing profileId", details: null });
    }

    // ── Parse optional params ──────────────────────────────────────
    const windowHours = Math.min(
      Math.max(parseInt(String(req.query.windowHours), 10) || 48, 1),
      168 // cap at 7 days
    );

    const minOccurrences = Math.max(
      parseInt(String(req.query.minOccurrences), 10) || 3,
      2 // minimum meaningful threshold (default bumped to 3 in Phase 10C)
    );

    // ── Fetch profile allergens for scoring ─────────────────────────
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
      // Profile lookup failed — continue with empty allergens
      console.warn("[Trajectory] Could not fetch profile allergens; scoring without them.");
    }

    // ── Run trajectory analysis ────────────────────────────────────
    const result = await analyzeTrajectory({
      profileId,
      windowHours,
      minOccurrences,
      knownAllergies,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[Trajectory]", err?.message);
    return res.status(500).json({
      error: err?.message ?? "Trajectory analysis failed",
      details: null,
    });
  }
}

/*
 * ── Test commands ──────────────────────────────────────────────────
 *
 * # Analyze with defaults (48h window, 2 min occurrences):
 * curl -s http://localhost:3000/api/trajectory | jq .
 *
 * # Custom window (72 hours, 3 min occurrences):
 * curl -s "http://localhost:3000/api/trajectory?windowHours=72&minOccurrences=3" | jq .
 */
