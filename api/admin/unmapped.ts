import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { discoverUnmapped } from "../_lib/admin/unmappedDiscovery.js";
import { isUuidLike } from "../_lib/validation/isUuidLike.js";

/**
 * Phase 11 – Unmapped Discovery API
 *
 * GET /api/admin/unmapped
 *
 * Query params:
 *   profileId   – required
 *   windowHours – optional; default 168
 *   limit       – optional; default 20
 *
 * Returns: { profileId, windowHours, candidates: [...] }
 */
function isAdminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "true";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }

  if (!isAdminEnabled()) {
    const details =
      process.env.NODE_ENV !== "production"
        ? "ADMIN_ENABLED is not 'true'. Set ADMIN_ENABLED=true in .env.local and restart the server."
        : null;
    return res.status(404).json({ error: "Not Found", details });
  }

  try {
    const profileId =
      typeof req.query.profileId === "string" ? req.query.profileId.trim() : "";
    if (!profileId) {
      return res.status(400).json({
        error: "Missing required query parameter: profileId",
        details: null,
      });
    }
    if (!isUuidLike(profileId)) {
      return res.status(400).json({
        error: "profileId must be a valid UUID format",
        details: null,
      });
    }

    const windowHours = Math.min(
      Math.max(parseInt(String(req.query.windowHours), 10) || 168, 1),
      720
    );
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit), 10) || 20, 1),
      100
    );

    const result = await discoverUnmapped({
      profileId,
      windowHours,
      limit,
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Discovery failed";
    console.error("[Admin Unmapped]", message);
    return res.status(500).json({
      error: message,
      details: null,
    });
  }
}
