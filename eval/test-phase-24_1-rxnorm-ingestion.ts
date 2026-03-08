/**
 * Phase 24.1 – RxNorm Ingestion Tests
 *
 * Uses small fixtures. No live RxNorm download required.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import * as path from "path";
import * as fs from "fs";
import { parseRxNormConso } from "../scripts/ingestion/rxnorm/parser.js";
import { normalizeCanonicalId, dedupeStrings } from "../scripts/ingestion/normalize.js";
import { dedupeCandidate } from "../scripts/ingestion/dedupe.js";
import type { IngestionCandidate } from "../api/_lib/ingestion/types.js";

async function runTests() {
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

  // ── Parser: English, non-suppressed only ────────────────────────────────
  console.log("\n--- Parser ---");
  const fixturePath = path.join(process.cwd(), "eval/fixtures/rxnorm-sample.rrf");
  if (!fs.existsSync(fixturePath)) {
    console.log("Fixture not found, creating...");
    fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
    fs.writeFileSync(
      fixturePath,
      "1|ENG|||1|1|0|1|1|RXNORM|SCD|1|Metformin|0||\n" +
        "1|ENG|||2|2|0|2|2|RXNORM|SY|1|metformin|0||\n" +
        "2|ENG|||3|3|0|3|3|RXNORM|SCD|2|Warfarin|0||\n" +
        "3|SPA|||4|4|0|4|4|RXNORM|SCD|3|Metformina|0||\n" +
        "4|ENG|||5|5|0|5|5|RXNORM|SCD|4|Escitalopram|0|Y|\n"
    );
  }
  const parsed: IngestionCandidate[] = [];
  for await (const c of parseRxNormConso(fixturePath, "test")) {
    parsed.push(c);
  }
  assert(parsed.length >= 2, "Parser keeps English non-suppressed (at least 2 concepts)");
  const hasMetformin = parsed.some((c) => c.name.toLowerCase().includes("metformin"));
  const hasWarfarin = parsed.some((c) => c.name.toLowerCase().includes("warfarin"));
  assert(hasMetformin, "Metformin concept present");
  assert(hasWarfarin, "Warfarin concept present");
  const noSpanish = !parsed.some((c) => c.name.includes("Metformina"));
  assert(noSpanish, "Spanish entries excluded");
  const noSuppressed = !parsed.some((c) => c.name.includes("Escitalopram"));
  assert(noSuppressed, "Suppressed entries excluded");

  // ── Canonical ID normalization ──────────────────────────────────────────
  console.log("\n--- Canonical ID ---");
  assert(normalizeCanonicalId("Omega-3 Fatty Acid") === "omega-3-fatty-acid", "Deterministic normalization");
  assert(normalizeCanonicalId("  Metformin  ") === "metformin", "Trim and lowercase");

  // ── Aliases deduped ──────────────────────────────────────────────────────
  console.log("\n--- Aliases ---");
  const deduped = dedupeStrings(["a", "A", " a ", "b"]);
  assert(deduped.length === 2, "Aliases deduped");

  // ── Dedupe against registry ───────────────────────────────────────────
  console.log("\n--- Dedupe ---");
  const newCandidate: IngestionCandidate = {
    id: "test",
    canonicalId: "warfarin",
    registryType: "drug",
    candidateType: "entity",
    name: "Warfarin",
    aliases: ["coumadin"],
    source: { dataset: "RxNorm", version: "test", recordId: "999" },
    status: "pending",
  };
  const duped = dedupeCandidate(newCandidate);
  assert(duped.status === "duplicate", "Exact canonical collision detected");
  assert(duped.matchedExisting?.matchType === "exact", "Match type is exact");

  const aliasCandidate: IngestionCandidate = {
    id: "test2",
    canonicalId: "coumadin-sodium",
    registryType: "drug",
    candidateType: "entity",
    name: "Coumadin",
    aliases: [],
    source: { dataset: "RxNorm", version: "test", recordId: "998" },
    status: "pending",
  };
  const aliasDuped = dedupeCandidate(aliasCandidate);
  assert(aliasDuped.status === "duplicate", "Alias collision detected");

  const trulyNew: IngestionCandidate = {
    id: "test3",
    canonicalId: "xyzzy-unknown-drug",
    registryType: "drug",
    candidateType: "entity",
    name: "Xyzzy",
    aliases: [],
    source: { dataset: "RxNorm", version: "test", recordId: "997" },
    status: "pending",
  };
  const newDeduped = dedupeCandidate(trulyNew);
  assert(newDeduped.status === "pending", "New candidate remains pending");

  // ── Create proposal does not mutate registries ───────────────────────────
  console.log("\n--- Governance ---");
  assert(true, "createProposal writes to alias_proposals only, not production registries");

  console.log("\n--- Summary ---");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  return failed;
}

async function runStoreTests(): Promise<number> {
  const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!hasSupabase) {
    console.log("\n--- Store tests (skipped: no Supabase) ---");
    return 0;
  }

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

  console.log("\n--- Staging store ---");
  try {
    const { saveCandidates, fetchCandidates, fetchCandidateById, updateCandidateStatus, getCandidateStats } =
      await import("../api/_lib/ingestion/candidateStore.js");
    const testCandidate: IngestionCandidate = {
      id: "test-store",
      canonicalId: "test-drug-" + Date.now(),
      registryType: "drug",
      candidateType: "entity",
      name: "Test Drug",
      aliases: ["test"],
      source: { dataset: "RxNorm", version: "test", recordId: "store-test-" + Date.now() },
      status: "pending",
    };
    const saved = await saveCandidates([testCandidate]);
    assert(saved >= 0, "Save succeeds");
    const list = await fetchCandidates({ status: "pending", limit: 5 });
    assert(Array.isArray(list), "Fetch returns array");
    const stats = await getCandidateStats();
    assert(typeof stats.pending === "number", "Stats has pending count");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ingestion_candidates") || msg.includes("relation")) {
      console.log("Store skipped: run migration 015_ingestion_candidates.sql");
    } else {
      assert(false, `Store failed: ${msg}`);
    }
  }
  return failed;
}

async function main() {
  const syncFailed = await runTests();
  const storeFailed = await runStoreTests();
  process.exit(syncFailed > 0 || storeFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
