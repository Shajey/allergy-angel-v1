import type { VercelRequest, VercelResponse } from "@vercel/node";
import Ajv from "ajv";
import fs from "node:fs";
import path from "node:path";

// --- UPDATED SCHEMA LOADING BLOCK ---
let schema: any;
try {
  const schemaPath = path.join(process.cwd(), "docs/contracts/health-event.schema.json");
  const raw = fs.readFileSync(schemaPath, "utf-8");
  schema = JSON.parse(raw);
} catch (e: any) {
  // Fail fast but with a readable message
  console.error("Failed to load health-event schema:", e);
  schema = null;
}

// Phase 6 constant: bump when extraction output shape/logic changes
const EXTRACTION_VERSION = "v0-stub";

// --- SAFETY CHECK ADDED HERE ---
if (!schema) {
  throw new Error("HealthEvent schema could not be loaded. Check docs/contracts/health-event.schema.json path.");
}

// AJV validator instance
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validateHealthEvent = ajv.compile(schema);

// Small helper: derive confidenceLevel
function confidenceLevelFrom(confidence: number): "Low" | "Medium" | "High" {
  if (confidence < 0.4) return "Low";
  if (confidence < 0.75) return "Medium";
  return "High";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const startedAt = Date.now();

  const body = req.body;
  const rawText = typeof body?.rawText === "string" ? body.rawText.trim() : "";
  if (!rawText) {
    return res.status(400).json({ error: "rawText is required" });
  }

  // Deterministic stub: same output shape every time
  const event = {
   id: "stub-0001",
   type: "symptom",
   startTime: "2026-02-07T00:00:00.000Z",
   fields: {
      symptom: "headache",
      severity: "mild"
    },
    confidence: 0.72,
    confidenceLevel: confidenceLevelFrom(0.72),
    needsClarification: false,
    provenance: {
      sourceInputId: "raw-input-stub",
      sourceSpans: [
        { field: "fields.symptom", startChar: 0, endChar: Math.min(20, rawText.length) }
      ],
      modelVersion: "none-stub",
      extractionVersion: EXTRACTION_VERSION
    }
  };

  // Schema validation: fail loudly if we drift from contract
  const ok = validateHealthEvent(event);
  if (!ok) {
    return res.status(500).json({
      error: "Stub HealthEvent failed schema validation",
      details: validateHealthEvent.errors
    });
  }

  const response = {
    events: [event],
    followUpQuestions: [],
    warnings: [],
    meta: {
      extractionVersion: EXTRACTION_VERSION,
      latencyMs: Date.now() - startedAt
    }
  };

  return res.status(200).json(response);
}