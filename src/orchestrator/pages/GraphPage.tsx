/**
 * Phase O5/O5.1 – Ontology Graph View
 * Investigative surface for entity relationships.
 * O5.1: Demo mode (?demo=warfarin|peanut), interactive edges, promotion panel, telemetry.
 */

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { fetchGraphFocus } from "../lib/fetchOrchestratorData";
import { parseGraphParams, type GraphNode } from "../lib/graphUtils";
import { buildResearchUrl } from "../lib/researchTarget";
import { getDemoSeed, type DemoCluster } from "../demo/demoGraphSeeds";
import { useGraphTelemetry } from "../context/GraphTelemetryContext";
import { useActivityStore } from "../lib/activityStore";
import { CustomNode, getNodeBounds, getEdgeAnchor } from "../components/graph/CustomNode";

type GraphParams = ReturnType<typeof parseGraphParams>;

function useStableGraphParams(params: GraphParams): GraphParams {
  const ref = useRef<GraphParams>(params);
  const key = JSON.stringify(params);
  const prevKey = JSON.stringify(ref.current);
  if (key !== prevKey) {
    ref.current = params;
  }
  return ref.current;
}

const EDGE_STYLES: Record<string, { stroke: string; dash?: string; glow?: boolean }> = {
  alias_of: { stroke: "#94A3B8", dash: "4,2" },
  member_of_class: { stroke: "#94A3B8" },
  co_occurs_with: { stroke: "#F59E0B" },
  possible_interaction: { stroke: "#EA580C", glow: true },
  proposed_as: { stroke: "#64748B", dash: "6,3" },
};

interface GraphEdgeWithMeta {
  source: string;
  target: string;
  type: string;
  metadata?: { conflictSummary?: string; mechanism?: string; severityHypothesis?: string };
}

function simpleLayout(
  nodes: GraphNode[],
  edges: { source: string; target: string }[],
  focalIds: string[]
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const centerX = 400;
  const centerY = 250;
  const radius = 120;

  const focal = nodes.filter((n) => focalIds.includes(n.id));
  const others = nodes.filter((n) => !focalIds.includes(n.id));

  focal.forEach((n, i) => {
    const angle = (i / Math.max(focal.length, 1)) * Math.PI * 0.8 - Math.PI * 0.4;
    pos.set(n.id, {
      x: centerX + Math.cos(angle) * (focal.length > 1 ? radius * 0.5 : 0),
      y: centerY + Math.sin(angle) * (focal.length > 1 ? radius * 0.5 : 0),
    });
  });

  const connected = new Set<string>();
  focal.forEach((n) => connected.add(n.id));
  for (const e of edges) {
    if (connected.has(e.source)) connected.add(e.target);
    if (connected.has(e.target)) connected.add(e.source);
  }

  const rest = others.filter((n) => connected.has(n.id) || others.indexOf(n) < 8);
  rest.forEach((n, i) => {
    if (pos.has(n.id)) return;
    const angle = (i / Math.max(rest.length, 1)) * Math.PI * 2;
    pos.set(n.id, {
      x: centerX + Math.cos(angle) * radius * 1.2,
      y: centerY + Math.sin(angle) * radius * 1.2,
    });
  });

  return pos;
}

/** O5.1: Scientific name with attribution tooltip */
function ScientificNameAttribution({ name }: { name: string }) {
  return (
    <span
      className="orch-entity-link cursor-help"
      title="Source: Internal Ontology (Seeded for Demo)"
    >
      {name}
    </span>
  );
}

