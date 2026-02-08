import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });   // load .env.local → process.env (local dev)

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractFromText } from "./_lib/extractFromText.js";

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
    return res.status(200).json(result);
  } catch (err: any) {
    const statusCode = err?.statusCode ?? 500;

    return res.status(statusCode).json({
      error: err?.message ?? "Extraction Failed",
      details: err?.details ?? null
    });
  }
}
