import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseClient } from "../supabaseClient.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }

  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";

    if (!id || !UUID_RE.test(id)) {
      return res.status(400).json({
        error: "Invalid or missing check id (expected UUID)",
        details: null,
      });
    }

    const profileId =
      (typeof req.query.profileId === "string" ? req.query.profileId.trim() : "") ||
      process.env.DEFAULT_PROFILE_ID ||
      "";

    const supabase = getSupabaseClient();

    let checkQuery = supabase.from("checks").select("*").eq("id", id);

    if (profileId) {
      checkQuery = checkQuery.eq("profile_id", profileId);
    }

    const { data: check, error: checkError } = await checkQuery.maybeSingle();

    if (checkError) {
      throw new Error(`checks query failed: ${checkError.message}`);
    }

    if (!check) {
      return res.status(404).json({ error: "Check not found", details: null });
    }

    const { data: events, error: eventsError } = await supabase
      .from("health_events")
      .select("*")
      .eq("check_id", id)
      .order("created_at", { ascending: true });

    if (eventsError) {
      throw new Error(`health_events query failed: ${eventsError.message}`);
    }

    return res.status(200).json({ check, events: events ?? [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch check detail";
    console.error("[History Detail]", msg);
    return res.status(500).json({ error: msg, details: null });
  }
}
