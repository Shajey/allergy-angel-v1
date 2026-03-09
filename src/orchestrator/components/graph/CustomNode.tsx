/**
 * Phase O5.2/O5.3 – Custom Node for Ontology Graph
 * O5.3: Adaptive capsule nodes (px-4 py-2, rounded-full, min-w-[40px]).
 * No text truncation; capsule grows to fit label.
 */

import type { GraphNode, GraphNodeType } from "../../lib/graphUtils";

const NODE_COLORS: Record<GraphNodeType, string> = {
  canonical_entity: "#0F172A",
  unknown_entity: "#F59E0B",
  alias: "#7DD3FC",
  class: "#94A3B8",
  interaction_gap: "#F97316",
  proposal_candidate: "#64748B",
};

const NODE_STROKES: Record<GraphNodeType, string> = {
  canonical_entity: "#0F172A",
  unknown_entity: "#D97706",
  alias: "#0EA5E9",
  class: "#64748B",
  interaction_gap: "#EA580C",
  proposal_candidate: "#475569",
};

/** Text color: white for dark backgrounds, slate for light */
function getTextColor(type: GraphNodeType): string {
  return type === "canonical_entity" ? "#FFFFFF" : "#0F172A";
}

/** Border color: 20% darker than node background */
function darkenHex(hex: string, factor: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = Math.max(0, Math.round(parseInt(m[1], 16) * factor));
  const g = Math.max(0, Math.round(parseInt(m[2], 16) * factor));
  const b = Math.max(0, Math.round(parseInt(m[3], 16) * factor));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function getBorderColor(fill: string): string {
  return darkenHex(fill, 0.8);
}

const FOCAL_RADIUS = 40;
const PILL_MIN_WIDTH = 40;
const PILL_PADDING_X = 16;
const PILL_PADDING_Y = 8;
const CHAR_WIDTH_EST = 6;

export interface CustomNodeProps {
  node: GraphNode;
  x: number;
  y: number;
  isFocal: boolean;
  isSelected: boolean;
  showPulse?: boolean;
  onSelect: () => void;
}

/** Compute pill width from label; no truncation, capsule grows to fit */
function getPillWidth(label: string): number {
  const contentWidth = label.length * CHAR_WIDTH_EST;
  return Math.max(PILL_MIN_WIDTH, PILL_PADDING_X * 2 + contentWidth);
}

export function CustomNode({
  node,
  x,
  y,
  isFocal,
  isSelected,
  showPulse,
  onSelect,
}: CustomNodeProps) {
  const type = node.type as GraphNodeType;
  const fill = NODE_COLORS[type] ?? "#94A3B8";
  const stroke = NODE_STROKES[type] ?? "#64748B";
  const borderColor = getBorderColor(fill);
  const textColor = getTextColor(type);

  if (isFocal) {
    const r = FOCAL_RADIUS;
    return (
      <g
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        style={{ cursor: "pointer" }}
      >
        {showPulse && (
          <circle
            cx={x - r - 4}
            cy={y}
            r={4}
            fill="#EF4444"
            className="orch-live-pulse-svg"
          />
        )}
        <circle
          cx={x}
          cy={y}
          r={r}
          fill={fill}
          stroke={borderColor}
          strokeWidth={1}
          style={{
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.05))",
          }}
        />
        {isSelected && (
          <circle
            cx={x}
            cy={y}
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth={3}
          />
        )}
        <text
          x={x}
          y={y + 5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={12}
          fontWeight={600}
          fill={textColor}
          style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        >
          {node.label}
        </text>
      </g>
    );
  }

  const pillWidth = getPillWidth(node.label);
  const pillHeight = 32;
  const rx = pillHeight / 2;
  const w = pillWidth;
  const h = pillHeight;

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      style={{ cursor: "pointer" }}
    >
      {showPulse && (
        <circle
          cx={x - w / 2 - 4}
          cy={y}
          r={4}
          fill="#EF4444"
          className="orch-live-pulse-svg"
        />
      )}
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={rx}
        ry={rx}
        fill={fill}
        stroke={borderColor}
        strokeWidth={1}
        style={{
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.05))",
        }}
      />
      {isSelected && (
        <rect
          x={x - w / 2}
          y={y - h / 2}
          width={w}
          height={h}
          rx={rx}
          ry={rx}
          fill="none"
          stroke={stroke}
          strokeWidth={3}
        />
      )}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fontWeight={600}
        fill={textColor}
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {node.label}
      </text>
    </g>
  );
}

/** Get node dimensions for edge anchoring */
export function getNodeBounds(
  x: number,
  y: number,
  isFocal: boolean,
  label: string
): { width: number; height: number; isCircle: boolean; radius?: number } {
  if (isFocal) {
    return { width: 0, height: 0, isCircle: true, radius: FOCAL_RADIUS };
  }
  const w = getPillWidth(label);
  const h = 32;
  return { width: w, height: h, isCircle: false };
}

/** Compute edge anchor point on node boundary (where line to other node intersects) */
export function getEdgeAnchor(
  cx: number,
  cy: number,
  toX: number,
  toY: number,
  bounds: { width: number; height: number; isCircle: boolean; radius?: number }
): { x: number; y: number } {
  const dx = toX - cx;
  const dy = toY - cy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  if (bounds.isCircle && bounds.radius != null) {
    return {
      x: cx + ux * bounds.radius,
      y: cy + uy * bounds.radius,
    };
  }

  const w = bounds.width / 2;
  const h = bounds.height / 2;
  const t = Math.min(
    Math.abs(ux) > 1e-6 ? w / Math.abs(ux) : Infinity,
    Math.abs(uy) > 1e-6 ? h / Math.abs(uy) : Infinity
  );
  return {
    x: cx + ux * t,
    y: cy + uy * t,
  };
}
