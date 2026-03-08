#!/usr/bin/env node
/**
 * Phase 24.1 – RxNorm Ingestion CLI
 *
 * Usage: npm run ingest:rxnorm -- /path/to/RXNCONSO.RRF
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import * as path from "path";
import { parseRxNormConso } from "./parser.js";
import { dedupeCandidates } from "../dedupe.js";
import { saveCandidates } from "../store.js";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run ingest:rxnorm -- /path/to/RXNCONSO.RRF");
    process.exit(1);
  }

  const version = path.basename(path.dirname(filePath)) || "unknown";
  const candidates: import("../../../api/_lib/ingestion/types.js").IngestionCandidate[] = [];

  console.log("Parsing RxNorm...");
  for await (const c of parseRxNormConso(filePath, version)) {
    candidates.push(c);
    if (candidates.length % 5000 === 0) {
      process.stdout.write(`  ${candidates.length} concepts\r`);
    }
  }
  console.log(`Parsed ${candidates.length} concepts`);

  console.log("Deduplicating against registry...");
  const deduped = dedupeCandidates(candidates);
  const pending = deduped.filter((c) => c.status === "pending");
  const duplicates = deduped.filter((c) => c.status === "duplicate");
  console.log(`  Pending: ${pending.length}, Duplicates: ${duplicates.length}`);

  console.log("Saving to staging...");
  const saved = await saveCandidates(deduped);
  console.log(`Saved ${saved} candidates`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
