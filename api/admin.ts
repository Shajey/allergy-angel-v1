import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { discoverUnmapped } from "./_lib/admin/unmappedDiscovery.js";
import { buildPromotionExport } from "./_lib/admin/promotionExport.js";
import { isUuidLike } from "./_lib/validation/isUuidLike.js";

/**
 * Consolidated Admin API – handles multiple admin routes via ?action=
 * Served at /api/admin with rewrites from:
 *   /api/admin/unmapped      -> /api/admin?action=unmapped
 *   /api/admin/pr-packager   -> /api/admin?action=pr-packager
 *   /api/admin/promotion-export -> /api/admin?action=promotion-export
 *
 * Reduces serverless function count for Vercel Hobby plan (12 limit).
 */
function isAdminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "true";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = typeof req.query.action === "string" ? req.query.action : "";

  if (!isAdminEnabled()) {
    const details =
      process.env.NODE_ENV !== "production"
        ? "ADMIN_ENABLED is not 'true'. Set ADMIN_ENABLED=true in .env.local and restart the server."
        : null;
    return res.status(404).json({ error: "Not Found", details });
  }

  switch (action) {
    case "unmapped":
      return handleUnmapped(req, res);
    case "pr-packager":
      return handlePrPackager(req, res);
    case "promotion-export":
      return handlePromotionExport(req, res);
    default:
      return res.status(400).json({
        error: "Missing or invalid action",
        details: "Use ?action=unmapped|pr-packager|promotion-export",
      });
  }
}

async function handleUnmapped(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
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
    const result = await discoverUnmapped({ profileId, windowHours, limit });
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Discovery failed";
    console.error("[Admin Unmapped]", message);
    return res.status(500).json({ error: message, details: null });
  }
}

async function handlePrPackager(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  return res.status(400).json({
    error: "Use CLI locally",
    details:
      "PR Packager requires spawning replay validation. Run: npm run pr:pack -- --profileId=... --selectTaxonomy=... --parent=... --mode=crossReactive [--runReplay] [--strict]",
  });
}

async function handlePromotionExport(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
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
    return res.status(500).json({ error: message, details: null });
  }
}
