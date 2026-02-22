#!/usr/bin/env node
/**
 * Phase 12.2 – Replay Validator CLI
 *
 * Deterministic regression gate for taxonomy/registry promotions.
 * Compares baseline vs candidate knowledge over fixture scenarios.
 *
 * Usage:
 *   npm run replay:validate -- --baselineTaxonomy=path [--candidateTaxonomy=path] [--strict=true]
 *
 * When paths omitted, uses eval/fixtures/replay/knowledge/*.json
 */

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadAllergenTaxonomy } from "../api/_lib/knowledge/loadAllergenTaxonomy.js";
import { checkRiskWithTaxonomy } from "../api/_lib/eval/replayCheckRisk.js";
import {
  normalizeVerdict,
  computeReplayDiff,
  buildReplayReport,
  evaluateGate,
  parseAllowlist,
  type ParsedAllowlist,
} from "../api/_lib/eval/replayDiff.js";
import { buildCheckReport } from "../api/_lib/report/buildCheckReport.js";
import { validateNoOrphanAdvice } from "../api/_lib/advice/validateNoOrphanAdvice.js";

const DEFAULT_FIXTURES = resolve(process.cwd(), "eval/fixtures/replay");
const DEFAULT_OUT = resolve(process.cwd(), "eval/out");

function parseArgs(): {
  baselineTaxonomy: string;
  candidateTaxonomy: string;
  scenariosPath: string;
  allowlistPath: string;
  outPath: string;
  strict: boolean;
} {
  const args = process.argv.slice(2);
  let baselineTaxonomy = resolve(DEFAULT_FIXTURES, "knowledge/baseline-taxonomy.json");
  let candidateTaxonomy = resolve(DEFAULT_FIXTURES, "knowledge/candidate-taxonomy.json");
  let scenariosPath = resolve(DEFAULT_FIXTURES, "scenarios.json");
  let allowlistPath = resolve(DEFAULT_FIXTURES, "allowlist.json");
  let outPath = DEFAULT_OUT;
  let strict = process.env.STRICT === "true";

  for (const arg of args) {
    if (arg.startsWith("--baselineTaxonomy=")) {
      baselineTaxonomy = resolve(process.cwd(), arg.slice(18));
    } else if (arg.startsWith("--candidateTaxonomy=")) {
      candidateTaxonomy = resolve(process.cwd(), arg.slice(20));
    } else if (arg.startsWith("--baselineRegistry=")) {
      /* registry not used in checkRisk; ignore */
    } else if (arg.startsWith("--candidateRegistry=")) {
      /* registry not used in checkRisk; ignore */
    } else if (arg.startsWith("--scenarios=")) {
      scenariosPath = resolve(process.cwd(), arg.slice(12));
    } else if (arg.startsWith("--allowlist=")) {
      allowlistPath = resolve(process.cwd(), arg.slice(11));
    } else if (arg.startsWith("--out=")) {
      outPath = resolve(process.cwd(), arg.slice(6));
    } else if (arg.startsWith("--strict=")) {
      strict = arg.slice(9).toLowerCase() === "true";
    }
  }

  return {
    baselineTaxonomy,
    candidateTaxonomy,
    scenariosPath,
    allowlistPath,
    outPath,
    strict,
  };
}

interface Scenario {
  scenarioId: string;
  profile: {
    profileId: string;
    known_allergies?: string[];
    allergens?: string[];
    current_medications?: { name: string; dosage?: string }[];
  };
  events: Array<{
    type: string;
    created_at?: string;
    event_data?: Record<string, unknown>;
    fields?: Record<string, unknown>;
  }>;
}

function loadScenarios(path: string): Scenario[] {
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`Scenarios must be array: ${path}`);
  return parsed;
}

function loadAllowlist(path: string): ParsedAllowlist {
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    return parseAllowlist(parsed);
  } catch {
    return parseAllowlist(null);
  }
}

function normalizeScenarioToEvents(scenario: Scenario): Array<{ type: string; fields?: Record<string, unknown>; event_data?: Record<string, unknown> }> {
  const events = scenario.events ?? [];
  return events
    .filter((e) => e.type === "meal" || e.type === "medication")
    .map((e) => ({
      type: e.type,
      fields: e.event_data ?? e.fields ?? {},
      event_data: e.event_data ?? e.fields ?? {},
    }));
}

function normalizeProfile(scenario: Scenario): { known_allergies: string[]; current_medications: { name: string; dosage?: string }[] } {
  const p = scenario.profile ?? {};
  const allergies = p.known_allergies ?? p.allergens ?? [];
  const meds = p.current_medications ?? [];
  return {
    known_allergies: Array.isArray(allergies) ? allergies : [],
    current_medications: Array.isArray(meds) ? meds : [],
  };
}

