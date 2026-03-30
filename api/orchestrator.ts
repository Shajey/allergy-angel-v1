import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { discoverUnmapped } from "./_lib/admin/unmappedDiscovery.js";
import { buildPromotionExport } from "./_lib/admin/promotionExport.js";
import { isUuidLike } from "./_lib/validation/isUuidLike.js";
import {
  listRegistry,
  searchRegistry,
  getRegistryEntry,
  aliasExistsInStaticRegistry,
  getEntryByCanonicalId,
  type RegistryType,
} from "./_lib/admin/registryBrowser.js";
import {
  createProposal,
  listProposals,
  dismissProposal,
  markProposalsExported,
  buildAliasProposalExportChange,
} from "./_lib/admin/aliasProposalStore.js";
import {
  applyPromotedProposalsToSharedRegistry,
  ensurePromotedRegistryLoaded,
} from "./_lib/knowledge/promotedRegistryDb.js";
import {
  getRadarEntities,
  getRadarCombinations,
  getRadarStats,
  getRadarSignals,
} from "./_lib/admin/radarQueries.js";
import { getGraphForFocus } from "./_lib/admin/graphQueries.js";

function normalizeAlias(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Orchestrator Admin API – single serverless function for all admin/orchestrator actions.
 * Routes via ?action= to reduce Vercel Hobby plan function count.
 *
 * /api/orchestrator?action=radar-entities
 * /api/orchestrator?action=registry-list
 * /api/orchestrator?action=ingestion-candidates
 * etc.
 */
function isAdminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "true";
}

function isMissingTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /relation.*does not exist|table.*does not exist|does not exist/i.test(msg);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = typeof req.query.action === "string" ? req.query.action : "";

  if (!isAdminEnabled()) {
    const details =
      process.env.NODE_ENV !== "production"
        ? "ADMIN_ENABLED is not 'true'. Set ADMIN_ENABLED=true in .env.local and restart the server."
        : null;
    return res.status(404).json({ error: "Not Found", details });
  }

  switch (action) {
    case "unmapped":
      return handleUnmapped(req, res);
    case "pr-packager":
      return handlePrPackager(req, res);
    case "promotion-export":
      return handlePromotionExport(req, res);
    case "registry-list":
      return handleRegistryList(req, res);
    case "registry-search":
      return handleRegistrySearch(req, res);
    case "registry-entry":
      return handleRegistryEntry(req, res);
    case "alias-proposals":
      return handleAliasProposals(req, res);
    case "alias-propose-add":
      return handleAliasProposeAdd(req, res);
    case "alias-propose-remove":
      return handleAliasProposeRemove(req, res);
    case "alias-proposal-dismiss":
      return handleAliasProposalDismiss(req, res);
    case "alias-proposal-export":
      return handleAliasProposalExport(req, res);
    case "radar-entities":
      return handleRadarEntities(req, res);
    case "radar-combinations":
      return handleRadarCombinations(req, res);
    case "radar-stats":
      return handleRadarStats(req, res);
    case "radar-signals":
      return handleRadarSignals(req, res);
    case "graph-focus":
      return handleGraphFocus(req, res);
    case "research-entity":
      return handleResearchEntity(req, res);
    case "research-combination":
      return handleResearchCombination(req, res);
    case "ingestion-candidates":
      return handleIngestionCandidates(req, res);
    case "ingestion-stats":
      return handleIngestionStats(req, res);
    case "ingestion-create-proposal":
      return handleIngestionCreateProposal(req, res);
    case "ingestion-dismiss":
      return handleIngestionDismiss(req, res);
    default:
      return res.status(400).json({
        error: "Missing or invalid action",
        details:
          "Use ?action=unmapped|pr-packager|promotion-export|registry-list|registry-search|registry-entry|alias-proposals|radar-entities|radar-combinations|radar-stats|radar-signals|graph-focus|research-entity|research-combination|ingestion-candidates|ingestion-stats|ingestion-create-proposal|ingestion-dismiss",
      });
  }
}

