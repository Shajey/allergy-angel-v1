/**
 * Phase 21a – Enrich Extraction with Entity Resolution
 *
 * Adds resolution data to extracted health events before inference.
 */

import { resolveEntity } from "./entityResolver.js";
import type { ResolvedEntity } from "./types.js";

/** Health event shape from extraction (uses type, fields) */
interface HealthEvent {
  type?: string;
  fields?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Event with resolution attached */
export interface EnrichedHealthEvent extends HealthEvent {
  resolution?: ResolvedEntity;
}

/**
 * Extract the entity name from an event for resolution.
 */
function extractEntityName(event: HealthEvent): string | null {
  const t = event.type;
  if (t === "medication") {
    const v = event.fields?.medication;
    return typeof v === "string" ? v : null;
  }
  if (t === "supplement") {
    const v = event.fields?.supplement ?? event.fields?.name;
    return typeof v === "string" ? v : null;
  }
  if (t === "meal") {
    const v = event.fields?.meal ?? event.fields?.food;
    return typeof v === "string" ? v : null;
  }
  return null;
}

/**
 * Enrich extracted events with entity resolution.
 */
export function enrichWithResolution(
  events: HealthEvent[]
): EnrichedHealthEvent[] {
  return events.map((event) => {
    const entityName = extractEntityName(event);
    if (!entityName) {
      return { ...event } as EnrichedHealthEvent;
    }

    const resolution = resolveEntity(entityName);
    return {
      ...event,
      resolution,
    } as EnrichedHealthEvent;
  });
}
