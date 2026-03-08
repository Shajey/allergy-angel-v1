/**
 * Phase 24.1 – RxNorm RXNCONSO.RRF Parser
 *
 * Reads pipe-delimited RXNCONSO, keeps English non-suppressed, groups by RXCUI.
 * Produces normalized drug candidates.
 */

import * as fs from "fs";
import * as readline from "readline";
import { normalizeCanonicalId, dedupeStrings } from "../normalize.js";
import type { IngestionCandidate } from "../../../api/_lib/ingestion/types.js";

/** RXNCONSO columns: RXCUI|LAT|TS|LUI|STT|SUI|ISRF|RXAUI|SAUI|SAB|TTY|CODE|STR|SRL|SUPPRESS|CVF */
const RXCUI = 0;
const LAT = 1;
const SUPPRESS = 14;
const STR = 12;
const TTY = 10;
const SAB = 9;

const TTY_PREFERENCE = ["SCD", "SBD", "SCDG", "SBDG", "BN", "PIN", "SY", "TMSY"];

export interface ParseOptions {
  filePath: string;
  sourceVersion?: string;
}

export async function* parseRxNormConso(
  filePath: string,
  sourceVersion = "unknown"
): AsyncGenerator<IngestionCandidate> {
  const byRxcui = new Map<
    string,
    { names: Map<string, string>; ttyByStr: Map<string, string> }
  >();

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const parts = line.split("|");
    if (parts.length < 15) continue;
    const lat = parts[LAT];
    const suppress = parts[SUPPRESS];
    if (lat !== "ENG") continue;
    if (suppress === "Y") continue;

    const rxcui = parts[RXCUI];
    const str = parts[STR]?.trim();
    const tty = parts[TTY] ?? "";
    if (!rxcui || !str) continue;

    let entry = byRxcui.get(rxcui);
    if (!entry) {
      entry = { names: new Map(), ttyByStr: new Map() };
      byRxcui.set(rxcui, entry);
    }
    const key = str.toLowerCase();
    if (!entry.names.has(key)) {
      entry.names.set(key, str);
      entry.ttyByStr.set(key, tty);
    }
  }

  for (const [rxcui, entry] of byRxcui) {
    const names = [...entry.names.values()];
    const preferred = selectPreferredName(names, entry.ttyByStr);
    const aliases = dedupeStrings(names.filter((n) => n.toLowerCase() !== preferred.toLowerCase()));
    const canonicalId = normalizeCanonicalId(preferred);

    yield {
      id: `rxnorm-${rxcui}`,
      canonicalId,
      registryType: "drug",
      candidateType: "entity",
      name: preferred,
      aliases,
      source: {
        dataset: "RxNorm",
        version: sourceVersion,
        recordId: rxcui,
        url: "https://www.nlm.nih.gov/research/umls/rxnorm",
      },
      status: "pending",
    };
  }
}

function selectPreferredName(
  names: string[],
  ttyByStr: Map<string, string>
): string {
  let best: string | null = null;
  let bestRank = 999;
  for (const n of names) {
    const tty = ttyByStr.get(n.toLowerCase()) ?? "";
    const rank = TTY_PREFERENCE.indexOf(tty);
    const r = rank >= 0 ? rank : 999;
    if (r < bestRank || (r === bestRank && (!best || n.length < best.length))) {
      best = n;
      bestRank = r;
    }
  }
  return best ?? names[0] ?? "Unknown";
}