async function handleUnmapped(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const profileId =
      typeof req.query.profileId === "string" ? req.query.profileId.trim() : "";
    if (!profileId) {
      return res.status(400).json({
        error: "Missing required query parameter: profileId",
        details: null,
      });
    }
    if (!isUuidLike(profileId)) {
      return res.status(400).json({
        error: "profileId must be a valid UUID format",
        details: null,
      });
    }
    const windowHours = Math.min(
      Math.max(parseInt(String(req.query.windowHours), 10) || 168, 1),
      720
    );
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit), 10) || 20, 1),
      100
    );
    const result = await discoverUnmapped({ profileId, windowHours, limit });
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Discovery failed";
    console.error("[Orchestrator] unmapped failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
}

async function handlePrPackager(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  return res.status(400).json({
    error: "Use CLI locally",
    details:
      "PR Packager requires spawning replay validation. Run: npm run pr:pack -- --profileId=... --selectTaxonomy=... --parent=... --mode=crossReactive [--runReplay] [--strict]",
  });
}

async function handlePromotionExport(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({
        error: "Request body must be a JSON object",
        details: null,
      });
    }
    const profileId =
      typeof body.profileId === "string" ? body.profileId.trim() : "";
    if (!profileId) {
      return res.status(400).json({
        error: "Missing required field: profileId",
        details: null,
      });
    }
    if (!isUuidLike(profileId)) {
      return res.status(400).json({
        error: "profileId must be a valid UUID format",
        details: null,
      });
    }
    const windowHours = Math.min(
      Math.max(parseInt(String(body.windowHours), 10) || 168, 1),
      720
    );
    const limit = Math.min(
      Math.max(parseInt(String(body.limit), 10) || 20, 1),
      100
    );
    const modeRaw = body.mode;
    const mode =
      modeRaw === "suggest" ? "suggest" : modeRaw === "blank" ? "blank" : "blank";
    const result = await buildPromotionExport({
      profileId,
      windowHours,
      limit,
      mode,
    });
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Promotion export failed";
    console.error("[Orchestrator] promotion-export failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
}

