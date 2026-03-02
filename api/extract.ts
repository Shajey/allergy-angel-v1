import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });   // load .env.local → process.env (local dev)

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractFromText } from "./_lib/extractFromText.js";
import { extractFromTextHeuristic } from "./_lib/extractFromTextHeuristic.js";
import { extractFromTextLLM } from "./_lib/extractFromTextLLM.js";
import { extractTextFromImage } from "./_lib/extractFromImage.js";
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
 * - Phase 17: If image provided, extract text from image first, then use LLM extraction
 *   (ensures supplement events for label scanning)
 *
 * Request body: { rawText?: string, image?: string (base64), profile_id?: string }
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
    const body = req.body as Record<string, unknown> | null;
    let rawText = typeof body?.rawText === "string" ? body.rawText.trim() : "";
    const imageBase64 = typeof body?.image === "string" ? body.image.trim() : "";
    const imageType = typeof body?.imageType === "string" ? body.imageType.trim() : "";
    const previewOnly = body?.preview === true;
    const fromImage = body?.fromImage === true;

    // Phase 17: preview=true → image-to-text only, no persist
    if (previewOnly && imageBase64) {
      try {
        const { text } = await extractTextFromImage(imageBase64, imageType || undefined);
        return res.status(200).json({ text });
      } catch (imgErr: any) {
        return res.status(400).json({
          error: imgErr?.message ?? "Image text extraction failed",
          details: null,
        });
      }
    }

    // Phase 17: If image provided (full extract), extract text from image first
    if (imageBase64 && !rawText) {
      try {
        const { text } = await extractTextFromImage(imageBase64, imageType || undefined);
        rawText = text;
      } catch (imgErr: any) {
        return res.status(400).json({
          error: imgErr?.message ?? "Image text extraction failed",
          details: null,
        });
      }
    }

    if (!rawText) {
      return res.status(400).json({
        error: "Missing rawText or image in request body",
        details: null,
      });
    }

    // Phase 17: When image was used (or fromImage flag), use LLM for supplement events
    let result =
      imageBase64 || fromImage
        ? await extractFromTextLLM(rawText)
        : await extractFromText(rawText);

    // Fallback: "Mango", "peanut butter" — when extraction returns no meal, try heuristic
    const hasMeal = result.events?.some((e: any) => e.type === "meal" && e.fields?.meal);
    if (!hasMeal) {
      const trimmed = rawText.trim();
      const words = trimmed.split(/\s+/).filter(Boolean);
      const looksLikeNumber = /^\d+(\.\d+)?\s*(mg|mcg|g|ml|mg\/dl)?$/i.test(trimmed);
      const looksLikeMedication = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml)\b/i.test(rawText);
      const looksLikeSymptom = /\b(headache|rash|nausea|vomiting|diarrhea|cough|fever|itching|hives|sneezing|congestion)\b/i.test(rawText);
      if (
        words.length >= 1 &&
        words.length <= 6 &&
        trimmed.length <= 80 &&
        !looksLikeNumber &&
        !looksLikeMedication &&
        !looksLikeSymptom
      ) {
        const heuristicResult = await extractFromTextHeuristic(rawText);
        if (heuristicResult.events?.some((e: any) => e.type === "meal" && e.fields?.meal)) {
          result = heuristicResult;
        }
      }
    }

    // ── Post-process: meal needsClarification + carb follow-up suppression ─
    postProcessExtractionResult(rawText, result);

    // ── Phase 7 + 9A + 16: persist extraction run (best-effort) ───────────
    // profile_id from request body, else DEFAULT_PROFILE_ID.
    const profileId =
      (typeof body?.profile_id === "string" ? body.profile_id.trim() : "") ||
      process.env.DEFAULT_PROFILE_ID ||
      "";
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
