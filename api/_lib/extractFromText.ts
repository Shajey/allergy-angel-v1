import Ajv from "ajv";
import fs from "node:fs";
import path from "node:path";

/**
 * CONFIGURATION & CONSTANTS
 */
const EXTRACTION_VERSION = "v0-stub";
const MODEL_VERSION = "none-stub";
const STUB_TIME = "2026-02-07T00:00:00.000Z";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DETERMINISTIC PARSERS (HEURISTICS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PARSER: SYMPTOMS
 * Searches a dictionary for health issues. 
 * Falls back to full-text span if no match found to trigger clarification.
 */
function parseSymptom(rawText: string) {
  const dictionary = ["headache", "rash", "nausea", "vomiting", "diarrhea", "cough", "fever", "itching", "hives", "sneezing", "congestion"];
  const lower = rawText.toLowerCase();
  
  for (const s of dictionary) {
    const idx = lower.indexOf(s);
    if (idx >= 0) {
      return { symptom: s, spans: [{ field: "fields.symptom", startChar: idx, endChar: idx + s.length }] };
    }
  }

  return { 
    symptom: null, 
    spans: [{ field: "fields.symptom", startChar: 0, endChar: Math.min(rawText.length, 120) }] 
  };
}

/**
 * PARSER: GLUCOSE
 * Extracts numeric readings followed by mg/dL units.
 */
function parseGlucose(rawText: string) {
  const re = /(\d{2,3})\s*(mg\/?d[lL]|mgdl)/i;
  const m = rawText.match(re);
  if (!m || m.index == null) return { value: null, unit: "mg/dL" as const, spans: [] };

  return { 
    value: Number(m[1]), 
    unit: "mg/dL" as const, 
    spans: [{ field: "fields.value", startChar: m.index, endChar: m.index + m[0].length }] 
  };
}

/**
 * PARSER: MEDICATION
 * Extracts dosage and medication name using standard patterns.
 */
function parseMedication(rawText: string) {
  const re = /(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml)\s*(?:of\s+)?([A-Za-z][A-Za-z0-9\- ]{1,30})/i;
  const m = rawText.match(re);
  if (!m || m.index == null) return { medication: null, dosage: null, spans: [] };

  const doseText = `${m[1]}${m[2]}`;
  const nameText = m[3].trim();
  const lower = rawText.toLowerCase();
  const doseStart = lower.indexOf(doseText.toLowerCase(), m.index);
  const nameStart = lower.indexOf(nameText.toLowerCase(), m.index);

  return { 
    medication: nameText, 
    dosage: doseText, 
    spans: [
      { field: "fields.dosage", startChar: doseStart, endChar: doseStart + doseText.length }, 
      { field: "fields.medication", startChar: nameStart, endChar: nameStart + nameText.length }
    ] 
  };
}

/**
 * PARSER: MEALS
 * Extracts food items following "ate" or "had" and looks for optional carb counts.
 */
function parseMeal(rawText: string) {
  const mealMatch = rawText.match(/(?:ate|had)\s+(.+?)(?=\s+for|\s+at|\s+with|\s+and|$)/i);
  const name = mealMatch ? mealMatch[1].trim().split(/\s+/)[0] : "unknown meal";
  const carbMatch = rawText.match(/(\d+)\s*(g|grams)\s*(carbs|of carbs)/i);
  
  const start = mealMatch ? rawText.toLowerCase().indexOf(name.toLowerCase(), mealMatch.index) : -1;
  const spans = start >= 0 ? [{ field: "fields.meal", startChar: start, endChar: start + name.length }] : [];
  
  if (carbMatch && carbMatch.index != null) {
    spans.push({ field: "fields.carbs", startChar: carbMatch.index, endChar: carbMatch.index + carbMatch[0].length });
  }

  return { name, carbs: carbMatch ? Number(carbMatch[1]) : null, spans };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: INFRASTRUCTURE & VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function loadSchema() {
  const schemaPath = path.join(process.cwd(), "docs/contracts/health-event.schema.json");
  return JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
}

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validateHealthEvent = ajv.compile(loadSchema());

function confidenceLevelFrom(confidence: number): "Low" | "Medium" | "High" {
  if (confidence < 0.4) return "Low";
  if (confidence < 0.75) return "Medium";
  return "High";
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: MAIN ROUTER
// ─────────────────────────────────────────────────────────────────────────────

export function extractFromText(rawText: string) {
  const textLower = rawText.toLowerCase();

  // 1. Run all extractions first
  const g = parseGlucose(rawText);
  const med = parseMedication(rawText);
  const meal = parseMeal(rawText);
  const sym = parseSymptom(rawText);

  // 2. SMART ROUTING: Priority-based selection
  let type: "glucose" | "medication" | "meal" | "symptom" = "symptom";

  if (g.value !== null) {
    type = "glucose";
  } else if (med.medication !== null) {
    type = "medication";
  } else if (sym.symptom !== null) {
    type = "symptom"; // This catches "headache" before "had" logic interferes
  } else if (textLower.includes("ate") || textLower.includes("had") || textLower.includes("lunch")) {
    type = "meal";
  }

  // 3. FIELD & SPAN MAPPING
  let fields: any = { symptom: sym.symptom, severity: null };
  let currentSpans: any[] = sym.spans;

  if (type === "glucose") { 
    fields = { value: g.value, unit: g.unit }; 
    currentSpans = g.spans; 
  } else if (type === "medication") { 
    fields = { medication: med.medication, dosage: med.dosage }; 
    currentSpans = med.spans; 
  } else if (type === "meal") { 
    fields = { meal: meal.name, carbs: meal.carbs }; 
    currentSpans = meal.spans; 
  }

  // 4. CLARIFICATION CHECK
  const needsClarification = 
    (type === "glucose" && g.value === null) || 
    (type === "medication" && (!med.medication || !med.dosage)) ||
    (type === "meal" && meal.name === "unknown meal") ||
    (type === "symptom" && !sym.symptom);

  // 5. FOLLOW-UP QUESTIONS
  let followUpQuestions: string[] = [];
  if (needsClarification) {
    followUpQuestions = type === "symptom" 
      ? ["What symptom are you feeling (e.g., headache, rash, nausea), and how severe is it?"]
      : ["Can you share more detail so I can log it correctly?"];
  }

  // 6. EVENT CONSTRUCTION
  const event: any = {
    id: "stub-0001",
    type,
    startTime: STUB_TIME,
    fields,
    confidence: 0.72,
    confidenceLevel: confidenceLevelFrom(0.72),
    needsClarification,
    provenance: {
      sourceInputId: "raw-input-stub",
      sourceSpans: currentSpans,
      modelVersion: MODEL_VERSION,
      extractionVersion: EXTRACTION_VERSION
    }
  };

  // 7. SCHEMA VALIDATION
  const ok = validateHealthEvent(event);
  if (!ok) {
    const err: any = new Error("HealthEvent failed schema validation");
    err.details = validateHealthEvent.errors;
    throw err;
  }

  return {
    events: [event],
    followUpQuestions,
    warnings: []
  };
}