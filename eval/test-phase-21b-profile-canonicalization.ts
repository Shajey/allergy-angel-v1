/**
 * Phase 21b – Profile Canonicalization + Resolution Observability Tests
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { toResolutionMetadata, type ResolvedEntity } from "../api/_lib/knowledge/types.js";
import { resolveEntity } from "../api/_lib/knowledge/entityResolver.js";
import { buildCheckReport } from "../api/_lib/report/buildCheckReport.js";

function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✓ ${message}`);
      passed++;
    } else {
      console.error(`✗ ${message}`);
      failed++;
    }
  }

  // Resolution metadata
  console.log("\n--- Resolution metadata ---");
  {
    const r: ResolvedEntity = {
      raw: "Lexapro",
      canonical: "escitalopram",
      type: "drug",
      class: "ssri",
      resolved: true,
      confidence: 1,
    };
    const meta = toResolutionMetadata(r);
    assert(meta.rawTerm === "Lexapro", "rawTerm preserved");
    assert(meta.canonicalId === "escitalopram", "canonicalId correct");
    assert(meta.resolutionType === "alias", "Lexapro is alias match");
    assert(meta.entityType === "drug", "entityType correct");

    const exact: ResolvedEntity = {
      raw: "escitalopram",
      canonical: "escitalopram",
      type: "drug",
      resolved: true,
      confidence: 1,
    };
    const metaExact = toResolutionMetadata(exact);
    assert(metaExact.resolutionType === "exact", "escitalopram is exact match");

    const unresolved: ResolvedEntity = {
      raw: "xyzzy",
      canonical: "xyzzy",
      type: "unknown",
      resolved: false,
      confidence: 0,
    };
    const metaUnres = toResolutionMetadata(unresolved);
    assert(metaUnres.resolutionType === "unresolved", "xyzzy is unresolved");
  }

  // Report includes resolution
  console.log("\n--- Report resolution observability ---");
  {
    const report = buildCheckReport({
      check: {
        id: "test-check",
        profile_id: "test-profile",
        created_at: "2026-01-01T00:00:00Z",
        raw_text: "fish oil",
        verdict: {
          riskLevel: "none",
          reasoning: "Test",
          matched: [],
          meta: { taxonomyVersion: "10i.3", severity: 0 },
        },
      },
      events: [
        {
          id: "evt-1",
          created_at: "2026-01-01T00:00:00Z",
          event_type: "supplement",
          event_data: {
            supplement: "fish oil",
            _resolution: {
              raw: "fish oil",
              canonical: "omega-3-fatty-acid",
              type: "supplement",
              class: "fatty-acid",
              resolved: true,
              confidence: 1,
            } as ResolvedEntity,
          },
        },
      ],
    });

    const ev = report.input.events[0];
    assert(!!ev.resolution, "event has resolution");
    assert(ev.resolution!.rawTerm === "fish oil", "rawTerm in report");
    assert(ev.resolution!.canonicalId === "omega-3-fatty-acid", "canonicalId in report");
    assert(ev.resolution!.resolutionType === "alias", "resolutionType alias");
    assert(!("_resolution" in (ev.event_data ?? {})), "_resolution stripped from event_data");
  }

  // Profile canonicalization (add-item logic)
  console.log("\n--- Profile add canonicalization logic ---");
  {
    const r1 = resolveEntity("Lexapro");
    assert(r1.resolved && r1.canonical === "escitalopram", "Lexapro → escitalopram");

    const r2 = resolveEntity("fish oil");
    assert(r2.resolved && r2.canonical === "omega-3-fatty-acid", "fish oil → omega-3-fatty-acid");

    const r3 = resolveEntity("groundnut");
    assert(r3.resolved && r3.canonical === "peanut", "groundnut → peanut");

    const r4 = resolveEntity("Unknown Med XYZ");
    assert(!r4.resolved && r4.canonical === "unknown med xyz", "unknown normalized");
  }

  console.log(`\n=== Phase 21b Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
