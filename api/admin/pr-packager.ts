/**
 * Phase 12.3 – PR Packager API (Guidance Only)
 *
 * Returns 400 with guidance to use the CLI locally.
 * Vercel serverless functions should not spawn child processes (replay validate).
 * Use: npm run pr:pack
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

function isAdminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "true";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }

  if (!isAdminEnabled()) {
    return res.status(404).json({
      error: "Not Found",
      details: "ADMIN_ENABLED is not 'true'.",
    });
  }

  return res.status(400).json({
    error: "Use CLI locally",
    details:
      "PR Packager requires spawning replay validation. Run: npm run pr:pack -- --profileId=... --selectTaxonomy=... --parent=... --mode=crossReactive [--runReplay] [--strict]",
  });
}
