import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractFromText } from "./_lib/extractFromText.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;
  const rawText = typeof body?.rawText === "string" ? body.rawText.trim() : "";
  if (!rawText) {
    return res.status(400).json({ error: "rawText is required" });
  }

  const result = extractFromText(rawText);

  // Check if result is an error
  if ("error" in result) {
    return res.status(500).json(result as ExtractionError);
  }

  return res.status(200).json(result);
}
