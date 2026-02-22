#!/usr/bin/env node
/**
 * Phase 12.3 – Promotion PR Packager CLI
 *
 * Reads a promotion export JSON, applies selected terms as taxonomy edits,
 * and writes a PR-ready bundle to eval/out/promo-packages/<bundleId>/.
 *
 * Usage:
 *   npm run promo:pack -- --export=promo-12_1-export.json --select=mango --mode=crossReactive --parent=tree_nut
 */

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadAllergenTaxonomy } from "../api/_lib/knowledge/loadAllergenTaxonomy.js";
import {
  validateInputs,
  buildPromoBundle,
  type PromoMode,
  type PromoExportShape,
} from "../api/_lib/admin/promoPackager.js";

const DEFAULT_OUT = resolve(process.cwd(), "eval/out/promo-packages");

function parseArgs(): {
  exportPath: string;
  selectedTerms: string[];
  mode: PromoMode;
  parent: string;
  taxonomyPath?: string;
  outRoot: string;
} {
  const args = process.argv.slice(2);
  let exportPath = "";
  let selectedTerms: string[] = [];
  let mode: PromoMode = "crossReactive";
  let parent = "";
  let taxonomyPath: string | undefined;
  let outRoot = DEFAULT_OUT;

  for (const arg of args) {
    if (arg.startsWith("--export=")) {
      exportPath = resolve(process.cwd(), arg.slice(9));
    } else if (arg.startsWith("--select=")) {
      selectedTerms = arg.slice(9).split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg.startsWith("--mode=")) {
      const m = arg.slice(7);
      if (m === "crossReactive" || m === "child") mode = m;
      else {
        console.error(`Invalid mode: ${m}. Must be crossReactive or child.`);
        process.exit(1);
      }
    } else if (arg.startsWith("--parent=")) {
      parent = arg.slice(9).trim();
    } else if (arg.startsWith("--taxonomyPath=")) {
      taxonomyPath = resolve(process.cwd(), arg.slice(15));
    } else if (arg.startsWith("--out=")) {
      outRoot = resolve(process.cwd(), arg.slice(6));
    }
  }

  if (!exportPath) {
    console.error("Missing --export=<path> argument.");
    process.exit(1);
  }
  if (selectedTerms.length === 0) {
    console.error("Missing --select=<term1,term2,...> argument.");
    process.exit(1);
  }
  if (!parent) {
    console.error("Missing --parent=<parent_key> argument.");
    process.exit(1);
  }

  return { exportPath, selectedTerms, mode, parent, taxonomyPath, outRoot };
}

function main(): void {
  const opts = parseArgs();

  let exportRaw: string;
  try {
    exportRaw = readFileSync(opts.exportPath, "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to read export file: ${msg}`);
    process.exit(1);
  }

  let exportJson: PromoExportShape;
  try {
    exportJson = JSON.parse(exportRaw) as PromoExportShape;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Invalid JSON in export file: ${msg}`);
    process.exit(1);
  }

  const currentTaxonomy = loadAllergenTaxonomy(opts.taxonomyPath);

  const input = {
    exportJson,
    selectedTerms: opts.selectedTerms,
    mode: opts.mode,
    parent: opts.parent,
    currentTaxonomy,
  };

  const errors = validateInputs(input);
  if (errors.length > 0) {
    console.error("Validation errors:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const bundle = buildPromoBundle(input);

  const bundleDir = resolve(opts.outRoot, bundle.bundleId);
  mkdirSync(bundleDir, { recursive: true });

  writeFileSync(
    resolve(bundleDir, "proposed-taxonomy.json"),
    JSON.stringify(bundle.proposedTaxonomy, null, 2) + "\n",
    "utf-8"
  );

  writeFileSync(
    resolve(bundleDir, "scenario-stubs.json"),
    JSON.stringify(bundle.scenarioStubs, null, 2) + "\n",
    "utf-8"
  );

  writeFileSync(
    resolve(bundleDir, "allowlist-fingerprints.json"),
    JSON.stringify(bundle.allowlistFingerprints, null, 2) + "\n",
    "utf-8"
  );

  writeFileSync(resolve(bundleDir, "CHECKLIST.md"), bundle.checklist, "utf-8");

  console.log(`\n=== Promotion PR Package ===\n`);
  console.log(`Bundle ID:  ${bundle.bundleId}`);
  console.log(`Version:    ${currentTaxonomy.version} → ${bundle.bumpedVersion}`);
  console.log(`Mode:       ${opts.mode}`);
  console.log(`Parent:     ${opts.parent}`);
  console.log(`Terms:      ${opts.selectedTerms.join(", ")}`);
  console.log(`Output:     ${bundleDir}/`);
  console.log(`\nFiles in bundle:`);
  console.log(`  proposed-taxonomy.json`);
  console.log(`  scenario-stubs.json`);
  console.log(`  allowlist-fingerprints.json`);
  console.log(`  CHECKLIST.md`);
  console.log(`\nReview the bundle, then apply edits and run validation.\n`);
}

main();
