# Allergy Angel Extraction Prompt (v1)

Extract health events from user text. Return JSON only.

## Output Format

Return valid JSON matching this exact structure:
```json
{
  "events": [HealthEvent],
  "followUpQuestions": [string],
  "warnings": [string]
}
```

## HealthEvent Structure — STRICT SCHEMA (READ CAREFULLY)

**WARNING: If you do not follow the JSON schema perfectly, the system will reject your response.** Every event is validated with AJV against `health-event.schema.json`. Any deviation causes an automatic rejection.

### Top-Level Required Properties (every event, every type)

Every HealthEvent object MUST include ALL of the following. Do not omit any of them:

| Property             | Type    | Description |
|----------------------|---------|-------------|
| `type`               | string  | One of: `"meal"` `"symptom"` `"medication"` `"supplement"` `"workout"` `"sleep"` `"glucose"` `"environment"` `"note"` |
| `fields`             | object  | Type-specific data (see Required Properties per Type below) |
| `confidence`         | number  | Decimal 0–1. How certain you are about this extraction |
| `confidenceScore`    | integer | `Math.round(confidence * 100)`. Integer 0–100 |
| `confidenceLevel`    | string  | `"Low"` (< 0.4) · `"Medium"` (0.4–0.7) · `"High"` (> 0.7) |
| `needsClarification` | boolean | `true` if any required detail is missing or ambiguous |
| `provenance`         | object  | See Provenance below |

### Provenance (required sub-object)

| Property            | Type   | Value |
|---------------------|--------|-------|
| `sourceInputId`     | string | Always `"raw-input-llm"` |
| `sourceSpans`       | array  | `[{ "field": string, "startChar": integer, "endChar": integer }]` — character positions in the input |
| `modelVersion`      | string | Always `"openai"` |
| `extractionVersion` | string | Always `"v0-llm-v1"` |

### Optional Top-Level Properties

- `id`: string
- `startTime`: ISO 8601 string (use {{current_date}} for relative phrases like "today", "yesterday", "this morning")
- `endTime`: ISO 8601 string

### Required Properties per Type (inside `fields`)

Do not omit these keys; use `null` if unknown.

**medication** — ALL THREE are MANDATORY:

| Key          | Type           | Notes |
|--------------|----------------|-------|
| `medication` | string or null | The drug/medicine name |
| `dosage`     | number or null | **The `dosage` field MUST be a NUMBER, not a string.** If the text says "500mg", split it: `"dosage": 500, "unit": "mg"`. NEVER return `"dosage": "500mg"`. |
| `unit`       | string or null | The unit of measure. Common values: `"mg"`, `"mcg"`, `"g"`, `"ml"`, `"IU"` |

**meal** — MANDATORY:

| Key    | Type           | Notes |
|--------|----------------|-------|
| `meal` | string or null | Description of what was eaten |
| `carbs`| number or null | Grams of carbohydrates (optional but include key) |

**symptom** — MANDATORY:

| Key        | Type           | Notes |
|------------|----------------|-------|
| `symptom`  | string or null | Description of the symptom |
| `severity` | string or null | e.g. "mild", "moderate", "severe" (optional but include key) |

**glucose** — MANDATORY:

| Key     | Type           | Notes |
|---------|----------------|-------|
| `value` | number or null | The glucose reading |
| `unit`  | string         | Always `"mg/dL"` |

**supplement** — MANDATORY:

| Key          | Type           | Notes |
|--------------|----------------|-------|
| `supplement` | string or null | Name of the supplement |
| `dosage`     | string or null | Dosage as text (optional but include key) |

**workout**:

| Key        | Type           | Notes |
|------------|----------------|-------|
| `activity` | string or null | Description of the exercise |
| `duration` | string or null | e.g. "30 minutes" (optional but include key) |

**sleep**:

| Key       | Type           | Notes |
|-----------|----------------|-------|
| `quality` | string or null | e.g. "good", "poor", "restless" |
| `duration`| string or null | e.g. "8 hours" (optional but include key) |

**environment**:

| Key       | Type           | Notes |
|-----------|----------------|-------|
| `trigger` | string or null | The environmental trigger |

**note**:

| Key    | Type           | Notes |
|--------|----------------|-------|
| `text` | string or null | Free-text note content |

### FINAL REMINDER

- Do not omit these keys; use `null` if unknown.
- The `dosage` field for medication MUST be a NUMBER, not a string.
- `confidenceScore` MUST be an integer 0–100 derived from `confidence`.
- If you do not follow the JSON schema perfectly, the system will reject your response.

## Rules

1. **Extract multiple events** if the text contains multiple distinct health events.
2. **Include sourceSpans**: For each extracted field, provide best-effort character spans (startChar, endChar) indicating where in the input text the information came from.
3. **Use {{current_date}}**: For relative time phrases (today, yesterday, this morning, etc.), use {{current_date}} as the date reference.
4. **Confidence consistency**: Ensure `confidenceLevel` matches `confidence`:
   - confidence < 0.4 → confidenceLevel = "Low"
   - confidence >= 0.4 and <= 0.7 → confidenceLevel = "Medium"
   - confidence > 0.7 → confidenceLevel = "High"
5. **Missing details**: If required fields are missing or ambiguous, set `needsClarification: true` and add a specific question to `followUpQuestions`.
6. **Warnings**: Add warnings for any extraction issues or ambiguities.

## Example

Input: "I took 500mg ibuprofen this morning and had a headache around noon"

Output:
```json
{
  "events": [
    {
      "type": "medication",
      "startTime": "{{current_date}}T08:00:00.000Z",
      "fields": { "medication": "ibuprofen", "dosage": 500, "unit": "mg" },
      "confidence": 0.9,
      "confidenceScore": 90,
      "confidenceLevel": "High",
      "needsClarification": false,
      "provenance": {
        "sourceInputId": "raw-input-llm",
        "sourceSpans": [
          { "field": "fields.medication", "startChar": 8, "endChar": 17 },
          { "field": "fields.dosage", "startChar": 18, "endChar": 21 },
          { "field": "fields.unit", "startChar": 21, "endChar": 23 }
        ],
        "modelVersion": "openai",
        "extractionVersion": "v0-llm-v1"
      }
    },
    {
      "type": "symptom",
      "startTime": "{{current_date}}T12:00:00.000Z",
      "fields": { "symptom": "headache", "severity": null },
      "confidence": 0.85,
      "confidenceScore": 85,
      "confidenceLevel": "High",
      "needsClarification": true,
      "provenance": {
        "sourceInputId": "raw-input-llm",
        "sourceSpans": [
          { "field": "fields.symptom", "startChar": 54, "endChar": 62 }
        ],
        "modelVersion": "openai",
        "extractionVersion": "v0-llm-v1"
      }
    }
  ],
  "followUpQuestions": ["How severe was the headache? (mild, moderate, severe)"],
  "warnings": []
}
```

---

Extract from this input:

{{RAW_TEXT}}
