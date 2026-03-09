/**
 * Phase O5.1 – Operational Ontology Simulator
 * High-fidelity seed data for stress-testing clinical relationship visualization.
 * Realism invariant: Every node includes RxCUI/UNII and full clinical description.
 */

import type { GraphNode, GraphEdge } from "../lib/graphUtils";

export type DemoCluster = "warfarin" | "peanut";

export interface DemoNodeMetadata {
  rxCui?: string;
  unii?: string;
  clinicalDescription?: string;
  scientificName?: string;
  isHighPriority?: boolean;
  promotionPreview?: {
    canonicalName: string;
    category: string;
    proposedAliases: string[];
  };
}

export interface DemoEdgeMetadata {
  conflictSummary?: string;
  mechanism?: string;
  severityHypothesis?: string;
}

export interface DemoGraphSeed {
  nodes: (GraphNode & { metadata?: DemoNodeMetadata & Record<string, unknown> })[];
  edges: (GraphEdge & { metadata?: DemoEdgeMetadata })[];
  focalIds: string[];
}

function nodeId(type: string, label: string): string {
  return `${type}:${label.toLowerCase().replace(/\s+/g, "_")}`;
}

export function getWarfarinCluster(): DemoGraphSeed {
  const focalId = nodeId("canonical_entity", "Warfarin");
  const nodes: DemoGraphSeed["nodes"] = [
    {
      id: focalId,
      label: "Warfarin",
      type: "canonical_entity",
      metadata: {
        rxCui: "RXNCUI-11289",
        clinicalDescription:
          "Vitamin K antagonist anticoagulant. Inhibits synthesis of vitamin K–dependent clotting factors (II, VII, IX, X). Used for prevention and treatment of thromboembolic disorders. Narrow therapeutic index; requires INR monitoring. Interacts with numerous drugs, supplements, and foods via CYP2C9, CYP1A2, and vitamin K pathways.",
        scientificName: "4-Hydroxy-3-(3-oxo-1-phenylbutyl)-2H-1-benzopyran-2-one",
      },
    },
    {
      id: nodeId("unknown_entity", "Turmeric"),
      label: "Turmeric",
      type: "unknown_entity",
      metadata: {
        unii: "H7WJ36UX2F",
        clinicalDescription:
          "Curcuma longa rhizome. Contains curcumin (diferuloylmethane). Anti-inflammatory and antioxidant properties. May potentiate anticoagulant effect via platelet inhibition and possible CYP2C9 modulation. Clinical significance: moderate; case reports of bleeding with concurrent warfarin.",
        scientificName: "Curcuma longa",
        isHighPriority: true,
      },
    },
    {
      id: nodeId("unknown_entity", "Fish Oil"),
      label: "Fish Oil",
      type: "unknown_entity",
      metadata: {
        unii: "A1E5L1L7F7",
        clinicalDescription:
          "Omega-3 fatty acids (EPA, DHA) from marine sources. Antiplatelet effects may additive to warfarin. Bleeding risk elevation reported in some studies; significance varies by dose and formulation.",
        scientificName: "Omega-3 polyunsaturated fatty acids",
        isHighPriority: true,
      },
    },
    {
      id: nodeId("class", "Anticoagulants"),
      label: "Anticoagulants",
      type: "class",
      metadata: {
        clinicalDescription:
          "Pharmacologic class: agents that prevent or delay blood coagulation. Includes vitamin K antagonists (warfarin), direct oral anticoagulants (DOACs), heparins.",
      },
    },
    {
      id: nodeId("proposal_candidate", "Turmeric Extract"),
      label: "Turmeric Extract",
      type: "proposal_candidate",
      metadata: {
        unii: "H7WJ36UX2F",
        clinicalDescription:
          "Standardized Curcuma longa extract. Proposed for registry ingestion based on telemetry co-occurrence with warfarin.",
        scientificName: "Curcuma longa",
        promotionPreview: {
          canonicalName: "Turmeric Extract",
          category: "supplement",
          proposedAliases: ["Curcumin", "Curcuma longa extract", "Turmeric root extract"],
        },
      },
    },
  ];

  const edges: DemoGraphSeed["edges"] = [
    {
      source: focalId,
      target: nodeId("unknown_entity", "Turmeric"),
      type: "possible_interaction",
      metadata: {
        conflictSummary:
          "Turmeric (Curcuma longa) may potentiate anticoagulant effect. Mechanism: antiplatelet activity and possible CYP2C9 inhibition. Severity: moderate. Recommend INR monitoring if used concurrently.",
        mechanism: "Antiplatelet activity; possible CYP2C9 modulation",
        severityHypothesis: "Moderate — bleeding risk elevation",
      },
    },
    {
      source: focalId,
      target: nodeId("unknown_entity", "Fish Oil"),
      type: "possible_interaction",
      metadata: {
        conflictSummary:
          "Fish oil (omega-3) may increase bleeding risk when combined with warfarin. Mechanism: additive antiplatelet effects. Severity: low to moderate.",
        mechanism: "Additive antiplatelet effects",
        severityHypothesis: "Low–moderate",
      },
    },
    {
      source: focalId,
      target: nodeId("class", "Anticoagulants"),
      type: "member_of_class",
    },
    {
      source: nodeId("proposal_candidate", "Turmeric Extract"),
      target: focalId,
      type: "proposed_as",
      metadata: {
        conflictSummary: "Proposed relationship: Turmeric Extract co-occurs with Warfarin in telemetry. Research recommended before promotion.",
      },
    },
  ];

  return { nodes, edges, focalIds: [focalId] };
}

