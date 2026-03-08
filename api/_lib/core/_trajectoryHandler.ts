import type { VercelRequest, VercelResponse } from "@vercel/node";
import { analyzeTrajectory } from "../../inference/analyzeTrajectory.js";
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

    const windowHours = Math.min(
      Math.max(parseInt(String(req.query.windowHours), 10) || 48, 1),
      168
    );

    const minOccurrences = Math.max(
      parseInt(String(req.query.minOccurrences), 10) || 3,
      2
    );

    let knownAllergies: string[] = [];
    try {
      const supabase = getSupabaseClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("known_allergies")
        .eq("id", profileId)
        .maybeSingle();

      knownAllergies = profile?.known_allergies ?? [];
    } catch {
      console.warn("[Trajectory] Could not fetch profile allergens; scoring without them.");
    }

    const result = await analyzeTrajectory({
      profileId,
      windowHours,
      minOccurrences,
      knownAllergies,
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Trajectory analysis failed";
    console.error("[Trajectory]", msg);
    return res.status(500).json({ error: msg, details: null });
  }
}
