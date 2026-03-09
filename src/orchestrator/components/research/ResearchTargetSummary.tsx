/**
 * Phase O4/O5 – Research Target Summary
 * Compact structured summary before research result.
 * O5: Inspect in Graph link.
 */

import { Link } from "react-router-dom";
import type { ResearchTarget } from "../../lib/researchTarget";
import { buildGraphUrl } from "../../lib/graphUtils";

interface Props {
  target: ResearchTarget;
}

export default function ResearchTargetSummary({ target }: Props) {
  if (target.mode === "entity") {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h3 className="text-sm font-semibold text-[#0F172A]">Unknown entity</h3>
        <p className="mt-1 font-medium text-[#334155]">{target.entity}</p>
        <dl className="mt-2 space-y-1 text-xs text-[#64748B]">
          <div>
            <span className="font-medium text-[#475569]">Type:</span> {target.entityType}
          </div>
          {target.radarMetadata?.occurrenceCount != null && (
            <div>
              <span className="font-medium text-[#475569]">Occurrences:</span>{" "}
              {target.radarMetadata.occurrenceCount}
            </div>
          )}
          {target.radarMetadata?.highRiskCount != null && (
            <div>
              <span className="font-medium text-[#EF4444]">High risk:</span>{" "}
              {target.radarMetadata.highRiskCount}
            </div>
          )}
          {target.radarMetadata?.signalPattern && (
            <div>
              <span className="font-medium text-[#475569]">Signal pattern:</span>{" "}
              {String(target.radarMetadata.signalPattern)}
            </div>
          )}
        </dl>
        <Link
          to={buildGraphUrl({ entity: target.entity })}
          className="mt-3 inline-block text-xs font-medium text-[#64748B] hover:text-[#0F172A]"
        >
          Inspect in Graph →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      <h3 className="text-sm font-semibold text-[#0F172A]">Interaction gap</h3>
      <p className="mt-1 font-medium text-[#334155]">
        {target.entityA} + {target.entityB}
      </p>
      <dl className="mt-2 space-y-1 text-xs text-[#64748B]">
        <div>
          <span className="font-medium text-[#475569]">Type A / B:</span> {target.typeA} / {target.typeB}
        </div>
        {target.radarTelemetry?.occurrenceCount != null && (
          <div>
            <span className="font-medium text-[#475569]">Occurrences:</span>{" "}
            {target.radarTelemetry.occurrenceCount}
          </div>
        )}
        {target.radarTelemetry?.highRiskCount != null && (
          <div>
            <span className="font-medium text-[#EF4444]">High risk:</span>{" "}
            {target.radarTelemetry.highRiskCount}
          </div>
        )}
        {target.radarTelemetry?.safeOccurrenceCount != null && (
          <div>
            <span className="font-medium text-[#10B981]">Safe:</span>{" "}
            {target.radarTelemetry.safeOccurrenceCount}
          </div>
        )}
        {target.radarTelemetry?.signalPattern && (
          <div>
            <span className="font-medium text-[#475569]">Signal pattern:</span>{" "}
            {target.radarTelemetry.signalPattern}
          </div>
        )}
      </dl>
      <Link
        to={buildGraphUrl({ entityA: target.entityA, entityB: target.entityB })}
        className="mt-3 inline-block text-xs font-medium text-[#64748B] hover:text-[#0F172A]"
      >
        Inspect in Graph →
      </Link>
    </div>
  );
}
