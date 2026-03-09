/**
 * Phase O5 – Ontology Graph Query Layer
 * Builds focused graph from registry + radar for investigative view.
 */

import { searchRegistry } from "./registryBrowser.js";
import {
  getRadarEntities,
  getRadarCombinations,
  getRadarSignals,
} from "./radarQueries.js";

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

const NODE_LIMIT = 25;
const EDGE_LIMIT = 40;

function nodeId(type: GraphNodeType, label: string): string {
  return `${type}:${label.toLowerCase().replace(/\s+/g, "_")}`;
}

export async function getGraphForFocus(params: {
  entity?: string;
  entityA?: string;
  entityB?: string;
}): Promise<{ nodes: GraphNode[]; edges: GraphEdge[]; focalIds: string[] }> {
  type GNode = GraphNode;
  type GEdge = GraphEdge;
  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  const nodeSet = new Set<string>();
  const focalIds: string[] = [];

  const addNode = (n: GNode) => {
    if (nodeSet.has(n.id)) return;
    if (nodes.length >= NODE_LIMIT) return;
    nodeSet.add(n.id);
    nodes.push(n);
  };

  const addEdge = (source: string, target: string, type: GraphEdgeType) => {
    if (edges.length >= EDGE_LIMIT) return;
    if (!nodeSet.has(source) || !nodeSet.has(target)) return;
    edges.push({ source, target, type });
  };

  const entity = params.entity?.trim();
  const entityA = params.entityA?.trim();
  const entityB = params.entityB?.trim();

  if (entity) {
    const id = nodeId("unknown_entity", entity);
    addNode({
      id,
      label: entity,
      type: "unknown_entity",
      metadata: { isFocal: true },
    });
    focalIds.push(id);
  }

  if (entityA) {
    const id = nodeId("unknown_entity", entityA);
    if (!nodeSet.has(id)) {
      addNode({
        id,
        label: entityA,
        type: "unknown_entity",
        metadata: { isFocal: true },
      });
      focalIds.push(id);
    }
  }

  if (entityB) {
    const id = nodeId("unknown_entity", entityB);
    if (!nodeSet.has(id)) {
      addNode({
        id,
        label: entityB,
        type: "unknown_entity",
        metadata: { isFocal: true },
      });
      focalIds.push(id);
    }
  }

  const searchTerms = [entity, entityA, entityB].filter(Boolean) as string[];
  if (searchTerms.length === 0) {
    return { nodes, edges, focalIds };
  }

  for (const term of searchTerms) {
    const regResult = searchRegistry(term);
    for (const r of regResult.results ?? []) {
      const canonId = nodeId("canonical_entity", r.id);
      addNode({
        id: canonId,
        label: r.id,
        type: "canonical_entity",
        metadata: { registryType: r.type, class: r.class },
      });
      addEdge(nodeId("unknown_entity", term), canonId, "proposed_as");

      for (const alias of (r.aliases ?? []).slice(0, 3)) {
        if (alias.toLowerCase() !== term.toLowerCase() && alias.toLowerCase() !== r.id.toLowerCase()) {
          const aliasId = nodeId("alias", alias);
          addNode({ id: aliasId, label: alias, type: "alias" });
          addEdge(aliasId, canonId, "alias_of");
        }
      }
      if (r.class) {
        const classId = nodeId("class", r.class);
        addNode({ id: classId, label: r.class, type: "class" });
        addEdge(canonId, classId, "member_of_class");
      }
    }
  }

  try {
    const [entitiesRes, combinationsRes, signalsRes] = await Promise.all([
      getRadarEntities(30, 30),
      getRadarCombinations(30, 30),
      getRadarSignals(30, 30),
    ]);

    const entities = entitiesRes.entities ?? [];
    const combinations = combinationsRes.combinations ?? [];
    const signals = signalsRes.signals ?? [];

    for (const e of entities) {
      if (!searchTerms.some((t) => e.entity.toLowerCase().includes(t.toLowerCase()))) continue;
      const id = nodeId("unknown_entity", e.entity);
      addNode({
        id,
        label: e.entity,
        type: "unknown_entity",
        metadata: { occurrenceCount: e.occurrenceCount, priorityScore: e.priorityScore },
      });
      if (e.possibleAliasOf) {
        const canonId = nodeId("canonical_entity", e.possibleAliasOf);
        addNode({
          id: canonId,
          label: e.possibleAliasOf,
          type: "canonical_entity",
        });
        addEdge(id, canonId, "alias_of");
      }
    }

    for (const c of combinations) {
      const aMatch = searchTerms.some((t) => c.entityA.toLowerCase().includes(t.toLowerCase()));
      const bMatch = searchTerms.some((t) => c.entityB.toLowerCase().includes(t.toLowerCase()));
      if (!aMatch && !bMatch) continue;
      const idA = nodeId("unknown_entity", c.entityA);
      const idB = nodeId("unknown_entity", c.entityB);
      addNode({
        id: idA,
        label: c.entityA,
        type: "unknown_entity",
        metadata: { occurrenceCount: c.occurrenceCount },
      });
      addNode({
        id: idB,
        label: c.entityB,
        type: "unknown_entity",
        metadata: { occurrenceCount: c.occurrenceCount },
      });
      addEdge(idA, idB, "possible_interaction");
    }

    for (const s of signals) {
      const aMatch = searchTerms.some((t) => s.entityA.toLowerCase().includes(t.toLowerCase()));
      const bMatch = searchTerms.some((t) => s.entityB.toLowerCase().includes(t.toLowerCase()));
      if (!aMatch && !bMatch) continue;
      const idA = nodeId("unknown_entity", s.entityA);
      const idB = nodeId("unknown_entity", s.entityB);
      addNode({ id: idA, label: s.entityA, type: "unknown_entity" });
      addNode({ id: idB, label: s.entityB, type: "unknown_entity" });
      addEdge(idA, idB, "co_occurs_with");
    }
  } catch {
    // Radar may be unavailable; return registry-only graph
  }

  return { nodes, edges, focalIds };
}
