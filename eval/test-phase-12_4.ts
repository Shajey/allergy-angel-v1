/**
 * Phase 12.4 – Apply PR Package Tests
 *
 * - dry-run prints plan and exits 0
 * - fails if bundle folder missing
 * - fails if patches missing
 * - determinism: no timestamps, stable output ordering
 */

import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { resolve, join } from "path";
import { spawnSync } from "child_process";

const TEST_PACKAGES = resolve(process.cwd(), "eval/out/pr-packages-test-12_4");
const APPLY_SCRIPT = resolve(process.cwd(), "eval/apply-pr-package.ts");

function runApply(
  args: string[],
  packagesRoot?: string
): { stdout: string; stderr: string; status: number | null } {
  const env = packagesRoot
    ? { ...process.env, PR_PACKAGES_ROOT: packagesRoot }
    : process.env;
  const result = spawnSync("npx", ["tsx", APPLY_SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: "utf-8",
    env,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

function setupTestBundle(): string {
  if (existsSync(TEST_PACKAGES)) rmSync(TEST_PACKAGES, { recursive: true });
  mkdirSync(join(TEST_PACKAGES, "valid-bundle/patches"), { recursive: true });
  writeFileSync(
    join(TEST_PACKAGES, "valid-bundle/proposed-taxonomy.json"),
    JSON.stringify({ version: "10i.3", taxonomy: {} }) + "\n",
    "utf-8"
  );
  writeFileSync(join(TEST_PACKAGES, "valid-bundle/PACKAGER.md"), "# Test\n", "utf-8");
  writeFileSync(join(TEST_PACKAGES, "valid-bundle/patches/taxonomy.diff"), "--- a/x\n+++ b/x\n", "utf-8");
  writeFileSync(join(TEST_PACKAGES, "valid-bundle/patches/registry.diff"), "--- a/y\n+++ b/y\n", "utf-8");
  return join(TEST_PACKAGES, "valid-bundle");
}

function runTests(): void {
  let passed = 0;
  let failed = 0;

  // Use default packages root with existing bundle for dry-run
  const existingBundleId = "2da70a44fb97";
  const defaultPackages = resolve(process.cwd(), "eval/out/pr-packages");

  // ── 1) dry-run prints plan and exits 0 ─────────────────────────────────
  const r1 = runApply([`--bundleId=${existingBundleId}`, "--dry-run"]);
  if (r1.status !== 0) {
    failed++;
    console.error(`✗ dry-run should exit 0; got ${r1.status}`);
  } else {
    passed++;
    console.log("✓ dry-run exits 0");
  }
  if (!r1.stdout.includes("Dry Run") || !r1.stdout.includes("Promoted taxonomy version")) {
    failed++;
    console.error("✗ dry-run should print plan with version");
  } else {
    passed++;
    console.log("✓ dry-run prints plan");
  }

  // ── 2) fails if bundle folder missing ────────────────────────────────────
  const r2 = runApply(["--bundleId=nonexistent-bundle-12345"]);
  if (r2.status === 0) {
    failed++;
    console.error("✗ should fail when bundle missing");
  } else {
    passed++;
    console.log("✓ fails if bundle folder missing");
  }

  // ── 3) fails if patches missing ───────────────────────────────────────
  const bundlePath = setupTestBundle();
  mkdirSync(join(TEST_PACKAGES, "no-patches"), { recursive: true });
  writeFileSync(join(TEST_PACKAGES, "no-patches/proposed-taxonomy.json"), "{}", "utf-8");
  writeFileSync(join(TEST_PACKAGES, "no-patches/PACKAGER.md"), "# Test\n", "utf-8");
  mkdirSync(join(TEST_PACKAGES, "no-patches/patches"), { recursive: true });
  // patches/ is empty - no .diff files
  const r3 = runApply(["--bundleId=no-patches"], TEST_PACKAGES);
  if (r3.status === 0) {
    failed++;
    console.error("✗ should fail when patches missing");
  } else {
    passed++;
    console.log("✓ fails if patches missing");
  }

  // ── 4) determinism: stable output ordering, no timestamps ───────────────
  const r4a = runApply([`--bundleId=${existingBundleId}`, "--dry-run"]);
  const r4b = runApply([`--bundleId=${existingBundleId}`, "--dry-run"]);
  if (r4a.stdout !== r4b.stdout) {
    failed++;
    console.error("✗ determinism: two dry-runs should produce identical output");
  } else {
    passed++;
    console.log("✓ determinism: stable output");
  }
  if (r4a.stdout.match(/\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}|timestamp/i)) {
    failed++;
    console.error("✗ output should not contain timestamps");
  } else {
    passed++;
    console.log("✓ no timestamps in output");
  }

  // Cleanup
  if (existsSync(TEST_PACKAGES)) rmSync(TEST_PACKAGES, { recursive: true });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
