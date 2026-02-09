import { getSupabaseClient } from "../supabaseClient.js";
import { checkRisk, type Verdict } from "../inference/checkRisk.js";

/**
 * Persist an extraction run to Supabase Postgres.
 *
 * Write order (data atomicity):
 *   0. profiles      – fetch profile (known_allergies, current_medications)
 *   0b. verdict      – deterministic risk check (Phase 9B)
 *   1. checks        – one row per extraction run, includes verdict
 *   2. raw_inputs    – optional (only when STORE_RAW_INPUTS === "true")
 *   3. health_events – one row per event, all linked to the same check_id
 *
 * If persistence fails, the caller is expected to catch the error and append
 * a warning — extraction results are always returned to the user regardless.
 *
 * Env vars:
 *   DEFAULT_PROFILE_ID – the profile UUID passed in by the caller
 */
export async function saveExtractionRun(args: {
  profileId: string;
  rawText: string;
  result: {
    events: any[];
    followUpQuestions: string[];
    warnings: string[];
  };
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { profileId, rawText, result } = args;

  // ── 0. Fetch the full profile ─────────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, known_allergies, current_medications")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Profile lookup failed: ${profileError.message}`);
  }

  if (!profile) {
    throw new Error(`Profile not found for id "${profileId}"`);
  }

  // ── 0b. Compute deterministic risk verdict (Phase 9B) ─────────────
  let verdict: Verdict;
  try {
    verdict = checkRisk({
      profile: {
        known_allergies: profile.known_allergies ?? [],
        current_medications: profile.current_medications ?? [],
      },
      events: result.events,
    });
  } catch {
    // If verdict computation fails, persist a safe default
    verdict = { riskLevel: "none", reasoning: "Verdict computation failed" };
  }

  // ── 1. Insert the parent "check" row (includes verdict) ───────────
  const { data: checkData, error: checkError } = await supabase
    .from("checks")
    .insert({
      profile_id: profileId,
      raw_text: rawText,
      follow_up_questions: result.followUpQuestions ?? [],
      verdict,
    })
    .select("id")
    .single();

  if (checkError) {
    throw new Error(`checks insert failed: ${checkError.message}`);
  }

  const checkId: string = checkData.id;

  // ── 2. Optional: persist raw input text ───────────────────────────
  let rawInputId: string | null = null;

  if (process.env.STORE_RAW_INPUTS === "true") {
    const { data, error } = await supabase
      .from("raw_inputs")
      .insert({ profile_id: profileId, input_text: rawText })
      .select("id")
      .single();

    if (error) {
      throw new Error(`raw_inputs insert failed: ${error.message}`);
    }

    rawInputId = data?.id ?? null;
  }

  // ── 3. Persist health events (all linked to check_id) ────────────
  if (result.events.length === 0) return;

  const rows = result.events.map((event: any) => ({
    profile_id: profileId,
    check_id: checkId,
    event_type: event.type,
    event_data: event.fields ?? {},
    confidence_score:
      event.confidenceScore ?? Math.round((event.confidence ?? 0) * 100),
    provenance: event.provenance ?? {},
    ...(rawInputId ? { raw_input_id: rawInputId } : {}),
  }));

  const { error: eventsError } = await supabase
    .from("health_events")
    .insert(rows);

  if (eventsError) {
    throw new Error(`health_events insert failed: ${eventsError.message}`);
  }
}
