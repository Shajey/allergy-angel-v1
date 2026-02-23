#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

/**
 * Phase 12.3 – PR Packager CLI
 *
 * Produces a deterministic patch bundle for taxonomy/registry promotions.
 * Output: eval/out/pr-packages/<hash>/
 *
 * Usage:
 *   npm run pr:pack -- --profileId=... --selectTaxonomy=mango --selectRegistry=protein --parent=tree_nut --mode=crossReactive --runReplay --strict
 *   npm run pr:pack -- --export=promo.json --selectTaxonomy=mango --parent=tree_nut --mode=crossReactive --dry-run
 *
 * Prerequisite for live build: npx vercel dev (or DB access for buildPromotionExport)
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { loadAllergenTaxonomy, type LoadedTaxonomy } from "../api/_lib/knowledge/loadAllergenTaxonomy.js";
import { loadFunctionalRegistry } from "../api/_lib/knowledge/loadFunctionalRegistry.js";
import { buildPromotionExport } from "../api/_lib/admin/promotionExport.js";
import { buildPRPackagerOutput, type PRPackagerInput } from "../api/_lib/admin/prPackager/index.js";
import { suggestAliasesForUnmapped } from "../api/_lib/admin/aliasSuggester.js";
import type { TaxonomyEditMode } from "../api/_lib/admin/prPackager/transforms.js";
import type { PromotionExportResult } from "../api/_lib/admin/promotionExport.js";

const DEFAULT_OUT = resolve(process.cwd(), "eval/out/pr-packages");
const REPLAY_SCRIPT = resolve(process.cwd(), "eval/replay-validate.ts");
const CANDIDATE_FIXTURE_REL = "eval/fixtures/replay/knowledge/candidate-taxonomy.json";
const MAX_REPO_ROOT_LEVELS = 8;

export type ReplayCandidateVersionSource = "fixture" | "explicit";

export interface ReplayCandidateVersionResult {
  version: string;
  source: ReplayCandidateVersionSource;
  fixturePath?: string;
}

/** Find repo root by walking up from cwd until package.json and candidate fixture exist. Returns null if not found. */
function tryFindRepoRoot(): string | null {
  const cwd = process.cwd();
  let dir = cwd;
  for (let i = 0; i < MAX_REPO_ROOT_LEVELS; i++) {
    const pkgPath = join(dir, "package.json");
    const fixturePath = join(dir, CANDIDATE_FIXTURE_REL);
    if (existsSync(pkgPath) && existsSync(fixturePath)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Find repo root; throws with actionable diagnostics if not found. */
function findRepoRoot(): string {
  const cwd = process.cwd();
  const root = tryFindRepoRoot();
  if (root) return root;
  const tried: string[] = [];
  let dir = cwd;
  for (let i = 0; i < MAX_REPO_ROOT_LEVELS; i++) {
    tried.push(dir);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const attemptedPath = join(tried[0] ?? cwd, CANDIDATE_FIXTURE_REL);
  throw new Error(
    `Cannot determine expected replay candidate version.\n` +
      `  process.cwd(): ${cwd}\n` +
      `  attempted path: ${attemptedPath}\n` +
      `  existsSync(attempted path): ${existsSync(attemptedPath)}\n` +
      `  repo root detection: not found (tried: ${tried.join(" → ")})`
  );
}

/** Resolve replay candidate version from fixture or explicit override. Deterministic. */
export function resolveReplayCandidateVersion(opts?: {
  replayCandidateVersion?: string;
}): ReplayCandidateVersionResult {
  if (opts?.replayCandidateVersion?.trim()) {
    return {
      version: opts.replayCandidateVersion.trim(),
      source: "explicit",
    };
  }
  const repoRoot = findRepoRoot();
  const fixturePath = join(repoRoot, CANDIDATE_FIXTURE_REL);
  try {
    const raw = readFileSync(fixturePath, "utf-8");
    const parsed = JSON.parse(raw) as { version?: string };
    if (typeof parsed.version === "string") {
      return { version: parsed.version, source: "fixture", fixturePath };
    }
  } catch {
    /* fall through */
  }
  throw new Error(
    `Cannot determine expected replay candidate version.\n` +
      `  process.cwd(): ${process.cwd()}\n` +
      `  attempted path: ${fixturePath}\n` +
      `  existsSync(attempted path): ${existsSync(fixturePath)}\n` +
      `  repo root: ${repoRoot} (file exists but version field missing or unreadable)`
  );
}

function parseArgs(): {
  exportPath?: string;
  profileId?: string;
  windowHours: number;
  mode: TaxonomyEditMode;
  selectTaxonomy: string[];
  selectRegistry: string[];
  parent: string;
  aliasFor?: string;
  bumpTaxonomyVersionTo?: string;
  replayCandidateVersion?: string;
  runReplay: boolean;
  strict: boolean;
  dryRun: boolean;
  outRoot: string;
} {
  const args = process.argv.slice(2);
  let exportPath: string | undefined;
  let profileId: string | undefined;
  let windowHours = 168;
  let mode: TaxonomyEditMode = "crossReactive";
  let selectTaxonomy: string[] = [];
  let selectRegistry: string[] = [];
  let parent = "";
  let aliasFor: string | undefined;
  let bumpTaxonomyVersionTo: string | undefined;
  let replayCandidateVersion: string | undefined;
  let runReplay = false;
  let strict = process.env.STRICT === "true";
  let dryRun = false;
  let outRoot = DEFAULT_OUT;

  for (const arg of args) {
    const eq = arg.indexOf("=");
    const val = eq >= 0 ? arg.slice(eq + 1) : "";
    if (arg.startsWith("--export=")) {
      exportPath = resolve(process.cwd(), val);
    } else if (arg.startsWith("--profileId=")) {
      profileId = val.trim();
    } else if (arg.startsWith("--windowHours=")) {
      windowHours = Math.max(1, parseInt(val, 10) || 168);
    } else if (arg.startsWith("--mode=")) {
      if (val === "crossReactive" || val === "child") mode = val;
    } else if (arg.startsWith("--selectTaxonomy=")) {
      selectTaxonomy = val.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg.startsWith("--selectRegistry=")) {
      selectRegistry = val.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg.startsWith("--parent=")) {
      parent = val.trim();
    } else if (arg.startsWith("--aliasFor=")) {
      aliasFor = val.trim();
    } else if (arg.startsWith("--bumpTaxonomyVersionTo=")) {
      bumpTaxonomyVersionTo = val.trim();
    } else if (arg.startsWith("--replayCandidateVersion=")) {
      replayCandidateVersion = val.trim();
    } else if (arg === "--runReplay") {
      runReplay = true;
    } else if (arg.startsWith("--strict=")) {
      strict = val.toLowerCase() === "true";
    } else if (arg === "--strict") {
      strict = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--out=")) {
      outRoot = resolve(process.cwd(), val);
    }
  }

  return {
    exportPath,
    profileId,
    windowHours,
    mode,
    selectTaxonomy,
    selectRegistry,
    parent,
    aliasFor,
    bumpTaxonomyVersionTo,
    replayCandidateVersion,
    runReplay,
    strict,
    dryRun,
    outRoot,
  };
}

function loadPromotionFromFile(path: string): PromotionExportResult {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as PromotionExportResult;
}

async function main(): Promise<void> {
  const opts = parseArgs();

  let promotion: PromotionExportResult;

  if (opts.exportPath) {
    try {
      promotion = loadPromotionFromFile(opts.exportPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to read export: ${msg}`);
      process.exit(1);
    }
  } else {
    const pid = opts.profileId ?? process.env.DEFAULT_PROFILE_ID ?? "";
    if (!pid) {
      console.error("Missing --profileId (or --export=path).");
      process.exit(1);
    }
    try {
      promotion = await buildPromotionExport({
        profileId: pid,
        windowHours: opts.windowHours,
        limit: 20,
        mode: "blank",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`buildPromotionExport failed: ${msg}`);
      process.exit(1);
    }
  }

  if (opts.selectTaxonomy.length === 0 && opts.selectRegistry.length === 0) {
    console.error("Provide --selectTaxonomy=... and/or --selectRegistry=...");
    process.exit(1);
  }

  if (opts.selectTaxonomy.length > 0 && !opts.aliasFor && !opts.parent) {
    console.error("Taxonomy selection requires --parent=<parent_key> or --aliasFor=<targetNodeId>");
    process.exit(1);
  }
  if (opts.aliasFor && !opts.parent) {
    opts.parent = "_alias"; // placeholder when aliasFor is used
  }

  const currentTaxonomy = loadAllergenTaxonomy();
  const currentRegistry = loadFunctionalRegistry();

  const input: PRPackagerInput = {
    promotion,
    selection: {
      taxonomy: opts.selectTaxonomy,
      registry: opts.selectRegistry,
    },
    taxonomyMode: opts.mode,
    taxonomyParent: opts.parent,
    currentTaxonomy,
    currentRegistry,
    aliasFor: opts.aliasFor,
    options: {
      bumpTaxonomyVersionTo: opts.bumpTaxonomyVersionTo,
    },
  };

  let output;
  try {
    output = buildPRPackagerOutput(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    process.exit(1);
  }

  const replayResult = resolveReplayCandidateVersion({
    replayCandidateVersion: opts.replayCandidateVersion,
  });
  const proposedVersion = output.proposedTaxonomy.version;

  if (opts.dryRun) {
    console.log("\n=== PR Packager (Dry Run) ===\n");
    console.log("Bundle hash:", output.bundleHash);
    console.log("Proposed version (PR bump):", proposedVersion);
    console.log("Replay candidate version:", replayResult.version, `(source: ${replayResult.source})`);
    if (proposedVersion !== replayResult.version) {
      console.log("  (versions differ; replay would use replay-candidate-taxonomy.json with fixture version)");
    }
    console.log("Taxonomy terms:", output.manifest.selectedTerms.join(", "));
    console.log("Registry names:", output.manifest.selectedRegistry.join(", "));
    if (opts.runReplay) {
      console.log("\nReplay would run with: replay-candidate-taxonomy.json");
    }
    console.log("\nProposed taxonomy (excerpt):");
    console.log(JSON.stringify(output.proposedTaxonomy, null, 2).slice(0, 500) + "...");
    console.log("\nNo files written. Remove --dry-run to generate bundle.");
    return;
  }

  const bundleDir = resolve(opts.outRoot, output.bundleHash);
  mkdirSync(resolve(bundleDir, "patches"), { recursive: true });

  writeFileSync(
    resolve(bundleDir, "proposed-taxonomy.json"),
    JSON.stringify(output.proposedTaxonomy, null, 2) + "\n",
    "utf-8"
  );

  const replayCandidateTaxonomy = {
    ...output.proposedTaxonomy,
    version: replayResult.version,
  };
  if (opts.runReplay) {
    writeFileSync(
      resolve(bundleDir, "replay-candidate-taxonomy.json"),
      JSON.stringify(replayCandidateTaxonomy, null, 2) + "\n",
      "utf-8"
    );
  }

  writeFileSync(
    resolve(bundleDir, "proposed-registry.json"),
    JSON.stringify(output.proposedRegistry, null, 2) + "\n",
    "utf-8"
  );

  const repoRoot = tryFindRepoRoot() ?? process.cwd();
  const baselinePath = join(repoRoot, "eval/fixtures/replay/knowledge/baseline-taxonomy.json");
  const candidatePath = join(repoRoot, CANDIDATE_FIXTURE_REL);
  let currentTaxonomyJson: string;
  try {
    currentTaxonomyJson = readFileSync(candidatePath, "utf-8");
  } catch {
    currentTaxonomyJson = JSON.stringify(currentTaxonomy, null, 2);
  }
  const taxonomyDiff = diffUnified(
    "eval/fixtures/replay/knowledge/candidate-taxonomy.json",
    currentTaxonomyJson,
    JSON.stringify(output.proposedTaxonomy, null, 2)
  );
  writeFileSync(resolve(bundleDir, "patches/taxonomy.diff"), taxonomyDiff, "utf-8");

  const currentRegistryJson = JSON.stringify(currentRegistry, null, 2);
  const registryDiff = diffUnified(
    "api/_lib/inference/functionalClasses.ts (registry)",
    currentRegistryJson,
    JSON.stringify(output.proposedRegistry, null, 2)
  );
  writeFileSync(resolve(bundleDir, "patches/registry.diff"), registryDiff, "utf-8");

  const packagerMd = buildPackagerMd(output, opts, promotion, currentTaxonomy, {
    proposedVersion,
    replayResult,
  });
  writeFileSync(resolve(bundleDir, "PACKAGER.md"), packagerMd, "utf-8");

  let replayLog = "";
  let replayExitCode: number | undefined;
  if (opts.runReplay) {
    const replayCandidatePath = resolve(bundleDir, "replay-candidate-taxonomy.json");
    const env = { ...process.env, STRICT: opts.strict ? "true" : "" };
    const result = spawnSync(
      "npx",
      ["tsx", REPLAY_SCRIPT, `--candidateTaxonomy=${replayCandidatePath}`],
      {
        cwd: process.cwd(),
        env,
        encoding: "utf-8",
      }
    );
    replayLog = [result.stdout, result.stderr].filter(Boolean).join("\n");
    replayExitCode = result.status ?? undefined;
    writeFileSync(resolve(bundleDir, "replay.log"), replayLog, "utf-8");
  }

  const manifestWithVersions = {
    ...output.manifest,
    proposedVersion,
    replayCandidateVersion: replayResult.version,
    replayCandidateVersionSource: replayResult.source,
    ...(replayResult.fixturePath && {
      replayCandidateVersionFixturePath: replayResult.fixturePath,
    }),
    ...(opts.runReplay && {
      replay: {
        exitCode: replayExitCode ?? -1,
        passed: replayLog.includes("PASSED"),
      },
    }),
  };
  writeFileSync(
    resolve(bundleDir, "manifest.json"),
    JSON.stringify(manifestWithVersions, null, 2) + "\n",
    "utf-8"
  );

  console.log("\n=== PR Packager ===\n");
  console.log("Bundle ID:  ", output.bundleHash);
  console.log("Output:     ", bundleDir + "/");
  console.log("Version:    ", currentTaxonomy.version, "→", output.proposedTaxonomy.version);
  console.log("Taxonomy:   ", output.manifest.selectedTerms.join(", ") || "(none)");
  console.log("Registry:   ", output.manifest.selectedRegistry.join(", ") || "(none)");
  if (opts.runReplay) {
    console.log("Replay:     ", replayLog.includes("PASSED") ? "PASSED" : "see replay.log");
  }
  console.log("\nReview PACKAGER.md, apply patches, then run validation.\n");
}

function diffUnified(label: string, from: string, to: string): string {
  const a = from.split("\n");
  const b = to.split("\n");
  const lines: string[] = [`--- a/${label}`, `+++ b/${label}`];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push(" " + a[i]);
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || (i < a.length && !a.slice(i).includes(b[j])))) {
      lines.push("+" + b[j]);
      j++;
    } else if (i < a.length) {
      lines.push("-" + a[i]);
      i++;
    } else {
      lines.push("+" + b[j]);
      j++;
    }
  }
  return lines.join("\n");
}

function collectTaxonomyIds(taxonomy: { taxonomy: Record<string, { children: string[] }>; crossReactive: Array<{ related: string[] }> }): string[] {
  const ids = new Set<string>();
  for (const entry of Object.values(taxonomy.taxonomy)) {
    for (const c of entry.children) ids.add(c.toLowerCase().trim());
  }
  for (const cr of taxonomy.crossReactive) {
    for (const r of cr.related) ids.add(r.toLowerCase().trim());
  }
  return [...ids];
}

function buildPackagerMd(
  output: { manifest: { selectedTerms: string[]; selectedRegistry: string[]; suggestedAllowlistScenarioIds: string[] }; proposedTaxonomy: { version: string } },
  opts: { mode: TaxonomyEditMode; parent: string; aliasFor?: string },
  promotion: PromotionExportResult,
  currentTaxonomy: LoadedTaxonomy,
  versions: { proposedVersion: string; replayResult: ReplayCandidateVersionResult }
): string {
  const terms = output.manifest.selectedTerms.map((t) => `\`${t}\``).join(", ");
  const registry = output.manifest.selectedRegistry.map((r) => `\`${r}\``).join(", ");
  const versionNote =
    versions.proposedVersion !== versions.replayResult.version
      ? "\n\n**Note:** If versions differ, PR merge requires updating replay fixtures and allowlist fingerprints as a separate explicit step."
      : "";
  const replaySourceLine =
    versions.replayResult.source === "fixture" && versions.replayResult.fixturePath
      ? `Replay candidate version: ${versions.replayResult.version} (source: fixture, path: ${versions.replayResult.fixturePath})`
      : `Replay candidate version: ${versions.replayResult.version} (source: ${versions.replayResult.source})`;

  const unmappedTerms = (promotion.proposals?.taxonomyAdditions ?? []).map((t) => t.term);
  const existingIds = collectTaxonomyIds(currentTaxonomy);
  const linguisticSuggestions = unmappedTerms.length > 0
    ? suggestAliasesForUnmapped(unmappedTerms, existingIds)
    : [];

  const lines: string[] = [
    "# PR Packager Runbook (Phase 12.3)",
    "",
    "## Summary",
    `Taxonomy: ${terms || "(none)"} as **${opts.mode}** under \`${opts.parent}\``,
    `Registry: ${registry || "(none)"}`,
    `Replay ran against: replay-candidate-taxonomy.json (version ${versions.replayResult.version})`,
    `Proposed PR taxonomy file: proposed-taxonomy.json (version ${versions.proposedVersion})`,
    replaySourceLine,
    versionNote,
    "",
    ...(linguisticSuggestions.length > 0
      ? [
          "",
          "## Linguistic Insights (Phase 12.6)",
          "Suggested Alias Candidates (advisory only; human review required):",
          "",
          ...linguisticSuggestions.map(
            (s) => `- \`${s.candidate}\` → \`${s.suggestedTarget}\` (${(s.similarity * 100).toFixed(0)}% similarity${s.stemMatch ? ", stem match" : ""})`
          ),
          "",
        ]
      : []),
    "## Pressure Evidence",
    "Before promoting, capture vigilance pressure for these terms:",
    "```bash",
    "curl \"http://localhost:3000/api/vigilance?profileId=...\" | jq '.pressureSources'",
    "```",
    "Record weightedScore and maxWeighted for each promoted term. This provides a permanent record of why the term was added.",
    "",
    "## Apply Patches",
    "1. Copy `proposed-taxonomy.json` to `eval/fixtures/replay/knowledge/candidate-taxonomy.json`",
    "2. Update `api/_lib/inference/allergenTaxonomy.ts` (ALLERGEN_TAXONOMY_VERSION, taxonomy, CROSS_REACTIVE_REGISTRY" +
      (opts.aliasFor ? ", ALIASES)" : ")"),
    "3. Update registry if needed (see proposed-registry.json)",
    "",
    "## Suggested Allowlist Scenario IDs",
    ...output.manifest.suggestedAllowlistScenarioIds.map((id) => `- ${id}`),
    "",
    "## Validation",
    "```bash",
    "npm run replay:validate:ci",
    "npm run test:phase-11",
    "npm run test:phase-12_1",
    "npm run test:phase-12_2",
    "npm run test:phase-12_3",
    "```",
    "",
  ];
  return lines.join("\n");
}

const isMainModule =
  typeof process.argv[1] === "string" &&
  (process.argv[1].includes("pr-packager") || fileURLToPath(import.meta.url) === resolve(process.argv[1]));

if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
