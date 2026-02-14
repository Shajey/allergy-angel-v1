import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });   // load .env.local → process.env (local dev)

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractFromText } from "./_lib/extractFromText.js";
import { postProcessExtractionResult } from "./_lib/inference/postProcessExtractionResult.js";
import { saveExtractionRun } from "./_lib/persistence/saveExtractionRun.js";
import { postProcessFollowUps } from "./_lib/inference/postProcessFollowUps.js";

/**
 * Vercel Serverless Function
 * POST /api/extract
 *
 * Behavior:
 * - Default: heuristic extraction (deterministic)
 * - If EXTRACTION_MODE=llm: LLM extraction (OpenAI) via boundary module
 *
 * Contract:
 * - Always returns { events: HealthEvent[], followUpQuestions: string[], warnings: string[] }
 * - On error, returns { error: string, details: any|null } with proper HTTP status
 *
 * Phase 7 – Memory Room:
 * After extraction succeeds, persists the run to Supabase (additive).
 * If persistence fails the extraction result is still returned with a warning.
 *
 * Phase 9A – Profile Foundation:
 * Uses DEFAULT_PROFILE_ID (UUID from profiles table) to associate
 * persisted data with a real profile. If the profile is missing or
 * invalid, extraction still succeeds but events are not persisted.
 *
 * Env vars for persistence (see .env.local):
 *   SUPABASE_URL              – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – service-role key (never expose to browser)
 *   DEFAULT_PROFILE_ID        – UUID of the profile to persist against
 *   STORE_RAW_INPUTS          – optional, set to "true" to persist raw text
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }

  try {
    const rawText =
      typeof (req.body as any)?.rawText === "string" ? (req.body as any).rawText.trim() : "";

    if (!rawText) {
      return res.status(400).json({ error: "Missing rawText in request body", details: null });
    }

    const result = await extractFromText(rawText);

    // ── Post-process: meal needsClarification + carb follow-up suppression ─
    postProcessExtractionResult(rawText, result);

    // ── Phase 7 + 9A: persist extraction run (best-effort) ───────────
    // DEFAULT_PROFILE_ID must be a UUID from the profiles table.
    const profileId = process.env.DEFAULT_PROFILE_ID;
    if (profileId) {
      try {
        await saveExtractionRun({ profileId, rawText, result });
      } catch (persistErr: any) {
        console.error("[Persistence] saveExtractionRun failed:", persistErr?.message);
        result.warnings = result.warnings ?? [];
        result.warnings.push(`Persistence failed: ${persistErr?.message ?? "unknown error"}`);
      }
    } else {
      result.warnings = result.warnings ?? [];
      result.warnings.push("Profile not found; events not persisted");
      // Phase 10J: post-process follow-ups even when not persisting (no verdict)
      const post = postProcessFollowUps({
        rawText,
        events: result.events,
        followUpQuestions: result.followUpQuestions ?? [],
        verdict: undefined,
      });
      result.followUpQuestions = post.followUpQuestions;
    }

    return res.status(200).json(result);
  } catch (err: any) {
    const statusCode = err?.statusCode ?? 500;

    return res.status(statusCode).json({
      error: err?.message ?? "Extraction Failed",
      details: err?.details ?? null
    });
  }
}