function main(): void {
  const opts = parseArgs();

  const baselineKnowledge = loadAllergenTaxonomy(opts.baselineTaxonomy);
  const candidateKnowledge = loadAllergenTaxonomy(opts.candidateTaxonomy);
  const scenarios = loadScenarios(opts.scenariosPath);
  const allowlist = loadAllowlist(opts.allowlistPath);

  const diffs: ReturnType<typeof computeReplayDiff>[] = [];
  const topTargetsRaw: Record<string, string> = {};

  for (const scenario of scenarios) {
    const profile = normalizeProfile(scenario);
    const events = normalizeScenarioToEvents(scenario);

    const baselineVerdict = checkRiskWithTaxonomy(profile, events, baselineKnowledge);
    const candidateVerdict = checkRiskWithTaxonomy(profile, events, candidateKnowledge);

    const baselineNorm = normalizeVerdict(
      baselineVerdict,
      baselineKnowledge.version,
      null
    );
    const candidateNorm = normalizeVerdict(
      candidateVerdict,
      candidateKnowledge.version,
      null
    );

    const diff = computeReplayDiff(
      scenario.scenarioId,
      baselineNorm,
      candidateNorm
    );
    diffs.push(diff);

    const hasAllergyMatch = (candidateVerdict.matched ?? []).some(
      (m) => m.rule === "allergy_match" || m.rule === "cross_reactive"
    );
    if (hasAllergyMatch) {
      const check = {
        id: `replay-${scenario.scenarioId}`,
        profile_id: scenario.profile?.profileId ?? "00000000-0000-0000-0000-000000000001",
        created_at: "2025-01-15T12:00:00.000Z",
        raw_text: "",
        verdict: candidateVerdict,
      };
      const reportOut = buildCheckReport({ check, events: [], generatedAt: "2025-01-15T12:00:00.000Z" });
      const topTarget = reportOut.output.advice?.topTarget ?? null;
      if (topTarget !== null) {
        topTargetsRaw[scenario.scenarioId] = topTarget;
      }
    }
  }

  const topTargetsSorted = Object.fromEntries(
    Object.entries(topTargetsRaw).sort((a, b) => a[0].localeCompare(b[0]))
  );

  const report = buildReplayReport(diffs, {
    baselineTaxonomyVersion: baselineKnowledge.version,
    candidateTaxonomyVersion: candidateKnowledge.version,
  });
  if (Object.keys(topTargetsSorted).length > 0) {
    report.meta.adviceValidation = { mode: "present", topTargets: topTargetsSorted };
  }

  const orphans = validateNoOrphanAdvice();
  if (orphans.length > 0) {
    console.error("\n--- Orphan Advice FAILED ---");
    console.error("Advice targets not in taxonomy:", orphans.join(", "));
    process.exit(1);
  }
  const gate = evaluateGate(report, allowlist, opts.strict);

  mkdirSync(opts.outPath, { recursive: true });
  const outFile = resolve(opts.outPath, "replay-diff.json");
  writeFileSync(outFile, JSON.stringify(report, null, 2), "utf-8");

  // Human-readable summary
  console.log("\n=== Replay Validation Report ===\n");
  console.log(`Allowlist mode: ${allowlist.mode}`);
  console.log(`Total scenarios: ${report.summary.totalScenarios}`);
  console.log(`RiskLevel changes (up): ${report.summary.riskLevelChangesUp}`);
  console.log(`RiskLevel changes (down): ${report.summary.riskLevelChangesDown}`);
  console.log(`Added matches: ${report.summary.totalAddedMatches}`);
  console.log(`Removed matches: ${report.summary.totalRemovedMatches}`);
  console.log(`\nOutput: ${outFile}`);

  const changed = report.scenarios.filter((s) => s.changes.riskLevelChanged || s.changes.addedMatches.length > 0 || s.changes.removedMatches.length > 0);
  if (changed.length > 0) {
    console.log("\n--- Top diffs ---");
    for (const d of changed.slice(0, 5)) {
      console.log(`\n${d.scenarioId}:`);
      if (d.changes.riskLevelChanged) {
        console.log(`  riskLevel: ${d.baselineVerdict.riskLevel} → ${d.candidateVerdict.riskLevel}`);
      }
      if (d.changes.addedMatches.length > 0) {
        console.log(`  added: ${d.changes.addedMatches.join(", ")}`);
      }
      if (d.changes.removedMatches.length > 0) {
        console.log(`  removed: ${d.changes.removedMatches.join(", ")}`);
      }
    }
  }

  if (!gate.passed) {
    console.log("\n--- Gate FAILED ---");
    for (const f of gate.failures) {
      console.error(`  ${f}`);
    }
    process.exit(1);
  }

  console.log("\n--- Gate PASSED ---\n");
  process.exit(0);
}

main();
