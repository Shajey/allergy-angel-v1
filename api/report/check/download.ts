import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient } from "../../_lib/supabaseClient.js";
import { isUuidLike } from "../../_lib/validation/isUuidLike.js";
import { buildCheckReport, reportFilename } from "../../_lib/report/buildCheckReport.js";
import {
  formatReportAsText,
  textReportFilename,
} from "../../_lib/report/formatReportAsText.js";

/**
 * Phase 13.6 – Safety Report Download
 * Phase 18.2 – Human-readable text format
 *
 * GET /api/report/check/download?checkId=<uuid>[&profileId=<uuid>][&includeRawText=true][&format=text]
 *
 * format=text  → plain text (.txt) for parents
 * format=json  or omit → JSON (legacy)
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
    const formatText = req.query.format === "text" || req.query.format === "txt";

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
      includeRawText: includeRawText || formatText,
    });

    if (formatText) {
      // Phase 18.2: Human-readable text report
      let profile: { name: string; allergies: string[]; medications: string[]; supplements: string[] } | undefined;
      try {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("display_name, known_allergies, current_medications, supplements")
          .eq("id", check.profile_id)
          .maybeSingle();
        if (profileRow) {
          const meds = (profileRow.current_medications ?? []) as { name?: string; displayName?: string }[];
          const allergies = (profileRow.known_allergies ?? []) as (string | { name: string })[];
          const supps = (profileRow.supplements ?? []) as (string | { name: string })[];
          profile = {
            name: String(profileRow.display_name ?? "Unknown"),
            allergies: allergies.map((a) => (typeof a === "string" ? a : a?.name ?? "")).filter(Boolean),
            medications: meds.map((m) => String(m?.name ?? m)).filter(Boolean),
            supplements: supps.map((s) => (typeof s === "string" ? s : s?.name ?? "")).filter(Boolean),
          };
        }
      } catch {
        // Profile fetch best-effort
      }

      const reportData = {
        meta: report.meta,
        input: {
          events: report.input.events.map((e) => ({
            event_type: e.event_type,
            event_data: e.event_data,
          })),
          rawText: report.input.rawText ?? check.raw_text,
        },
        output: report.output,
        profile,
      };

      const rawMatched = (check.verdict?.matched ?? []) as Array<{
        rule: string;
        ruleCode?: string;
        details: Record<string, unknown>;
      }>;

      const textReport = formatReportAsText(reportData, {
        includeOriginalText: includeRawText,
        rawMatched: rawMatched.length > 0 ? rawMatched : undefined,
      });

      const filename = textReportFilename(check.created_at);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.status(200).send(textReport);
    }

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
