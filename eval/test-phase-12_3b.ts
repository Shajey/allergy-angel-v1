/**
 * Phase 12.3b – Replay Candidate Version Resolution Hardening
 *
 * Tests:
 * - path resolution returns fixture version when run from repo root
 * - override flag bypasses fixture read and sets source=explicit
 * - determinism: calling resolver twice returns same value and same source
 */

import { resolveReplayCandidateVersion } from "./pr-packager.js";

function runTests(): void {
  let passed = 0;
  let failed = 0;

  // ── 1) Path resolution returns "10i.2" when run from repo root ─────────────
  const r1 = resolveReplayCandidateVersion({});
  if (r1.version !== "10i.2") {
    failed++;
    console.error(`✗ path resolution should return "10i.2"; got "${r1.version}"`);
  } else {
    passed++;
    console.log("✓ path resolution returns 10i.2 when run from repo root");
  }
  if (r1.source !== "fixture") {
    failed++;
    console.error(`✗ source should be "fixture"; got "${r1.source}"`);
  } else {
    passed++;
    console.log("✓ source is fixture when reading from file");
  }
  if (!r1.fixturePath || !r1.fixturePath.includes("candidate-taxonomy.json")) {
    failed++;
    console.error(`✗ fixturePath should include candidate-taxonomy.json; got "${r1.fixturePath ?? "undefined"}"`);
  } else {
    passed++;
    console.log("✓ fixturePath is set when source is fixture");
  }

  // ── 2) Override flag bypasses fixture read and sets source=explicit ────────
  const r2 = resolveReplayCandidateVersion({ replayCandidateVersion: "10i.99" });
  if (r2.version !== "10i.99") {
    failed++;
    console.error(`✗ override should return "10i.99"; got "${r2.version}"`);
  } else {
    passed++;
    console.log("✓ override flag returns explicit version");
  }
  if (r2.source !== "explicit") {
    failed++;
    console.error(`✗ override source should be "explicit"; got "${r2.source}"`);
  } else {
    passed++;
    console.log("✓ override sets source=explicit");
  }
  if (r2.fixturePath !== undefined) {
    failed++;
    console.error(`✗ override should not set fixturePath; got "${r2.fixturePath}"`);
  } else {
    passed++;
    console.log("✓ override does not set fixturePath");
  }

  // ── 3) Determinism: calling resolver twice returns same value and source ─
  const a = resolveReplayCandidateVersion({});
  const b = resolveReplayCandidateVersion({});
  if (a.version !== b.version || a.source !== b.source) {
    failed++;
    console.error(`✗ determinism: first=${JSON.stringify(a)}, second=${JSON.stringify(b)}`);
  } else {
    passed++;
    console.log("✓ determinism: two calls return same version and source");
  }

  const c = resolveReplayCandidateVersion({ replayCandidateVersion: "x.y" });
  const d = resolveReplayCandidateVersion({ replayCandidateVersion: "x.y" });
  if (c.version !== d.version || c.source !== d.source) {
    failed++;
    console.error(`✗ determinism (override): first=${JSON.stringify(c)}, second=${JSON.stringify(d)}`);
  } else {
    passed++;
    console.log("✓ determinism: two override calls return same version and source");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
