/**
 * Phase O1 – Orchestrator Shell Tests
 *
 * Verifies route structure, shell presence, theme isolation.
 * Uses tsx for structural checks; vitest for render tests.
 */

import * as fs from "fs";
import * as path from "path";

const SRC = path.join(process.cwd(), "src");

function assert(condition: boolean, message: string): boolean {
  if (condition) {
    console.log(`✓ ${message}`);
    return true;
  }
  console.error(`✗ ${message}`);
  return false;
}

function runStructuralTests(): number {
  let passed = 0;
  let failed = 0;

  console.log("\n--- Phase O1: Orchestrator Structure ---\n");

  // Orchestrator folder structure
  const orchDir = path.join(SRC, "orchestrator");
  if (assert(fs.existsSync(orchDir), "src/orchestrator exists")) passed++;
  else failed++;

  const requiredDirs = ["pages", "components", "theme", "assets", "layout"];
  for (const d of requiredDirs) {
    const p = path.join(orchDir, d);
    if (assert(fs.existsSync(p), `orchestrator/${d} exists`)) passed++;
    else failed++;
  }

  // Theme
  const themeFile = path.join(orchDir, "theme", "OrchestratorThemeProvider.tsx");
  if (assert(fs.existsSync(themeFile), "OrchestratorThemeProvider exists")) passed++;
  else failed++;

  const themeTokens = path.join(orchDir, "theme", "orchestratorTheme.ts");
  if (assert(fs.existsSync(themeTokens), "orchestratorTheme.ts exists")) passed++;
  else failed++;

  // Shell components
  const shellComponents = [
    "CommandBar",
    "SignalRadarPanel",
    "ContextPanel",
    "ActivityStream",
    "SignalCard",
  ];
  for (const c of shellComponents) {
    const p = path.join(orchDir, "components", `${c}.tsx`);
    if (assert(fs.existsSync(p), `Orchestrator component ${c} exists`)) passed++;
    else failed++;
  }

  const shellLayout = path.join(orchDir, "layout", "OrchestratorShell.tsx");
  if (assert(fs.existsSync(shellLayout), "OrchestratorShell exists")) passed++;
  else failed++;

  // Orchestrator pages
  const pages = ["ResearchWorkspacePage", "GovernancePage", "ActivityPage"];
  for (const p of pages) {
    const fp = path.join(orchDir, "pages", `${p}.tsx`);
    if (assert(fs.existsSync(fp), `Orchestrator page ${p} exists`)) passed++;
    else failed++;
  }

  // App.tsx uses OrchestratorThemeProvider and OrchestratorShell
  const appTsx = fs.readFileSync(path.join(SRC, "App.tsx"), "utf-8");
  if (assert(appTsx.includes("OrchestratorThemeProvider"), "App uses OrchestratorThemeProvider")) passed++;
  else failed++;
  if (assert(appTsx.includes("OrchestratorShell"), "App uses OrchestratorShell")) passed++;
  else failed++;
  if (assert(appTsx.includes("/orchestrator/radar"), "App has /orchestrator/radar route")) passed++;
  else failed++;
  if (assert(appTsx.includes("/orchestrator/registry"), "App has /orchestrator/registry route")) passed++;
  else failed++;
  if (assert(appTsx.includes("/orchestrator/ingestion"), "App has /orchestrator/ingestion route")) passed++;
  else failed++;
  if (assert(appTsx.includes("admin/unmapped") && appTsx.includes("Navigate"), "App redirects /admin/unmapped")) passed++;
  else failed++;

  // No AA route uses OrchestratorShell (admin routes are under orchestrator)
  if (assert(!appTsx.includes('path="admin/unmapped"') || appTsx.includes("Navigate"), "Admin routes redirect to orchestrator")) passed++;
  else failed++;

  const appShell = fs.readFileSync(path.join(SRC, "components", "layout", "AppShell.tsx"), "utf-8");
  if (assert(!appShell.includes("orchestrator") && !appShell.includes("Orchestrator"), "AppShell does not reference Orchestrator")) passed++;
  else failed++;

  console.log("\n--- Summary ---");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  return failed;
}

async function main() {
  const failed = runStructuralTests();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
