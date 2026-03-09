/**
 * Phase O5 – Ontology Graph utilities
 * URL building and types for focused graph view.
 */

export type GraphNodeType =
  | "canonical_entity"
  | "unknown_entity"
  | "alias"
  | "class"
  | "interaction_gap"
  | "proposal_candidate";

export type GraphEdgeType =
  | "alias_of"
  | "member_of_class"
  | "co_occurs_with"
  | "possible_interaction"
  | "proposed_as";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: GraphEdgeType;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  focalIds?: string[];
}

export function buildGraphUrl(params: {
  entity?: string;
  entityA?: string;
  entityB?: string;
  demo?: "warfarin" | "peanut";
}): string {
  const search = new URLSearchParams();
  if (params.entity) search.set("entity", params.entity);
  if (params.entityA) search.set("entityA", params.entityA);
  if (params.entityB) search.set("entityB", params.entityB);
  if (params.demo) search.set("demo", params.demo);
  const qs = search.toString();
  return `/orchestrator/graph${qs ? `?${qs}` : ""}`;
}

export function parseGraphParams(searchParams: URLSearchParams): {
  entity?: string;
  entityA?: string;
  entityB?: string;
  demo?: "warfarin" | "peanut";
} {
  const entity = searchParams.get("entity")?.trim();
  const entityA = searchParams.get("entityA")?.trim();
  const entityB = searchParams.get("entityB")?.trim();
  const demoRaw = searchParams.get("demo")?.trim().toLowerCase();
  const demo =
    demoRaw === "warfarin" ? "warfarin" : demoRaw === "peanut" ? "peanut" : undefined;
  return { entity: entity || undefined, entityA: entityA || undefined, entityB: entityB || undefined, demo };
}
