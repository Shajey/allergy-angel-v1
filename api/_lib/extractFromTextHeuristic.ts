import Ajv from "ajv";
import fs from "node:fs";
import path from "node:path";

/**
 * CONFIGURATION & CONSTANTS
 */
const EXTRACTION_VERSION = "v0-stub";
const MODEL_VERSION = "none-stub";

function nowIso() {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: DETERMINISTIC PARSERS (HEURISTICS)
// ─────────────────────────────────────────────────────────────────────────────

function parseSymptom(rawText: string) {
  const dictionary = [
    "headache",
    "rash",
    "nausea",
    "vomiting",
    "diarrhea",
    "cough",
    "fever",
    "itching",
    "hives",
    "sneezing",
    "congestion"
  ];
  const lower = rawText.toLowerCase();

  for (const s of dictionary) {
    const idx = lower.indexOf(s);
    if (idx >= 0) {
      return { symptom: s, spans: [{ field: "fields.symptom", startChar: idx, endChar: idx + s.length }] };
    }
  }

  // fallback span: whole input (capped)
  return {
    symptom: null as string | null,
    spans: [{ field: "fields.symptom", startChar: 0, endChar: Math.min(rawText.length, 120) }]
  };
}

function parseGlucose(rawText: string) {
  const re = /(\d{2,3})\s*(mg\/?d[lL]|mgdl)/i;
  const m = rawText.match(re);
  if (!m || m.index == null) return { value: null as number | null, unit: "mg/dL" as const, spans: [] as any[] };

  return {
    value: Number(m[1]),
    unit: "mg/dL" as const,
    spans: [{ field: "fields.value", startChar: m.index, endChar: m.index + m[0].length }]
  };
}

function parseMedication(rawText: string) {
  // Regex for: [dosage] [unit] [medication name]
  const re = /(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml)\s*(?:of\s+)?([A-Za-z][A-Za-z0-9\- ]{1,30})/i;
  const m = rawText.match(re);
  if (!m || m.index == null) return { medication: null as string | null, dosage: null as string | null, spans: [] as any[] };

  const doseText = `${m[1]}${m[2]}`; // e.g., "500mg"
  const nameText = m[3].trim(); // e.g., "Tylenol"

  // GUARD: Prevent nutrition words from being flagged as medication
  const nutritionWords = new Set([
    "carb",
    "carbs",
    "protein",
    "fat",
    "calorie",
    "calories",
    "kcal",
    "sugar",
    "fiber",
    "fibre",
    "sodium"
  ]);
  if (nutritionWords.has(nameText.toLowerCase())) {
    return { medication: null, dosage: null, spans: [] };
  }

  const lower = rawText.toLowerCase();
  const doseStart = lower.indexOf(doseText.toLowerCase(), m.index);
  const nameStart = lower.indexOf(nameText.toLowerCase(), m.index);

  // Defensive: if indexOf fails, fall back to match range
  const safeDoseStart = doseStart >= 0 ? doseStart : m.index;
  const safeDoseEnd = safeDoseStart + doseText.length;

  const safeNameStart = nameStart >= 0 ? nameStart : m.index;
  const safeNameEnd = safeNameStart + nameText.length;

  return {
    medication: nameText,
    dosage: doseText,
    spans: [
      { field: "fields.dosage", startChar: safeDoseStart, endChar: safeDoseEnd },
      { field: "fields.medication", startChar: safeNameStart, endChar: safeNameEnd }
    ]
  };
}

/**
 * Meal parsing rules (hardened):
 * - capture phrase after ate/had
 * - cut off at "for/with/at/and" to isolate food name chunk
 * - skip determiners (a/an/the)
 * - return up to 3 tokens as the meal name
 * - extract carbs if present (e.g., "45g of carbs", "45g carbs", "45 grams carbs")
 */
function parseMeal(rawText: string) {
  const lower = rawText.toLowerCase();

  // Capture everything after ate/had for a limited window
  const m = rawText.match(/\b(?:ate|had)\s+(.{1,80})/i);

  let mealName: string | null = null;
  const spans: Array<{ field: string; startChar: number; endChar: number }> = [];

  if (m && m.index != null) {
    // isolate a phrase likely to be the food name
    let phrase = m[1].trim();

    // cut at common separators (meal context words)
    phrase = phrase.split(/\b(?:for|with|at|and)\b/i)[0].trim(); // e.g., "a salad" from "a salad for lunch with..."

    const tokens = phrase.split(/\s+/).filter(Boolean);

    const determiners = new Set(["a", "an", "the"]);
    let i = 0;
    while (i < tokens.length && determiners.has(tokens[i].toLowerCase())) i++;

    const picked = tokens.slice(i, i + 3).join(" ").trim();
    mealName = picked.length ? picked : null;

    if (mealName) {
      const mealLower = mealName.toLowerCase();
      const searchFrom = m.index;
      const start = lower.indexOf(mealLower, searchFrom);
      if (start >= 0) {
        spans.push({ field: "fields.meal", startChar: start, endChar: start + mealName.length });
      }
    }
  }

  // Carbs extraction (allow "45g carbs", "45g of carbs", "45 grams carbs")
  const carbRe = /(\d+(?:\.\d+)?)\s*(g|gram|grams)\s*(?:of\s+)?carbs?\b/i;
  const carbMatch = rawText.match(carbRe);
  const carbs = carbMatch ? Number(carbMatch[1]) : null;

  if (carbMatch && carbMatch.index != null) {
    spans.push({ field: "fields.carbs", startChar: carbMatch.index, endChar: carbMatch.index + carbMatch[0].length });
  }

  // If we couldn't find a precise meal span but we did detect meal intent, provide a reasonable fallback
  if (!spans.some((s) => s.field === "fields.meal") && mealName === null && m && m.index != null) {
    spans.push({ field: "fields.meal", startChar: m.index, endChar: Math.min(rawText.length, m.index + 120) });
  }

  return { name: mealName, carbs, spans };
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
  if (confidence <= 0.7) return "Medium";
  return "High";
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: HEURISTIC EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

export async function extractFromTextHeuristic(rawText: string) {
  const g = parseGlucose(rawText);
  const med = parseMedication(rawText);
  const meal = parseMeal(rawText);
  const sym = parseSymptom(rawText);

  const hasMedicationIntent = /\b(took|take|taken|swallowed|pill|tablet|capsule|medicine|medication)\b/i.test(rawText);
  const hasMealIntent = /\b(ate|had|lunch|dinner|breakfast|snack)\b/i.test(rawText);

  // Routing precedence: Glucose -> Meal -> Meds (only if intent) -> Symptom
  let type: "glucose" | "medication" | "meal" | "symptom" = "symptom";

  if (g.value !== null) {
    type = "glucose";
  } else if (hasMealIntent) {
    type = "meal";
  } else if (hasMedicationIntent && med.medication !== null) {
    type = "medication";
  } else if (sym.symptom !== null) {
    type = "symptom";
  } else {
    type = "symptom";
  }

  // Field + spans
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

  const needsClarification =
    (type === "glucose" && g.value === null) ||
    (type === "medication" && (!med.medication || !med.dosage)) ||
    (type === "meal" && !meal.name) ||
    (type === "symptom" && !sym.symptom);

  let followUpQuestions: string[] = [];
  if (needsClarification) {
    followUpQuestions =
      type === "symptom"
        ? ["What symptom are you feeling (e.g., headache, rash, nausea), and how severe is it?"]
        : type === "meal"
          ? ["What did you eat? (e.g., salad, rice, chicken)"]
          : ["Can you share more detail so I can log it correctly?"];
  }

  const event: any = {
    id: "stub-0001",
    type,
    startTime: nowIso(),
    fields,
    confidence: 0.72,
    confidenceScore: Math.round(0.72 * 100),
    confidenceLevel: confidenceLevelFrom(0.72),
    needsClarification,
    provenance: {
      sourceInputId: "raw-input-stub",
      sourceSpans: currentSpans,
      modelVersion: MODEL_VERSION,
      extractionVersion: EXTRACTION_VERSION
    }
  };

  const ok = validateHealthEvent(event);
  if (!ok) {
    const err: any = new Error("HealthEvent failed schema validation");
    err.details = validateHealthEvent.errors;
    err.statusCode = 500;
    throw err;
  }

  return {
    events: [event],
    followUpQuestions,
    warnings: []
  };
}
