/**
 * Phase 21c – Alias Proposal Store
 *
 * Draft-only storage for alias proposals.
 * Does NOT affect runtime inference.
 */

import { getSupabaseClient } from "../supabaseClient.js";

export type RegistryType = "drug" | "supplement" | "food";
export type ProposalAction = "add-alias" | "remove-alias" | "create-entry";
export type ProposalStatus = "pending" | "exported" | "dismissed";

export interface AliasProposal {
  id: string;
  registry_type: RegistryType;
  canonical_id: string;
  proposed_alias: string;
  proposal_action: ProposalAction;
  proposed_entry?: Record<string, unknown>;
  status: ProposalStatus;
  created_at: string;
  created_by?: string;
  notes?: string;
}

export interface CreateProposalInput {
  registry_type: RegistryType;
  canonical_id: string;
  proposed_alias: string;
  proposal_action: ProposalAction;
  proposed_entry?: Record<string, unknown>;
  created_by?: string;
  notes?: string;
}

export async function createProposal(input: CreateProposalInput): Promise<AliasProposal> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("alias_proposals")
    .insert({
      registry_type: input.registry_type,
      canonical_id: input.canonical_id,
      proposed_alias: input.proposed_alias,
      proposal_action: input.proposal_action,
      proposed_entry: input.proposed_entry ?? null,
      status: "pending",
      created_by: input.created_by ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Create proposal failed: ${error.message}`);
  return data as AliasProposal;
}

export async function listProposals(args: {
  registry_type?: RegistryType;
  status?: ProposalStatus;
}): Promise<AliasProposal[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("alias_proposals")
    .select("*")
    .order("created_at", { ascending: false });

  if (args.registry_type) {
    query = query.eq("registry_type", args.registry_type);
  }
  if (args.status) {
    query = query.eq("status", args.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`List proposals failed: ${error.message}`);
  return (data ?? []) as AliasProposal[];
}

export async function dismissProposal(proposalId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("alias_proposals")
    .update({ status: "dismissed" })
    .eq("id", proposalId)
    .eq("status", "pending");

  if (error) throw new Error(`Dismiss proposal failed: ${error.message}`);
}

export async function markProposalsExported(proposalIds: string[]): Promise<void> {
  if (proposalIds.length === 0) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("alias_proposals")
    .update({ status: "exported" })
    .in("id", proposalIds)
    .eq("status", "pending");

  if (error) throw new Error(`Mark exported failed: ${error.message}`);
}

/** O8 — JSON export row for replay / apply (includes semantic safety fields when present). */
export function buildAliasProposalExportChange(p: AliasProposal): Record<string, unknown> {
  const pe = p.proposed_entry as Record<string, unknown> | undefined;
  const riskRaw = pe?.riskTags ?? pe?.risk_tags;
  const riskTags = Array.isArray(riskRaw)
    ? riskRaw.filter((x): x is string => typeof x === "string")
    : undefined;
  const cls =
    typeof pe?.class === "string"
      ? pe.class
      : typeof pe?.family === "string"
        ? pe.family
        : undefined;
  const typ = typeof pe?.type === "string" ? pe.type : undefined;
  const aliasList = Array.isArray(pe?.aliases)
    ? (pe.aliases as unknown[]).filter((x): x is string => typeof x === "string")
    : undefined;
  return {
    canonical: p.canonical_id,
    registryType: p.registry_type,
    canonicalId: p.canonical_id,
    action: p.proposal_action,
    alias: p.proposed_alias,
    type: typ,
    class: cls,
    aliases: aliasList,
    riskTags,
    proposedEntry: pe ?? undefined,
  };
}