async function handleRegistryList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  const type = (req.query.type as string)?.trim();
  if (!type || !["drug", "supplement", "food"].includes(type)) {
    return res.status(400).json({
      error: "Missing or invalid type",
      details: "Use ?action=registry-list&type=drug|supplement|food",
    });
  }
  try {
    await ensurePromotedRegistryLoaded();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registry load failed";
    console.error("[Orchestrator] registry-list hydrate failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
  const result = listRegistry(type as RegistryType);
  return res.status(200).json(result);
}

async function handleRegistrySearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  const search = (req.query.search as string)?.trim();
  if (!search) {
    return res.status(400).json({
      error: "Missing search",
      details: "Use ?action=registry-search&search=...",
    });
  }
  const type = (req.query.type as string)?.trim();
  const typeFilter =
    type && ["drug", "supplement", "food"].includes(type)
      ? (type as RegistryType)
      : undefined;
  try {
    await ensurePromotedRegistryLoaded();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registry load failed";
    console.error("[Orchestrator] registry-search hydrate failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
  const result = searchRegistry(search, typeFilter);
  return res.status(200).json(result);
}

async function handleRegistryEntry(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  const type = (req.query.type as string)?.trim();
  const id = (req.query.id as string)?.trim();
  if (!type || !id) {
    return res.status(400).json({
      error: "Missing type or id",
      details: "Use ?action=registry-entry&type=drug|supplement|food&id=...",
    });
  }
  if (!["drug", "supplement", "food"].includes(type)) {
    return res.status(400).json({ error: "Invalid type", details: null });
  }
  try {
    await ensurePromotedRegistryLoaded();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registry load failed";
    console.error("[Orchestrator] registry-entry hydrate failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
  const entry = getRegistryEntry(type as RegistryType, id);
  if (!entry) {
    return res.status(404).json({ error: "Entry not found", details: null });
  }
  return res.status(200).json({ entry });
}

async function handleAliasProposals(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const type = (req.query.type as string)?.trim();
    const status = (req.query.status as string)?.trim() || "pending";
    const proposals = await listProposals({
      registry_type:
        type && ["drug", "supplement", "food"].includes(type)
          ? (type as RegistryType)
          : undefined,
      status:
        status && ["pending", "exported", "dismissed"].includes(status)
          ? (status as "pending" | "exported" | "dismissed")
          : "pending",
    });
    return res.status(200).json({ meta: { count: proposals.length }, proposals });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "List proposals failed";
    console.error("[Orchestrator] alias-proposals failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
}

async function handleAliasProposeAdd(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return res.status(400).json({
        error: "Request body required",
        details: null,
      });
    }
    const type = (body.type as string)?.trim();
    const id = (body.id as string)?.trim();
    const alias = (body.alias as string)?.trim();
    if (!type || !id || !alias) {
      return res.status(400).json({
        error: "Missing required fields: type, id, alias",
        details: null,
      });
    }
    if (!["drug", "supplement", "food"].includes(type)) {
      return res.status(400).json({ error: "Invalid type", details: null });
    }

    const normalizedAlias = normalizeAlias(alias);
    try {
      await ensurePromotedRegistryLoaded();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Registry load failed";
      return res.status(500).json({ error: message, details: null });
    }
    if (aliasExistsInStaticRegistry(normalizedAlias)) {
      return res.status(400).json({
        error: "Alias already exists in registry",
        details: { alias: normalizedAlias },
      });
    }

    const entry = getEntryByCanonicalId(type as RegistryType, id);
    if (!entry) {
      return res.status(404).json({
        error: "Canonical entry not found",
        details: { type, id },
      });
    }

    const proposal = await createProposal({
      registry_type: type as RegistryType,
      canonical_id: id,
      proposed_alias: normalizedAlias,
      proposal_action: "add-alias",
      created_by: (body.created_by as string) ?? undefined,
      notes: (body.notes as string) ?? undefined,
    });

    return res.status(200).json({
      success: true,
      proposal: {
        registry_type: proposal.registry_type,
        canonical_id: proposal.canonical_id,
        proposed_alias: proposal.proposed_alias,
        proposal_action: proposal.proposal_action,
        status: proposal.status,
      },
      message: "Draft alias proposal created",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Create proposal failed";
    if (message.includes("duplicate") || message.includes("unique")) {
      return res.status(400).json({
        error: "Identical pending proposal already exists",
        details: null,
      });
    }
    console.error("[Orchestrator] alias-propose-add failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
}

async function handleAliasProposeRemove(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return res.status(400).json({
        error: "Request body required",
        details: null,
      });
    }
    const type = (body.type as string)?.trim();
    const id = (body.id as string)?.trim();
    const alias = (body.alias as string)?.trim();
    if (!type || !id || !alias) {
      return res.status(400).json({
        error: "Missing required fields: type, id, alias",
        details: null,
      });
    }
    if (!["drug", "supplement", "food"].includes(type)) {
      return res.status(400).json({ error: "Invalid type", details: null });
    }

    try {
      await ensurePromotedRegistryLoaded();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Registry load failed";
      return res.status(500).json({ error: message, details: null });
    }

    const entry = getRegistryEntry(type as RegistryType, id);
    if (!entry) {
      return res.status(404).json({
        error: "Canonical entry not found",
        details: { type, id },
      });
    }

    const normalizedAlias = normalizeAlias(alias);
    const hasAlias = entry.aliases.some(
      (a) => normalizeAlias(a) === normalizedAlias
    );
    if (!hasAlias) {
      return res.status(400).json({
        error: "Alias not found in entry",
        details: { alias: normalizedAlias, entryId: id },
      });
    }

    const proposal = await createProposal({
      registry_type: type as RegistryType,
      canonical_id: id,
      proposed_alias: normalizedAlias,
      proposal_action: "remove-alias",
      created_by: (body.created_by as string) ?? undefined,
      notes: (body.notes as string) ?? undefined,
    });

    return res.status(200).json({
      success: true,
      proposal: {
        registry_type: proposal.registry_type,
        canonical_id: proposal.canonical_id,
        proposed_alias: proposal.proposed_alias,
        proposal_action: proposal.proposal_action,
        status: proposal.status,
      },
      message: "Draft remove-alias proposal created",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Create proposal failed";
    if (message.includes("duplicate") || message.includes("unique")) {
      return res.status(400).json({
        error: "Identical pending proposal already exists",
        details: null,
      });
    }
    console.error("[Orchestrator] alias-propose-remove failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
}

async function handleAliasProposalDismiss(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const body = req.body as Record<string, unknown> | null;
    const proposalId = (body?.proposalId as string)?.trim();
    if (!proposalId) {
      return res.status(400).json({
        error: "Missing proposalId",
        details: null,
      });
    }
    if (!isUuidLike(proposalId)) {
      return res.status(400).json({
        error: "proposalId must be a valid UUID",
        details: null,
      });
    }
    await dismissProposal(proposalId);
    return res.status(200).json({ success: true, message: "Proposal dismissed" });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Dismiss proposal failed";
    console.error("[Orchestrator] alias-proposal-dismiss failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
}

async function handleAliasProposalExport(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const body = req.body as Record<string, unknown> | null;
    const proposalIds = body?.proposalIds as string[] | undefined;
    if (!Array.isArray(proposalIds) || proposalIds.length === 0) {
      return res.status(400).json({
        error: "Missing or empty proposalIds array",
        details: null,
      });
    }

    const proposals = await listProposals({ status: "pending" });
    const toExport = proposals.filter((p) => proposalIds.includes(p.id));
    if (toExport.length === 0) {
      return res.status(400).json({
        error: "No pending proposals found for given IDs",
        details: null,
      });
    }

    const changes = toExport.map((p) => buildAliasProposalExportChange(p));

    try {
      await applyPromotedProposalsToSharedRegistry(toExport);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Apply promotion to registry failed";
      if (isMissingTable(err)) {
        return res.status(503).json({
          error: "Promotion storage not available",
          details:
            "Run docs/migrations/010_promoted_registry_entities.sql on Supabase, then retry.",
        });
      }
      console.error("[Orchestrator] alias-proposal-export apply failed:", message);
      return res.status(500).json({ error: message, details: null });
    }

    await markProposalsExported(toExport.map((p) => p.id));

    const exportPayload = {
      meta: {
        exportType: "alias-proposals",
        generatedAt: new Date().toISOString(),
        count: changes.length,
      },
      changes,
    };

    return res.status(200).json(exportPayload);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Export proposals failed";
    console.error("[Orchestrator] alias-proposal-export failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
}

async function handleRadarEntities(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit), 10) || 50, 1),
      200
    );
    const windowDays = Math.min(
      Math.max(parseInt(String(req.query.windowDays), 10) || 30, 1),
      365
    );
    const result = await getRadarEntities(limit, windowDays);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Radar entities failed";
    const details = isMissingTable(err)
      ? "Required telemetry table is missing or not migrated yet."
      : null;
    console.error("[Orchestrator] radar-entities failed:", message);
    return res.status(500).json({ error: "Radar data unavailable", details });
  }
}

async function handleRadarCombinations(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit), 10) || 50, 1),
      200
    );
    const windowDays = Math.min(
      Math.max(parseInt(String(req.query.windowDays), 10) || 30, 1),
      365
    );
    const result = await getRadarCombinations(limit, windowDays);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Radar combinations failed";
    const details = isMissingTable(err)
      ? "Required telemetry table is missing or not migrated yet."
      : null;
    console.error("[Orchestrator] radar-combinations failed:", message);
    return res.status(500).json({ error: "Radar data unavailable", details });
  }
}

async function handleRadarStats(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const windowDays = Math.min(
      Math.max(parseInt(String(req.query.windowDays), 10) || 30, 1),
      365
    );
    const result = await getRadarStats(windowDays);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Radar stats failed";
    const details = isMissingTable(err)
      ? "Required telemetry table is missing or not migrated yet."
      : null;
    console.error("[Orchestrator] radar-stats failed:", message);
    return res.status(500).json({ error: "Radar data unavailable", details });
  }
}

