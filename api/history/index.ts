import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient } from "../_lib/supabaseClient.js";

/**
 * Vercel Serverless Function
 * GET /api/history
 *
 * Returns a paginated list of checks for a given profile, newest first.
 * Each check includes a summary of its health events (count + unique types).
 *
 * Query params:
 *   profileId  – optional; falls back to DEFAULT_PROFILE_ID env var
 *   limit      – optional; default 20, max 100
 *   offset     – optional; default 0
 *
 * Env vars (see .env.local):
 *   SUPABASE_URL              – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – service-role key (never expose to browser)
 *   DEFAULT_PROFILE_ID        – hardcoded profile id ("Amber" mode)
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

    // ── Pagination ─────────────────────────────────────────────────
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit), 10) || 20, 1),
      100
    );
    const offset = Math.max(parseInt(String(req.query.offset), 10) || 0, 0);

    // ── Fetch checks ───────────────────────────────────────────────
    const supabase = getSupabaseClient();

    const { data: checks, error: checksError } = await supabase
      .from("checks")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (checksError) {
      throw new Error(`checks query failed: ${checksError.message}`);
    }

    if (!checks || checks.length === 0) {
      return res.status(200).json({ checks: [] });
    }

    // ── Fetch events for those checks (single query) ───────────────
    const checkIds = checks.map((c: any) => c.id);

    const { data: events, error: eventsError } = await supabase
      .from("health_events")
      .select("check_id, event_type")
      .in("check_id", checkIds);

    if (eventsError) {
      throw new Error(`health_events query failed: ${eventsError.message}`);
    }

    // ── Build per-check summary ────────────────────────────────────
    const summaryMap: Record<string, { eventCount: number; eventTypes: Set<string> }> = {};

    for (const event of events ?? []) {
      if (!summaryMap[event.check_id]) {
        summaryMap[event.check_id] = { eventCount: 0, eventTypes: new Set() };
      }
      summaryMap[event.check_id].eventCount++;
      summaryMap[event.check_id].eventTypes.add(event.event_type);
    }

    const result = checks.map((check: any) => {
      const summary = summaryMap[check.id];
      return {
        ...check,
        summary: {
          eventCount: summary?.eventCount ?? 0,
          eventTypes: summary ? Array.from(summary.eventTypes) : [],
        },
      };
    });

    return res.status(200).json({ checks: result });
  } catch (err: any) {
    console.error("[History List]", err?.message);
    return res.status(500).json({
      error: err?.message ?? "Failed to fetch history",
      details: null,
    });
  }
}

/*
 * ── Test commands ──────────────────────────────────────────────────
 *
 * # List checks (uses DEFAULT_PROFILE_ID):
 * curl -s http://localhost:3000/api/history | jq .
 *
 * # List checks with explicit profileId + pagination:
 * curl -s "http://localhost:3000/api/history?profileId=amber-default&limit=5&offset=0" | jq .
 */
