import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchVigilance } from "../_lib/vigilance/computeVigilance.js";

/**
 * Phase 13 – Vigilance State API
 *
 * GET /api/vigilance
 *
 * Read-only: returns whether a profile currently has active
 * medium/high risk based on stored check verdicts.
 *
 * Query params:
 *   profileId   – required (falls back to DEFAULT_PROFILE_ID)
 *   windowHours – optional; default 12, max 168
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

    const result = await fetchVigilance(profileId, windowHours);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Vigilance check failed";
    console.error("[Vigilance]", message);
    return res.status(500).json({ error: message, details: null });
  }
}
