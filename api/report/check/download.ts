import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient } from "../../_lib/supabaseClient.js";
import { isUuidLike } from "../../_lib/validation/isUuidLike.js";
import { buildCheckReport, reportFilename } from "../../_lib/report/buildCheckReport.js";

/**
 * Phase 13.6 – Safety Report Download
 *
 * GET /api/report/check/download?checkId=<uuid>[&profileId=<uuid>][&includeRawText=true]
 *
 * Same payload as /api/report/check but with Content-Disposition for browser download.
 * Filename: AA_SafetyReport_<profileId>_<checkId>_<taxonomyVersionOrUnknown>.json
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const checkId = typeof req.query.checkId === "string" ? req.query.checkId.trim() : "";
    if (!checkId || !isUuidLike(checkId)) {
      return res.status(400).json({ error: "checkId is required and must be a valid UUID format" });
    }

    const profileIdParam = typeof req.query.profileId === "string" ? req.query.profileId.trim() : "";
    if (profileIdParam && !isUuidLike(profileIdParam)) {
      return res.status(400).json({ error: "profileId must be a valid UUID format" });
    }

    const includeRawText = req.query.includeRawText === "true" || req.query.includeRawText === "1";

    const supabase = getSupabaseClient();

    const { data: check, error: checkError } = await supabase
      .from("checks")
      .select("*")
      .eq("id", checkId)
      .maybeSingle();

    if (checkError) {
      throw new Error(`checks query failed: ${checkError.message}`);
    }
    if (!check) {
      return res.status(404).json({ error: "Check not found" });
    }

    if (profileIdParam && check.profile_id !== profileIdParam) {
      return res.status(404).json({ error: "Check not found" });
    }

    const { data: events, error: eventsError } = await supabase
      .from("health_events")
      .select("id, created_at, event_type, event_data")
      .eq("check_id", checkId)
      .order("created_at", { ascending: true });

    if (eventsError) {
      throw new Error(`health_events query failed: ${eventsError.message}`);
    }

    const report = buildCheckReport({
      check: {
        id: check.id,
        profile_id: check.profile_id,
        created_at: check.created_at,
        raw_text: check.raw_text,
        verdict: check.verdict,
      },
      events: events ?? [],
      includeRawText,
    });

    const taxonomyVersion = report.meta.taxonomyVersion;
    const filename = reportFilename(report.meta.profileId, report.meta.checkId, taxonomyVersion);

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).json(report);
  } catch (err: any) {
    console.error("[Report/Check/Download]", err?.message);
    return res.status(500).json({ error: err?.message ?? "Failed to build report" });
  }
}