async function handleGraphFocus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const entity = (req.query.entity as string)?.trim();
    const entityA = (req.query.entityA as string)?.trim();
    const entityB = (req.query.entityB as string)?.trim();
    if (!entity && !entityA && !entityB) {
      return res.status(400).json({
        error: "Missing focus",
        details: "Use ?entity=... or ?entityA=...&entityB=...",
      });
    }
    await ensurePromotedRegistryLoaded();
    const result = await getGraphForFocus({ entity, entityA, entityB });
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Graph focus failed";
    console.error("[Orchestrator] graph-focus failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
}

async function handleRadarSignals(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit), 10) || 50, 1),
      200
    );
    const windowDays = Math.min(
      Math.max(parseInt(String(req.query.windowDays), 10) || 30, 1),
      365
    );
    const result = await getRadarSignals(limit, windowDays);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Radar signals failed";
    const details = isMissingTable(err)
      ? "Required telemetry table is missing or not migrated yet."
      : null;
    console.error("[Orchestrator] radar-signals failed:", message);
    return res.status(500).json({ error: "Radar data unavailable", details });
  }
}

async function handleResearchEntity(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const body = (req.body as Record<string, unknown>) ?? {};
    const entity = String(body.entity ?? "").trim();
    const entityType = String(body.entityType ?? "unknown").trim();
    if (!entity) {
      return res.status(400).json({
        error: "Missing required field: entity",
        details: null,
      });
    }
    const contextEntities = Array.isArray(body.contextEntities)
      ? (body.contextEntities as string[]).filter(Boolean)
      : undefined;
    const radarMetadata = typeof body.radarMetadata === "object" && body.radarMetadata
      ? (body.radarMetadata as Record<string, unknown>)
      : undefined;
    const forceResearch = body.forceResearch === true;

    const { createAnthropicProvider } = await import("./_lib/research/researchProvider.js");
    const { researchEntity: doResearch } = await import("./_lib/research/researchService.js");
    const provider = await createAnthropicProvider();
    const outcome = await doResearch(provider, {
      entity,
      entityType,
      contextEntities,
      radarMetadata,
      forceResearch,
    });

    if ("researchSkipped" in outcome && outcome.researchSkipped) {
      return res.status(200).json({
        researchSkipped: true,
        reason: outcome.reason,
        recommendation: outcome.recommendation,
      });
    }
    if (!outcome.success) {
      return res.status(400).json({
        error: outcome.error.message,
        code: outcome.error.code,
        details: outcome.error.details ?? null,
      });
    }
    return res.status(200).json({
      meta: {
        ...outcome.result.meta,
        researchKey: outcome.meta.researchKey,
        cached: outcome.meta.cached,
        model: outcome.meta.model,
        promptVersion: outcome.meta.promptVersion,
      },
      research: outcome.result.research,
      proposal: {
        ...outcome.result.proposal,
        entityDraft: outcome.entityDraft ?? undefined,
        aliasDraft: outcome.aliasDraft ?? undefined,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Research failed";
    console.error("[Orchestrator] research-entity failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
}

async function handleResearchCombination(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const body = (req.body as Record<string, unknown>) ?? {};
    const entityA = String(body.entityA ?? "").trim();
    const entityB = String(body.entityB ?? "").trim();
    const typeA = String(body.typeA ?? "unknown").trim();
    const typeB = String(body.typeB ?? "unknown").trim();
    if (!entityA || !entityB) {
      return res.status(400).json({
        error: "Missing required fields: entityA, entityB",
        details: null,
      });
    }
    const radarTelemetry =
      typeof body.radarTelemetry === "object" && body.radarTelemetry
        ? (body.radarTelemetry as {
            occurrenceCount?: number;
            highRiskCount?: number;
            safeOccurrenceCount?: number;
            signalPattern?: string;
          })
        : undefined;
    const forceResearch = body.forceResearch === true;

    const { createAnthropicProvider } = await import("./_lib/research/researchProvider.js");
    const { researchCombination: doResearch } = await import("./_lib/research/researchService.js");
    const provider = await createAnthropicProvider();
    const outcome = await doResearch(provider, {
      entityA,
      entityB,
      typeA,
      typeB,
      radarTelemetry,
      forceResearch,
    });

    if ("researchSkipped" in outcome && outcome.researchSkipped) {
      return res.status(200).json({
        researchSkipped: true,
        reason: outcome.reason,
        recommendation: outcome.recommendation,
      });
    }
    if (!outcome.success) {
      return res.status(400).json({
        error: outcome.error.message,
        code: outcome.error.code,
        details: outcome.error.details ?? null,
      });
    }
    return res.status(200).json({
      meta: {
        ...outcome.result.meta,
        researchKey: outcome.meta.researchKey,
        cached: outcome.meta.cached,
        model: outcome.meta.model,
        promptVersion: outcome.meta.promptVersion,
      },
      research: outcome.result.research,
      proposal: {
        ...outcome.result.proposal,
        relationshipDraft: outcome.relationshipDraft ?? undefined,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Research failed";
    console.error("[Orchestrator] research-combination failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
}

async function handleIngestionCandidates(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const status = (req.query.status as string)?.trim();
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit), 10) || 50, 1),
      200
    );
    const { fetchCandidates } = await import("./_lib/ingestion/candidateStore.js");
    const validStatus = ["pending", "duplicate", "promoted", "dismissed"];
    const filterStatus =
      status && validStatus.includes(status)
        ? (status as "pending" | "duplicate" | "promoted" | "dismissed")
        : undefined;
    const candidates = await fetchCandidates({
      status: filterStatus,
      limit,
    });
    return res.status(200).json({ meta: { count: candidates.length }, candidates });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ingestion candidates failed";
    const details = isMissingTable(err)
      ? "Required ingestion_candidates table is missing or not migrated yet."
      : null;
    console.error("[Orchestrator] ingestion-candidates failed:", message);
    return res.status(500).json({ error: "Ingestion data unavailable", details });
  }
}

async function handleIngestionStats(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const { getCandidateStats } = await import("./_lib/ingestion/candidateStore.js");
    const stats = await getCandidateStats();
    return res.status(200).json(stats);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ingestion stats failed";
    const details = isMissingTable(err)
      ? "Required ingestion_candidates table is missing or not migrated yet."
      : null;
    console.error("[Orchestrator] ingestion-stats failed:", message);
    return res.status(500).json({ error: "Ingestion data unavailable", details });
  }
}

async function handleIngestionCreateProposal(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const body = (req.body as Record<string, unknown>) ?? {};
    const candidateId = String(body.candidateId ?? "").trim();
    if (!candidateId) {
      return res.status(400).json({
        error: "Missing required field: candidateId",
        details: null,
      });
    }
    const { fetchCandidateById, updateCandidateStatus } = await import(
      "./_lib/ingestion/candidateStore.js"
    );
    const { createProposal } = await import("./_lib/admin/aliasProposalStore.js");
    const candidate = await fetchCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({
        error: "Candidate not found",
        details: null,
      });
    }
    if (candidate.status !== "pending") {
      return res.status(400).json({
        error: "Only pending candidates can be converted to proposals",
        details: null,
      });
    }
    if (candidate.registryType !== "drug") {
      return res.status(400).json({
        error: "Only drug candidates supported in this phase",
        details: null,
      });
    }
    const proposal = await createProposal({
      registry_type: "drug",
      canonical_id: candidate.canonicalId,
      proposed_alias: candidate.name,
      proposal_action: "create-entry",
      proposed_entry: {
        name: candidate.name,
        aliases: candidate.aliases,
        class: candidate.class,
      },
      created_by: (body.createdBy as string) ?? undefined,
      notes: `From ingestion: ${candidate.source.dataset} ${candidate.source.recordId}`,
    });
    await updateCandidateStatus(candidateId, "promoted", (body.createdBy as string) ?? undefined);
    return res.status(200).json({
      success: true,
      proposal: {
        id: proposal.id,
        registry_type: proposal.registry_type,
        canonical_id: proposal.canonical_id,
        proposal_action: proposal.proposal_action,
        status: proposal.status,
      },
      message: "Draft proposal created. Governed flow applies.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Create proposal failed";
    console.error("[Orchestrator] ingestion-create-proposal failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
}

async function handleIngestionDismiss(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed", details: null });
  }
  try {
    const body = (req.body as Record<string, unknown>) ?? {};
    const candidateId = String(body.candidateId ?? "").trim();
    if (!candidateId) {
      return res.status(400).json({
        error: "Missing required field: candidateId",
        details: null,
      });
    }
    const { fetchCandidateById, updateCandidateStatus } = await import(
      "./_lib/ingestion/candidateStore.js"
    );
    const candidate = await fetchCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({
        error: "Candidate not found",
        details: null,
      });
    }
    if (candidate.status !== "pending") {
      return res.status(400).json({
        error: "Only pending candidates can be dismissed",
        details: null,
      });
    }
    await updateCandidateStatus(candidateId, "dismissed");
    return res.status(200).json({ success: true, message: "Candidate dismissed" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Dismiss failed";
    console.error("[Orchestrator] ingestion-dismiss failed:", message);
    return res.status(500).json({ error: message, details: null });
  }
}
