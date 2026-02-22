#!/usr/bin/env node
/**
 * Phase 12.4 – Apply PR Package CLI
 *
 * Deterministic "apply + verify" helper for PR packages from Phase 12.3.
 * Human-in-the-loop: user reviews changes before/after.
 *
 * Usage:
 *   npm run pr:apply -- --bundleId=<id> [--dry-run] [--force]
 *
 * Prerequisite: npx vercel dev (for verification curl steps)
 */

import { readFileSync, existsSync, writeFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { spawnSync } from "child_process";

const PACKAGES_ROOT =
  process.env.PR_PACKAGES_ROOT ?? resolve(process.cwd(), "eval/out/pr-packages");
const CANDIDATE_TAXONOMY_PATH = "eval/fixtures/replay/knowledge/candidate-taxonomy.json";

function parseArgs(): { bundleId: string; dryRun: boolean; force: boolean } {
  const args = process.argv.slice(2);
  let bundleId = "";
  let dryRun = false;
  let force = false;
  for (const arg of args) {
    if (arg.startsWith("--bundleId=")) {
      bundleId = arg.slice("--bundleId=".length).trim();
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--force") {
      force = true;
    }
  }
  return { bundleId, dryRun, force };
}

function findRepoRoot(): string {
  const cwd = process.cwd();
  let dir = cwd;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "eval"))) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return cwd;
}

function main(): void {
  const opts = parseArgs();

  if (!opts.bundleId) {
    console.error("Missing --bundleId=<id>");
    process.exit(1);
  }

  const bundleDir = join(PACKAGES_ROOT, opts.bundleId);
  if (!existsSync(bundleDir)) {
    console.error(`Bundle folder missing: ${bundleDir}`);
    process.exit(1);
  }

  const patchesDir = join(bundleDir, "patches");
  const proposedTaxonomyPath = join(bundleDir, "proposed-taxonomy.json");
  const packagerMdPath = join(bundleDir, "PACKAGER.md");

  if (!existsSync(patchesDir)) {
    console.error(`Patches folder missing: ${patchesDir}`);
    process.exit(1);
  }

  const diffFiles = readdirSync(patchesDir)
    .filter((f) => f.endsWith(".diff"))
    .sort();

  if (diffFiles.length === 0) {
    console.error(`No .diff files in ${patchesDir}`);
    process.exit(1);
  }

  if (!existsSync(proposedTaxonomyPath)) {
    console.error(`proposed-taxonomy.json missing: ${proposedTaxonomyPath}`);
    process.exit(1);
  }

  if (!existsSync(packagerMdPath)) {
    console.error(`PACKAGER.md missing: ${packagerMdPath}`);
    process.exit(1);
  }

  const proposedTaxonomy = JSON.parse(readFileSync(proposedTaxonomyPath, "utf-8")) as {
    version?: string;
  };
  const promotedVersion = proposedTaxonomy.version ?? "unknown";

  if (opts.dryRun) {
    console.log("=== PR Apply (Dry Run) ===\n");
    console.log("Bundle ID:", opts.bundleId);
    console.log("Promoted taxonomy version:", promotedVersion);
    console.log("Diffs that would be applied:");
    for (const f of diffFiles) {
      console.log("  -", join("patches", f));
    }
    console.log("\nTarget:", CANDIDATE_TAXONOMY_PATH);
    console.log("\nNo changes made. Remove --dry-run to apply.");
    process.exit(0);
  }

  const repoRoot = findRepoRoot();
  const gitResult = spawnSync("git", ["status", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf-8",
  });

  if (gitResult.status !== 0) {
    console.error("git status failed");
    process.exit(1);
  }

  const hasChanges = gitResult.stdout.trim().length > 0;
  if (hasChanges && !opts.force) {
    console.error("Working tree is dirty. Commit or stash changes first, or use --force.");
    process.exit(1);
  }

  const targetPath = join(repoRoot, CANDIDATE_TAXONOMY_PATH);
  const content = readFileSync(proposedTaxonomyPath, "utf-8");
  writeFileSync(targetPath, content, "utf-8");

  console.log("=== PR Apply ===\n");
  console.log("Applied:", CANDIDATE_TAXONOMY_PATH);
  console.log("Promoted version:", promotedVersion);
  console.log("\nNext: Update api/_lib/inference/allergenTaxonomy.ts (ALLERGEN_TAXONOMY_VERSION, taxonomy).");
  console.log("Then run verification: see eval/VERIFY_PROMOTION.md");
}

main();
