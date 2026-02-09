import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient } from "./_lib/supabaseClient.js";

/**
 * Vercel Serverless Function
 * GET  /api/profile  – read the current profile
 * PATCH /api/profile – update profile fields (known_allergies, current_medications, supplements)
 *
 * Uses DEFAULT_PROFILE_ID to identify which profile to read/write.
 *
 * Env vars (see .env.local):
 *   SUPABASE_URL              – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – service-role key (never expose to browser)
 *   DEFAULT_PROFILE_ID        – UUID of the profile to operate on
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const profileId = process.env.DEFAULT_PROFILE_ID;

  if (!profileId) {
    return res.status(500).json({ error: "DEFAULT_PROFILE_ID not configured", details: null });
  }

  const supabase = getSupabaseClient();

  // ── GET: read profile ─────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .maybeSingle();

      if (error) {
        throw new Error(`Profile query failed: ${error.message}`);
      }

      if (!data) {
        return res.status(404).json({ error: "Profile not found", details: null });
      }

      return res.status(200).json({ profile: data });
    } catch (err: any) {
      console.error("[Profile GET]", err?.message);
      return res.status(500).json({ error: err?.message ?? "Failed to fetch profile", details: null });
    }
  }

  // ── PATCH: update profile ─────────────────────────────────────────
  if (req.method === "PATCH") {
    try {
      const body = req.body as Record<string, unknown> | null;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Request body required", details: null });
      }

      // Only allow updating these specific fields
      const updates: Record<string, unknown> = {};

      if (Array.isArray(body.known_allergies)) {
        updates.known_allergies = body.known_allergies;
      }
      if (Array.isArray(body.current_medications)) {
        updates.current_medications = body.current_medications;
      }
      if (Array.isArray(body.supplements)) {
        updates.supplements = body.supplements;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: "No valid fields to update (expected known_allergies, current_medications, or supplements)",
          details: null,
        });
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profileId)
        .select("*")
        .single();

      if (error) {
        throw new Error(`Profile update failed: ${error.message}`);
      }

      return res.status(200).json({ profile: data });
    } catch (err: any) {
      console.error("[Profile PATCH]", err?.message);
      return res.status(500).json({ error: err?.message ?? "Failed to update profile", details: null });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed", details: null });
}

/*
 * ── Test commands ──────────────────────────────────────────────────
 *
 * # Read profile:
 * curl -s http://localhost:3000/api/profile | jq .
 *
 * # Add an allergy:
 * curl -s -X PATCH http://localhost:3000/api/profile \
 *   -H "Content-Type: application/json" \
 *   -d '{"known_allergies": ["peanuts", "tree nuts", "shellfish"]}' | jq .
 */
