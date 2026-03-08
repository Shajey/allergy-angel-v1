/**
 * Phase 23 – Research Provider Adapter
 *
 * Abstracts LLM calls so the implementation is not tightly coupled to one vendor.
 */

export interface ResearchProvider {
  researchEntity(args: {
    entity: string;
    entityType: string;
    contextEntities?: string[];
    radarMetadata?: Record<string, unknown>;
  }): Promise<string>;

  researchCombination(args: {
    entityA: string;
    entityB: string;
    typeA: string;
    typeB: string;
    radarTelemetry?: {
      occurrenceCount?: number;
      highRiskCount?: number;
      safeOccurrenceCount?: number;
      signalPattern?: string;
    };
  }): Promise<string>;
}

const ENTITY_SYSTEM_PROMPT = `You are a research assistant drafting structured proposals for admin review only.
You are NOT making medical decisions. You are NOT providing user-facing advice.
Rules:
- Do not overstate evidence. If uncertain, say so.
- If source evidence is not provided, do not invent authoritative citations. Frame any source mentions as "possible source areas" not verified citations.
- Output valid JSON only. No markdown, no explanation outside the JSON.
- Your output will never be shown directly to end users.
- You are drafting for admin review only.`;

const COMBINATION_SYSTEM_PROMPT = `You are a research assistant drafting structured proposals for admin review only.
You are NOT making medical decisions. You are NOT providing user-facing advice.
Rules:
- Do not overstate evidence. If uncertain, say so.
- If source evidence is not provided, do not invent authoritative citations. Frame any source mentions as "possible source areas" not verified citations.
- Output valid JSON only. No markdown, no explanation outside the JSON.
- Your output will never be shown directly to end users.
- You are drafting for admin review only.`;

const ENTITY_JSON_SCHEMA = {
  meta: { query: "string", queryType: "entity", researchedAt: "ISO8601", model: "string", sourceMode: "model_knowledge_only" },
  research: {
    identity: { canonicalName: "string", scientificName: "string?", commonAliases: "string[]", category: "string", class: "string?", description: "string", safetyNotes: "string?", evidenceQuality: "string", confidenceScore: "number", uncertaintyNotes: "string?" },
    confidenceScore: "number"
  },
  proposal: { proposalType: "create-entity|add-alias|no-action", registryType: "drug|supplement|food", entityDraft: "object?", aliasDraft: "object?", reasoning: "string", requiresHumanReview: true }
};

const COMBINATION_JSON_SCHEMA = {
  meta: { entityA: "string", entityB: "string", researchedAt: "ISO8601", model: "string", sourceMode: "model_knowledge_only" },
  research: { interactionFound: "boolean", interactionType: "specific|class|unclear|none", mechanism: "string?", severityHypothesis: "string?", evidenceLevel: "string", summary: "string", uncertaintyNotes: "string?", sourceNotes: "string?" },
  proposal: { proposalType: "create-relationship|investigate-only|no-action", relationshipDraft: "object?", reasoning: "string", requiresHumanReview: true }
};

/** Anthropic provider implementation */
export async function createAnthropicProvider(): Promise<ResearchProvider> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY. Research assistant requires Anthropic API key.");
  }
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022";

  return {
    async researchEntity(args) {
      const context = args.contextEntities?.length
        ? `Context entities: ${args.contextEntities.join(", ")}`
        : "";
      const radar = args.radarMetadata
        ? `Radar metadata: ${JSON.stringify(args.radarMetadata)}`
        : "";
      const userPrompt = `Research this entity for registry normalization:
Entity: ${args.entity}
Entity type: ${args.entityType}
${context}
${radar}

Return a JSON object matching this structure (output ONLY the JSON, no other text):
${JSON.stringify(ENTITY_JSON_SCHEMA, null, 2)}

Set sourceMode to "model_knowledge_only". Set requiresHumanReview to true.`;

      const msg = await client.messages.create({
        model,
        max_tokens: 2048,
        system: ENTITY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });
      const text = msg.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("");
      return extractJson(text);
    },

    async researchCombination(args) {
      const radar = args.radarTelemetry
        ? `Radar: ${JSON.stringify(args.radarTelemetry)}`
        : "";
      const userPrompt = `Research this entity combination for interaction/relationship gap:
Entity A: ${args.entityA} (${args.typeA})
Entity B: ${args.entityB} (${args.typeB})
${radar}

Return a JSON object matching this structure (output ONLY the JSON, no other text):
${JSON.stringify(COMBINATION_JSON_SCHEMA, null, 2)}

Set sourceMode to "model_knowledge_only". Set requiresHumanReview to true.`;

      const msg = await client.messages.create({
        model,
        max_tokens: 2048,
        system: COMBINATION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });
      const text = msg.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("");
      return extractJson(text);
    },
  };
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}
