import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient } from "../_lib/supabaseClient.js";

/**
 * Vercel Serverless Function
 * GET /api/history/:id
 *
 * Returns a single check with all of its health events.
 *
 * Path param:
 *   id – UUID of the check
 *
 * Query params:
 *   profileId – optional; falls back to DEFAULT_PROFILE_ID env var.
 *               When present, acts as an ownership guard (profile_id must match).
 *
 * Env vars (see .env.local):
 *   SUPABASE_URL              – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – service-role key (never expose to browser)
 *   DEFAULT_PROFILE_ID        – hardcoded profile id ("Amber" mode)
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }

  try {
    // ── Validate id path param ─────────────────────────────────────
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";

    if (!id || !UUID_RE.test(id)) {
      return res.status(400).json({
        error: "Invalid or missing check id (expected UUID)",
        details: null,
      });
    }

    // ── Resolve profileId (optional ownership guard) ───────────────
    const profileId =
      (typeof req.query.profileId === "string" ? req.query.profileId.trim() : "") ||
      process.env.DEFAULT_PROFILE_ID ||
      "";

    // ── Fetch check ────────────────────────────────────────────────
    const supabase = getSupabaseClient();

    let checkQuery = supabase.from("checks").select("*").eq("id", id);

    if (profileId) {
      checkQuery = checkQuery.eq("profile_id", profileId);
    }

    const { data: check, error: checkError } = await checkQuery.maybeSingle();

    if (checkError) {
      throw new Error(`checks query failed: ${checkError.message}`);
    }

    if (!check) {
      return res.status(404).json({ error: "Check not found", details: null });
    }

    // ── Fetch events for this check ────────────────────────────────
    const { data: events, error: eventsError } = await supabase
      .from("health_events")
      .select("*")
      .eq("check_id", id)
      .order("created_at", { ascending: true });

    if (eventsError) {
      throw new Error(`health_events query failed: ${eventsError.message}`);
    }

    return res.status(200).json({ check, events: events ?? [] });
  } catch (err: any) {
    console.error("[History Detail]", err?.message);
    return res.status(500).json({
      error: err?.message ?? "Failed to fetch check detail",
      details: null,
    });
  }
}

/*
 * ── Test commands ──────────────────────────────────────────────────
 *
 * # Fetch a specific check by UUID:
 * curl -s http://localhost:3000/api/history/YOUR_CHECK_UUID_HERE | jq .
 *
 * # Fetch with explicit profileId guard:
 * curl -s "http://localhost:3000/api/history/YOUR_CHECK_UUID_HERE?profileId=amber-default" | jq .
 */