export function getPeanutCluster(): DemoGraphSeed {
  const focalId = nodeId("canonical_entity", "Peanut");
  const nodes: DemoGraphSeed["nodes"] = [
    {
      id: focalId,
      label: "Peanut",
      type: "canonical_entity",
      metadata: {
        unii: "G2E1M7G5U4",
        clinicalDescription:
          "Arachis hypogaea. Legume native to South America. Major food allergen; IgE-mediated reactions range from mild to anaphylaxis. Cross-reactivity with other legumes (soy, lupin) possible. Used in food, oil, and industrial applications.",
        scientificName: "Arachis hypogaea",
      },
    },
    {
      id: nodeId("alias", "Groundnut"),
      label: "Groundnut",
      type: "alias",
      metadata: {
        clinicalDescription: "Common name for Arachis hypogaea, especially in Commonwealth usage.",
        scientificName: "Arachis hypogaea",
      },
    },
    {
      id: nodeId("alias", "Goober"),
      label: "Goober",
      type: "alias",
      metadata: {
        clinicalDescription: "Colloquial term for peanut (Arachis hypogaea), derived from African languages.",
        scientificName: "Arachis hypogaea",
      },
    },
    {
      id: nodeId("alias", "Peanut Oil"),
      label: "Peanut Oil",
      type: "alias",
      metadata: {
        clinicalDescription:
          "Refined oil from Arachis hypogaea. Allergenicity varies: cold-pressed may retain protein; highly refined peanut oil often tolerated by peanut-allergic individuals. FDA labeling requirements apply.",
        scientificName: "Arachis hypogaea",
      },
    },
  ];

  const edges: DemoGraphSeed["edges"] = [
    { source: nodeId("alias", "Groundnut"), target: focalId, type: "alias_of" },
    { source: nodeId("alias", "Goober"), target: focalId, type: "alias_of" },
    { source: nodeId("alias", "Peanut Oil"), target: focalId, type: "alias_of" },
  ];

  return { nodes, edges, focalIds: [focalId] };
}

export function getDemoSeed(demo: DemoCluster): DemoGraphSeed | null {
  switch (demo) {
    case "warfarin":
      return getWarfarinCluster();
    case "peanut":
      return getPeanutCluster();
    default:
      return null;
  }
}
