import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient } from "./_lib/supabaseClient.js";
import { getProfiles } from "./_lib/profiles/getProfiles.js";
import { createProfile } from "./_lib/profiles/createProfile.js";
import { updateProfile } from "./_lib/profiles/updateProfile.js";
import { deleteProfile } from "./_lib/profiles/deleteProfile.js";

/**
 * Vercel Serverless Function
 * Phase 16 – Extended for multi-profile
 *
 * GET  /api/profile              – read single profile (profileId query or DEFAULT_PROFILE_ID)
 * GET  /api/profile?action=list  – list all profiles
 * POST /api/profile              – create profile { name: string }
 * PATCH /api/profile             – update profile fields (known_allergies, etc.) by profileId or DEFAULT
 * PATCH /api/profile?id=...      – update profile metadata (display_name, is_primary)
 * DELETE /api/profile?id=...     – delete profile (cannot delete last)
 *
 * Env vars (see .env.local):
 *   SUPABASE_URL              – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – service-role key (never expose to browser)
 *   DEFAULT_PROFILE_ID        – fallback profile id when profileId not provided
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseClient();
  const action = typeof req.query.action === "string" ? req.query.action.trim() : "";
  const idParam = typeof req.query.id === "string" ? req.query.id.trim() : "";
  const profileIdParam =
    typeof req.query.profileId === "string" ? req.query.profileId.trim() : "";
  const defaultProfileId = process.env.DEFAULT_PROFILE_ID ?? "";

  // ── GET ?action=list: list all profiles ───────────────────────────
  if (req.method === "GET" && action === "list") {
    try {
      const profiles = await getProfiles();
      return res.status(200).json({ profiles });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to list profiles";
      console.error("[Profile list]", message);
      return res.status(500).json({ error: message, details: null });
    }
  }

  // ── POST: create profile ─────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const body = req.body as Record<string, unknown> | null;
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name) {
        return res.status(400).json({ error: "Missing required field: name", details: null });
      }
      const profile = await createProfile({ name });
      return res.status(201).json({ profile });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create profile";
      console.error("[Profile create]", message);
      return res.status(500).json({ error: message, details: null });
    }
  }

  // ── PATCH ?id=...: update profile metadata ─────────────────────
  if (req.method === "PATCH" && idParam) {
    try {
      const body = req.body as Record<string, unknown> | null;
      const display_name =
        body?.display_name !== undefined ? String(body.display_name).trim() : undefined;
      const is_primary = body?.is_primary === true;
      const profile = await updateProfile({
        id: idParam,
        display_name,
        is_primary: is_primary ? true : undefined,
      });
      return res.status(200).json({ profile });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      console.error("[Profile update metadata]", message);
      return res.status(500).json({ error: message, details: null });
    }
  }

  // ── DELETE ?id=...: delete profile ───────────────────────────────
  if (req.method === "DELETE" && idParam) {
    try {
      await deleteProfile(idParam);
      return res.status(200).json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete profile";
      console.error("[Profile delete]", message);
      const status = message.includes("last profile") ? 400 : 500;
      return res.status(status).json({ error: message, details: null });
    }
  }

  // ── GET: read single profile ─────────────────────────────────────
  if (req.method === "GET") {
    const profileId = profileIdParam || defaultProfileId;
    if (!profileId) {
      return res.status(500).json({ error: "DEFAULT_PROFILE_ID not configured", details: null });
    }
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch profile";
      console.error("[Profile GET]", message);
      return res.status(500).json({ error: message, details: null });
    }
  }

  // ── PATCH: update profile fields (known_allergies, etc.) ─────────
  if (req.method === "PATCH") {
    const profileId = profileIdParam || defaultProfileId;
    if (!profileId) {
      return res.status(500).json({ error: "DEFAULT_PROFILE_ID not configured", details: null });
    }
    try {
      const body = req.body as Record<string, unknown> | null;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Request body required", details: null });
      }

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      console.error("[Profile PATCH]", message);
      return res.status(500).json({ error: message, details: null });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed", details: null });
}
