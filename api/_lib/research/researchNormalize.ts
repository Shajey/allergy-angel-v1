/**
 * Coerce common LLM shape mistakes before AJV validation (Phase 23 / O4).
 */

function stripNullProps(obj: Record<string, unknown>): void {
  for (const k of Object.keys(obj)) {
    if (obj[k] === null) delete obj[k];
  }
}

const ENTITY_PROPOSAL_TYPES = new Set(["create-entity", "add-alias", "no-action"]);

/** Map common typos / alternate separators to schema enums. */
function coerceEntityProposalType(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().toLowerCase().replace(/_/g, "-");
  if (ENTITY_PROPOSAL_TYPES.has(t)) return t;
  const compact = t.replace(/\s+/g, "");
  if (compact === "createentity") return "create-entity";
  if (compact === "addalias") return "add-alias";
  if (compact === "noaction") return "no-action";
  return undefined;
}

/**
 * Mutates parsed JSON in place so entity research output is more likely to pass researchSchema.
 */
export function normalizeEntityResearchForSchema(
  parsed: unknown,
  opts?: { entityHint?: string }
): void {
  if (!parsed || typeof parsed !== "object") return;
  const o = parsed as Record<string, unknown>;

  const meta = o.meta as Record<string, unknown> | undefined;
  if (meta && typeof meta === "object") {
    if (meta.queryType !== "entity") meta.queryType = "entity";
    if (
      meta.sourceMode !== "model_knowledge_only" &&
      meta.sourceMode !== "provided_curated_sources"
    ) {
      meta.sourceMode = "model_knowledge_only";
    }
    stripNullProps(meta);
  }

  const research = o.research as Record<string, unknown> | undefined;
  if (research && typeof research === "object") {
    if (typeof research.confidenceScore === "string") {
      const n = parseFloat(research.confidenceScore);
      if (!Number.isNaN(n)) research.confidenceScore = n;
      else delete research.confidenceScore;
    }
    stripNullProps(research);

    const id = research.identity as Record<string, unknown> | undefined;
    if (id && typeof id === "object") {
      if (typeof id.canonicalName !== "string" || !String(id.canonicalName).trim()) {
        if (opts?.entityHint?.trim()) id.canonicalName = opts.entityHint.trim();
      }
      if (typeof id.commonAliases === "string") {
        id.commonAliases = id.commonAliases
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (id.commonAliases != null && !Array.isArray(id.commonAliases)) {
        id.commonAliases = [];
      }
      if (typeof id.confidenceScore === "string") {
        const n = parseFloat(id.confidenceScore);
        if (!Number.isNaN(n)) id.confidenceScore = n;
        else delete id.confidenceScore;
      }
      stripNullProps(id);
    }
  }

  const proposal = o.proposal as Record<string, unknown> | undefined;
  if (proposal && typeof proposal === "object") {
    proposal.requiresHumanReview = true;

    const rt = proposal.registryType;
    if (
      rt != null &&
      rt !== "" &&
      !["drug", "supplement", "food"].includes(String(rt))
    ) {
      delete proposal.registryType;
    }

    const coercedPt = coerceEntityProposalType(proposal.proposalType);
    if (coercedPt) proposal.proposalType = coercedPt;

    const ed = proposal.entityDraft as Record<string, unknown> | undefined;
    if (ed && typeof ed === "object") {
      if (typeof ed.aliases === "string") {
        ed.aliases = ed.aliases
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (ed.aliases != null && !Array.isArray(ed.aliases)) ed.aliases = [];
      stripNullProps(ed);
    }

    const ad = proposal.aliasDraft as Record<string, unknown> | null | undefined;
    if (ad && typeof ad === "object") {
      stripNullProps(ad);
    }

    stripNullProps(proposal);
  }
}

const COMBO_INTERACTION = new Set(["specific", "class", "unclear", "none"]);
const COMBO_PROPOSAL = new Set(["create-relationship", "investigate-only", "no-action"]);

export function normalizeCombinationResearchForSchema(parsed: unknown): void {
  if (!parsed || typeof parsed !== "object") return;
  const o = parsed as Record<string, unknown>;

  const meta = o.meta as Record<string, unknown> | undefined;
  if (meta && typeof meta === "object") {
    if (
      meta.sourceMode !== "model_knowledge_only" &&
      meta.sourceMode !== "provided_curated_sources"
    ) {
      meta.sourceMode = "model_knowledge_only";
    }
    stripNullProps(meta);
  }

  const research = o.research as Record<string, unknown> | undefined;
  if (research && typeof research === "object") {
    if (research.interactionFound === "true") research.interactionFound = true;
    if (research.interactionFound === "false") research.interactionFound = false;

    const it = research.interactionType;
    if (typeof it === "string") {
      const t = it.trim().toLowerCase();
      if (COMBO_INTERACTION.has(t)) research.interactionType = t;
    }
    stripNullProps(research);
  }

  const proposal = o.proposal as Record<string, unknown> | undefined;
  if (proposal && typeof proposal === "object") {
    proposal.requiresHumanReview = true;
    const pt = proposal.proposalType;
    if (typeof pt === "string") {
      const t = pt.trim().toLowerCase().replace(/_/g, "-");
      if (COMBO_PROPOSAL.has(t)) proposal.proposalType = t;
    }
    const rd = proposal.relationshipDraft as Record<string, unknown> | null | undefined;
    if (rd && typeof rd === "object") {
      if (typeof rd.confidenceScore === "string") {
        const n = parseFloat(rd.confidenceScore);
        if (!Number.isNaN(n)) rd.confidenceScore = n;
        else delete rd.confidenceScore;
      }
      stripNullProps(rd);
    }
    stripNullProps(proposal);
  }
}

/** Short human-readable AJV errors for API / UI. */
export function summarizeAjvErrors(errors: unknown, max = 6): string {
  if (!Array.isArray(errors) || errors.length === 0) return "";
  const lines = errors.slice(0, max).map((e) => {
    if (!e || typeof e !== "object") return String(e);
    const rec = e as { instancePath?: string; message?: string; params?: unknown };
    const path = rec.instancePath || "(root)";
    const msg = rec.message ?? "invalid";
    return `${path} ${msg}`;
  });
  const extra = errors.length > max ? `\n…+${errors.length - max} more` : "";
  return lines.join("\n") + extra;
}
