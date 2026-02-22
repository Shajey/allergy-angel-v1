import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildPromotionExport } from "../_lib/admin/promotionExport.js";
import { isUuidLike } from "../_lib/validation/isUuidLike.js";

/**
 * Phase 12.1 – Promotion Export API
 *
 * POST /api/admin/promotion-export
 *
 * Read-only: generates a structured JSON export for human PR review.
 * No writes, no schema changes, no LLM. Human-in-the-loop required.
 *
 * Body: { profileId, windowHours?, limit?, mode? }
 * mode: "blank" (default) | "suggest"
 */

function isAdminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "true";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
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
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({
        error: "Request body must be a JSON object",
        details: null,
      });
    }

    const profileId =
      typeof body.profileId === "string" ? body.profileId.trim() : "";
    if (!profileId) {
      return res.status(400).json({
        error: "Missing required field: profileId",
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
      Math.max(parseInt(String(body.windowHours), 10) || 168, 1),
      720
    );
    const limit = Math.min(
      Math.max(parseInt(String(body.limit), 10) || 20, 1),
      100
    );

    const modeRaw = body.mode;
    const mode =
      modeRaw === "suggest" ? "suggest" : modeRaw === "blank" ? "blank" : "blank";

    const result = await buildPromotionExport({
      profileId,
      windowHours,
      limit,
      mode,
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Promotion export failed";
    console.error("[Admin Promotion Export]", message);
    return res.status(500).json({
      error: message,
      details: null,
    });
  }
}
