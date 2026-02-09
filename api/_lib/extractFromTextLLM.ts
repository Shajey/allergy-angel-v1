import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { getOpenAIClient, getModelName } from "./openaiClient.js";

const EXTRACTION_VERSION = "v0-llm-v1.1";
const MODEL_VERSION = "openai";

type ConfidenceLevel = "Low" | "Medium" | "High";

function confidenceLevelFrom(confidence: number): ConfidenceLevel {
  if (confidence < 0.4) return "Low";
  if (confidence <= 0.7) return "Medium";
  return "High";
}

function loadPromptTemplate() {
  const p = path.join(process.cwd(), "docs/prompts/extract.v1.1.md");
  return fs.readFileSync(p, "utf-8");
}

function loadHealthEventSchema() {
  const schemaPath = path.join(process.cwd(), "docs/contracts/health-event.schema.json");
  return JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
}

function loadExtractionResponseSchema() {
  const schemaPath = path.join(process.cwd(), "docs/contracts/extraction-response.schema.json");
  return JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
}

function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Initialize AJV
const ajv = new Ajv({
  allErrors: true,
  allowUnionTypes: true
});

// Load and compile schemas
const healthEventSchema = loadHealthEventSchema();
const extractionResponseSchema = loadExtractionResponseSchema();

// Add health-event schema to AJV with its $id so $ref can resolve
ajv.addSchema(healthEventSchema);

const validateHealthEvent = ajv.compile(healthEventSchema);
const validateExtractionResponse = ajv.compile(extractionResponseSchema);

function safeFallback(rawText: string) {
  // Minimal, schema-valid response when LLM fails
  const spanEnd = Math.min(rawText.length, 120);
  const event: any = {
    id: "llm-fallback-0001",
    type: "symptom",
    startTime: new Date().toISOString(),
    fields: { symptom: null, severity: null },
    confidence: 0.3,
    confidenceScore: Math.round(0.3 * 100),
    confidenceLevel: confidenceLevelFrom(0.3),
    needsClarification: true,
    provenance: {
      sourceInputId: "raw-input-llm",
      sourceSpans: [{ field: "fields.symptom", startChar: 0, endChar: spanEnd }],
      modelVersion: MODEL_VERSION,
      extractionVersion: EXTRACTION_VERSION
    }
  };

  // Validate to ensure our fallback never breaks contract
  const ok = validateHealthEvent(event);
  if (!ok) {
    const err: any = new Error("Fallback HealthEvent failed schema validation");
    err.details = validateHealthEvent.errors;
    err.statusCode = 500;
    throw err;
  }

  return {
    events: [event],
    followUpQuestions: ["Can you share more detail so I can log it correctly?"],
    warnings: ["LLM output invalid; returned safe fallback."]
  };
}

function tryParseJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonFromText(maybeText: string): string {
  // If the model wraps JSON accidentally, try to slice between first { and last }
  const start = maybeText.indexOf("{");
  const end = maybeText.lastIndexOf("}");
  if (start >= 0 && end >= 0 && end > start) return maybeText.slice(start, end + 1);
  return maybeText;
}

function validateExtractionResponseWithAJV(obj: any): void {
  const isValid = validateExtractionResponse(obj);
  if (!isValid) {
    const err: any = new Error("Extraction response failed schema validation");
    err.details = validateExtractionResponse.errors;
    err.statusCode = 502;
    throw err;
  }
}

/**
 * Validate every event in the events array against the health-event schema.
 * Matches the pattern used in the heuristic version — throws 500 with details.
 */
function validateEventsAgainstSchema(events: any[]): void {
  for (let i = 0; i < events.length; i++) {
    const ok = validateHealthEvent(events[i]);
    if (!ok) {
      const err: any = new Error(`HealthEvent[${i}] failed schema validation`);
      err.details = validateHealthEvent.errors;
      err.statusCode = 500;
      throw err;
    }
  }
}

async function callModelOnce(rawText: string, repairInstruction?: string) {
  const client = getOpenAIClient();
  const model = getModelName();
  const template = loadPromptTemplate();

  // Inject current date and raw text into prompt
  const currentDate = getCurrentDate();
  let prompt = template.replace("{{current_date}}", currentDate);
  prompt = prompt.replace("{{RAW_TEXT}}", rawText);

  const system = [
    "You output ONLY valid JSON.",
    "Never include markdown.",
    "Never include commentary.",
    repairInstruction ? repairInstruction : ""
  ]
    .filter(Boolean)
    .join(" ");

  // Using OpenAI Chat Completions API
  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1
  });

  // Extract content from response
  const text = resp.choices[0]?.message?.content?.trim() || "";

  return text;
}

/**
 * Post-process LLM output: ensure every event has confidenceScore.
 * Guarantees the MRD contract even if the LLM only returns a decimal confidence.
 */
function enrichConfidenceScore(result: any): void {
  if (Array.isArray(result.events)) {
    for (const event of result.events) {
      if (typeof event.confidence === "number") {
        event.confidenceScore = Math.round(event.confidence * 100);
      }
    }
  }
}

export async function extractFromTextLLM(rawText: string) {
  // 1) First attempt
  const out1 = await callModelOnce(rawText);
  const json1 = tryParseJson(extractJsonFromText(out1));

  if (json1) {
    try {
      validateExtractionResponseWithAJV(json1);
      validateEventsAgainstSchema(json1.events);
      enrichConfidenceScore(json1);
      return json1;
    } catch (err: any) {
      // If response-level or event-level validation fails, try repair attempt
      if (err.statusCode === 502 || err.statusCode === 500) {
        // Continue to repair attempt
      } else {
        throw err;
      }
    }
  }

  // 2) One repair attempt
  const repair = [
    "Your previous output was invalid.",
    "Return ONLY valid JSON with the exact response shape:",
    `{ "events": [HealthEvent], "followUpQuestions": [], "warnings": [] }`,
    "Do not include any extra keys.",
    "Ensure each HealthEvent includes provenance and confidence fields."
  ].join(" ");

  const out2 = await callModelOnce(rawText, repair);
  const json2 = tryParseJson(extractJsonFromText(out2));

  if (json2) {
    try {
      validateExtractionResponseWithAJV(json2);
      validateEventsAgainstSchema(json2.events);
      enrichConfidenceScore(json2);
      return json2;
    } catch (err: any) {
      // If response-level or event-level validation fails, use fallback
      if (err.statusCode === 502 || err.statusCode === 500) {
        // Continue to fallback
      } else {
        throw err;
      }
    }
  }

  // 3) Safe fallback
  return safeFallback(rawText);
}