export default function GraphPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawParams = useMemo(() => parseGraphParams(searchParams), [searchParams]);
  const params = useStableGraphParams(rawParams);
  const graphTelemetry = useGraphTelemetry();
  const graphTelemetryRef = useRef(graphTelemetry);
  graphTelemetryRef.current = graphTelemetry;
  const activityStore = useActivityStore();

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdgeWithMeta[]>([]);
  const [focalIds, setFocalIds] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdgeWithMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusInput, setFocusInput] = useState(params.entity ?? params.entityA ?? "");
  const isDemo = Boolean(params.demo);

  const pushAudit = useCallback(
    (msg: string) => {
      if (isDemo && graphTelemetryRef.current) graphTelemetryRef.current.pushAudit(msg);
    },
    [isDemo]
  );

  useEffect(() => {
    const loadGraph = async () => {
      if (params.demo) {
        const seed = getDemoSeed(params.demo as DemoCluster);
        if (seed) {
          setNodes(seed.nodes);
          setEdges(seed.edges as GraphEdgeWithMeta[]);
          setFocalIds(seed.focalIds);
          setError(null);
          pushAudit(`🏛️ Audit: Loaded ${params.demo} clinical cluster`);
        } else {
          setError("Unknown demo cluster");
          setNodes([]);
          setEdges([]);
          setFocalIds([]);
        }
        return;
      }

      if (!params.entity && !params.entityA && !params.entityB) {
        setNodes([]);
        setEdges([]);
        setFocalIds([]);
        setError(null);
        setSelectedNode(null);
        setSelectedEdge(null);
        return;
      }

      setLoading(true);
      setError(null);
      const res = await fetchGraphFocus(params);
      if (res.ok && res.data) {
        setNodes(res.data.nodes ?? []);
        setEdges((res.data.edges ?? []) as GraphEdgeWithMeta[]);
        setFocalIds(res.data.focalIds ?? []);
      } else {
        setError(res.ok ? "No data" : res.error);
        setNodes([]);
        setEdges([]);
        setFocalIds([]);
      }
      setLoading(false);
    };

    loadGraph();
  }, [params, pushAudit]);

  const handleFocus = (entity: string) => {
    setSearchParams({ entity });
    setFocusInput(entity);
    activityStore?.pushEvent({
      type: "graph_focus_changed",
      message: `Graph focus: ${entity}`,
      status: "info",
      source: "ui",
      metadata: { entity },
    });
  };

  const handleFocusPair = (entityA: string, entityB: string) => {
    setSearchParams({ entityA, entityB });
    setFocusInput(`${entityA} / ${entityB}`);
    activityStore?.pushEvent({
      type: "graph_focus_changed",
      message: `Graph focus: ${entityA} + ${entityB}`,
      status: "info",
      source: "ui",
      metadata: { entityA, entityB },
    });
  };

  const handleNodeSelect = (n: GraphNode) => {
    setSelectedNode(n);
    setSelectedEdge(null);
    if (isDemo) pushAudit(`🏛️ Audit: Navigated to ${n.label} clinical cluster`);
  };

  const handleEdgeSelect = (e: GraphEdgeWithMeta) => {
    setSelectedEdge(e);
    setSelectedNode(null);
    if (isDemo && e.metadata?.conflictSummary) pushAudit(`🏛️ Audit: Viewed interaction conflict`);
  };

  const positions = simpleLayout(nodes, edges, focalIds);
  const displayNode = selectedNode ?? nodes.find((n) => focalIds.includes(n.id));
  const meta = displayNode?.metadata as {
    rxCui?: string;
    unii?: string;
    clinicalDescription?: string;
    scientificName?: string;
    isHighPriority?: boolean;
    promotionPreview?: { canonicalName: string; category: string; proposedAliases: string[] };
  } | undefined;

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 flex items-start justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <h1 className="orch-section-header text-xl">Ontology Graph</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Visualize entity relationships and interactions in the safety ontology.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isDemo && (
            <span className="orch-metric-chip text-amber-700 bg-amber-50">Demo: {params.demo}</span>
          )}
          <Link
            to="/orchestrator/radar"
            className="text-sm font-medium text-[#64748B] hover:text-[#0F172A]"
          >
            Back to Radar →
          </Link>
        </div>
      </header>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={focusInput}
              onChange={(e) => setFocusInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = focusInput.trim();
                  if (v.includes(" ")) {
                    const [a, b] = v.split(/\s+/);
                    if (a && b) handleFocusPair(a, b);
                  } else if (v) {
                    handleFocus(v);
                  }
                }
              }}
              placeholder={isDemo ? "Use ?demo=warfarin or ?demo=peanut" : "entity or entityA entityB"}
              className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F172A]/20"
            />
            <button
              type="button"
              onClick={() => {
                const v = focusInput.trim();
                if (v.includes(" ")) {
                  const [a, b] = v.split(/\s+/);
                  if (a && b) handleFocusPair(a, b);
                } else if (v) {
                  handleFocus(v);
                }
              }}
              className="orch-gradient-btn rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Focus
            </button>
            {!isDemo && (
              <Link
                to="/orchestrator/graph?demo=warfarin"
                className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC]"
              >
                Demo: Warfarin
              </Link>
            )}
            {!isDemo && (
              <Link
                to="/orchestrator/graph?demo=peanut"
                className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC]"
              >
                Demo: Peanut
              </Link>
            )}
          </div>

          <div className="flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] overflow-hidden relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <p className="text-sm text-[#64748B]">Loading graph…</p>
              </div>
            )}
            {error && !loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-[#B91C1C]">{error}</p>
              </div>
            )}
            {!loading && nodes.length === 0 && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <p className="text-sm text-[#64748B]">Enter an entity or try a demo</p>
                <p className="text-xs text-[#94A3B8]">
                  e.g. turmeric or ?demo=warfarin or ?demo=peanut
                </p>
              </div>
            )}
            {nodes.length > 0 && (
              <svg
                viewBox="0 0 800 500"
                className="w-full h-full"
                onClick={() => {
                  setSelectedNode(null);
                  setSelectedEdge(null);
                }}
              >
                <defs>
                  <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {edges.map((e, i) => {
                  const src = positions.get(e.source);
                  const dst = positions.get(e.target);
                  const srcNode = nodes.find((n) => n.id === e.source);
                  const dstNode = nodes.find((n) => n.id === e.target);
                  if (!src || !dst || !srcNode || !dstNode) return null;
                  const srcBounds = getNodeBounds(
                    src.x,
                    src.y,
                    focalIds.includes(e.source),
                    srcNode.label
                  );
                  const dstBounds = getNodeBounds(
                    dst.x,
                    dst.y,
                    focalIds.includes(e.target),
                    dstNode.label
                  );
                  const srcAnchor = getEdgeAnchor(src.x, src.y, dst.x, dst.y, srcBounds);
                  const dstAnchor = getEdgeAnchor(dst.x, dst.y, src.x, src.y, dstBounds);
                  const style = EDGE_STYLES[e.type] ?? { stroke: "#94A3B8" };
                  const isSelected = selectedEdge?.source === e.source && selectedEdge?.target === e.target;
                  const isInteractive = e.metadata?.conflictSummary;
                  return (
                    <g
                      key={`edge-${i}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (isInteractive) handleEdgeSelect(e);
                      }}
                      style={{ cursor: isInteractive ? "pointer" : "default" }}
                    >
                      <line
                        x1={srcAnchor.x}
                        y1={srcAnchor.y}
                        x2={dstAnchor.x}
                        y2={dstAnchor.y}
                        stroke={style.stroke}
                        strokeWidth={isSelected ? 3 : e.type === "possible_interaction" ? 2 : 1}
                        strokeDasharray={style.dash}
                        filter={style.glow && isSelected ? "url(#edge-glow)" : undefined}
                        opacity={isSelected ? 1 : 0.8}
                      />
                    </g>
                  );
                })}
                {nodes.map((n) => {
                  const p = positions.get(n.id);
                  if (!p) return null;
                  const isFocal = focalIds.includes(n.id);
                  const isSelected = selectedNode?.id === n.id;
                  const nodeMeta = n.metadata as { isHighPriority?: boolean } | undefined;
                  const showPulse = nodeMeta?.isHighPriority;
                  return (
                    <CustomNode
                      key={n.id}
                      node={n}
                      x={p.x}
                      y={p.y}
                      isFocal={isFocal}
                      isSelected={isSelected}
                      showPulse={showPulse}
                      onSelect={() => handleNodeSelect(n)}
                    />
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        <aside className="w-72 shrink-0 rounded-xl border border-[#E2E8F0] bg-white p-4 overflow-y-auto">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3">
            Detail
          </h3>

          {selectedEdge && selectedEdge.metadata?.conflictSummary ? (
            <div className="space-y-3 text-sm">
              <p className="font-semibold text-[#0F172A]">Conflict Summary</p>
              <p className="text-[#334155] leading-relaxed">
                {selectedEdge.metadata.conflictSummary}
              </p>
              {selectedEdge.metadata.mechanism && (
                <p className="text-xs">
                  <span className="text-[#64748B]">Mechanism:</span>{" "}
                  {selectedEdge.metadata.mechanism}
                </p>
              )}
              {selectedEdge.metadata.severityHypothesis && (
                <p className="text-xs">
                  <span className="text-[#64748B]">Severity:</span>{" "}
                  {selectedEdge.metadata.severityHypothesis}
                </p>
              )}
            </div>
          ) : displayNode && displayNode.type === "proposal_candidate" && meta?.promotionPreview ? (
            <div className="space-y-4">
              <p className="font-semibold text-[#0F172A]">Promotion Preview</p>
              <div
                className="rounded-lg bg-[#F8FAFC] p-4 font-mono text-[13px] text-[#334155] border border-[#E2E8F0]"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
              >
                <div className="space-y-2">
                  <div>
                    <span className="font-bold text-[#0F172A]">CanonicalName:</span>{" "}
                    {meta.promotionPreview.canonicalName}
                  </div>
                  <div>
                    <span className="font-bold text-[#0F172A]">Category:</span>{" "}
                    {meta.promotionPreview.category}
                  </div>
                  <div>
                    <span className="font-semibold text-[#475569]">proposedAliases:</span>{" "}
                    {meta.promotionPreview.proposedAliases.join(", ")}
                  </div>
                </div>
              </div>
              <Link
                to={buildResearchUrl({
                  mode: "entity",
                  entity: displayNode.label,
                  entityType: "supplement",
                })}
                className="block w-full text-center orch-gradient-btn rounded-lg px-4 py-2.5 text-sm font-semibold"
              >
                View Full Proposal
              </Link>
            </div>
          ) : displayNode ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-[#0F172A]">{displayNode.label}</p>
                {meta?.isHighPriority && (
                  <span className="orch-badge-high-risk text-xs px-2 py-0.5 rounded">
                    High Priority
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748B]">Type: {displayNode.type.replace(/_/g, " ")}</p>
              {(meta?.rxCui || meta?.unii) && (
                <p className="text-xs font-mono text-[#64748B]">
                  {meta.rxCui ? `RxCUI: ${meta.rxCui}` : meta.unii ? `UNII: ${meta.unii}` : ""}
                </p>
              )}
              {meta?.clinicalDescription && (
                <p className="text-[#334155] leading-relaxed text-xs">
                  {meta.scientificName && meta.clinicalDescription.includes(meta.scientificName) ? (
                    <>
                      {meta.clinicalDescription.split(meta.scientificName).map((part, i, arr) => (
                        <span key={i}>
                          {part}
                          {i < arr.length - 1 && (
                            <ScientificNameAttribution name={meta.scientificName!} />
                          )}
                        </span>
                      ))}
                    </>
                  ) : (
                    meta.clinicalDescription
                  )}
                </p>
              )}
              {meta?.scientificName && (
                <p className="text-xs text-[#64748B] mt-1">
                  Scientific: <ScientificNameAttribution name={meta.scientificName} />
                </p>
              )}
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  to={`/orchestrator/radar`}
                  className="text-xs font-medium text-[#3B82F6] hover:underline"
                >
                  Open in Radar
                </Link>
                <Link
                  to={buildResearchUrl({
                    mode: "entity",
                    entity: displayNode.label,
                    entityType: "unknown",
                  })}
                  className="text-xs font-medium text-[#3B82F6] hover:underline"
                >
                  Open in Research
                </Link>
                <Link
                  to={`/orchestrator/registry?search=${encodeURIComponent(displayNode.label)}`}
                  className="text-xs font-medium text-[#3B82F6] hover:underline"
                >
                  Open in Registry
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#94A3B8]">
              {selectedEdge ? "Select a node or edge" : "Select a node or click an interaction edge"}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
