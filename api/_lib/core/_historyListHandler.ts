import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient } from "../../supabaseClient.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }

  try {
    const profileId =
      (typeof req.query.profileId === "string" ? req.query.profileId.trim() : "") ||
      process.env.DEFAULT_PROFILE_ID ||
      "";

    if (!profileId) {
      return res.status(400).json({ error: "Missing profileId", details: null });
    }

    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit), 10) || 20, 1),
      100
    );
    const offset = Math.max(parseInt(String(req.query.offset), 10) || 0, 0);

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

    const checkIds = checks.map((c: { id: string }) => c.id);

    const { data: events, error: eventsError } = await supabase
      .from("health_events")
      .select("check_id, event_type")
      .in("check_id", checkIds);

    if (eventsError) {
      throw new Error(`health_events query failed: ${eventsError.message}`);
    }

    const summaryMap: Record<string, { eventCount: number; eventTypes: Set<string> }> = {};

    for (const event of events ?? []) {
      const e = event as { check_id: string; event_type: string };
      if (!summaryMap[e.check_id]) {
        summaryMap[e.check_id] = { eventCount: 0, eventTypes: new Set() };
      }
      summaryMap[e.check_id].eventCount++;
      summaryMap[e.check_id].eventTypes.add(e.event_type);
    }

    const result = checks.map((check: { id: string }) => {
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch history";
    console.error("[History List]", msg);
    return res.status(500).json({ error: msg, details: null });
  }
}
