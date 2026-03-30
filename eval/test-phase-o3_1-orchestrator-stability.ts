/**
 * Phase O3.1 – Orchestrator Stability Tests
 *
 * Verifies graceful failure, empty states, error states, fetch helpers,
 * OrchestratorPageState, and left rail fallbacks.
 */

import * as fs from "fs";
import * as path from "path";

const SRC = path.join(process.cwd(), "src");
const API = path.join(process.cwd(), "api");

function assert(condition: boolean, message: string): boolean {
  if (condition) {
    console.log(`✓ ${message}`);
    return true;
  }
  console.error(`✗ ${message}`);
  return false;
}

function runTests(): number {
  let passed = 0;
  let failed = 0;

  console.log("\n--- Phase O3.1: Orchestrator Stability ---\n");

  // fetchOrchestratorData
  const fetchPath = path.join(SRC, "orchestrator", "lib", "fetchOrchestratorData.ts");
  if (assert(fs.existsSync(fetchPath), "fetchOrchestratorData.ts exists")) passed++;
  else failed++;

  const fetchContent = fs.readFileSync(fetchPath, "utf-8");
  if (assert(fetchContent.includes("OrchestratorFetchResult"), "OrchestratorFetchResult type")) passed++;
  else failed++;
  if (assert(fetchContent.includes("fetchRadarEntities"), "fetchRadarEntities")) passed++;
  else failed++;
  if (assert(fetchContent.includes("fetchRadarCombinations"), "fetchRadarCombinations")) passed++;
  else failed++;
  if (assert(fetchContent.includes("fetchRegistryEntries"), "fetchRegistryEntries")) passed++;
  else failed++;
  if (assert(fetchContent.includes("fetchIngestionCandidates"), "fetchIngestionCandidates")) passed++;
  else failed++;
  if (assert(fetchContent.includes("ok: true") && fetchContent.includes("ok: false"), "Normalized result shape")) passed++;
  else failed++;

  // OrchestratorPageState
  const pageStatePath = path.join(SRC, "orchestrator", "components", "OrchestratorPageState.tsx");
  if (assert(fs.existsSync(pageStatePath), "OrchestratorPageState exists")) passed++;
  else failed++;

  const pageStateContent = fs.readFileSync(pageStatePath, "utf-8");
  if (assert(pageStateContent.includes("loading") && pageStateContent.includes("error"), "PageState loading/error")) passed++;
  else failed++;
  if (assert(pageStateContent.includes("empty"), "PageState empty")) passed++;
  else failed++;
  if (assert(pageStateContent.includes("Unable to load"), "Error panel copy")) passed++;
  else failed++;
  if (assert(pageStateContent.includes("Retry"), "Retry action")) passed++;
  else failed++;

  // Radar workbench: queue fetches in SignalRadarPanel; center page uses OrchestratorPageState
  const radarPageContent = fs.readFileSync(path.join(SRC, "pages", "AdminUnmappedPage.tsx"), "utf-8");
  const signalPanelFetchContent = fs.readFileSync(
    path.join(SRC, "orchestrator", "components", "SignalRadarPanel.tsx"),
    "utf-8"
  );
  if (assert(signalPanelFetchContent.includes("fetchRadarEntities"), "Signal queue uses fetchRadarEntities")) passed++;
  else failed++;
  if (assert(radarPageContent.includes("OrchestratorPageState"), "Radar page uses OrchestratorPageState")) passed++;
  else failed++;

  // Registry page
  const registryContent = fs.readFileSync(path.join(SRC, "pages", "AdminRegistryPage.tsx"), "utf-8");
  if (assert(registryContent.includes("fetchRegistryEntries") || registryContent.includes("fetchRegistrySearch"), "Registry uses fetch helpers")) passed++;
  else failed++;
  if (assert(registryContent.includes("OrchestratorPageState"), "Registry uses OrchestratorPageState")) passed++;
  else failed++;

  // Ingestion page
  const ingestionContent = fs.readFileSync(path.join(SRC, "pages", "AdminIngestionPage.tsx"), "utf-8");
  if (assert(ingestionContent.includes("fetchIngestionCandidates"), "Ingestion uses fetchIngestionCandidates")) passed++;
  else failed++;
  if (assert(ingestionContent.includes("OrchestratorPageState"), "Ingestion uses OrchestratorPageState")) passed++;
  else failed++;
  if (assert(ingestionContent.includes("No ingestion candidates yet"), "Ingestion empty message")) passed++;
  else failed++;

  // SignalRadarPanel fallback on summary failure
  const panelContent = fs.readFileSync(path.join(SRC, "orchestrator", "components", "SignalRadarPanel.tsx"), "utf-8");
  if (assert(panelContent.includes("summaryFailed") || panelContent.includes("FallbackSectionPlaceholder"), "SignalRadarPanel fallback on failure")) passed++;
  else failed++;
  if (assert(panelContent.includes("unavailable"), "Fallback unavailable copy")) passed++;
  else failed++;

  // orchestratorSummary returns result type
  const summaryContent = fs.readFileSync(path.join(SRC, "orchestrator", "lib", "orchestratorSummary.ts"), "utf-8");
  if (assert(summaryContent.includes("OrchestratorSummaryResult") || summaryContent.includes("ok: false"), "Summary handles failure")) passed++;
  else failed++;

  // Backend admin API hardening
  const adminContent = fs.readFileSync(path.join(API, "admin.ts"), "utf-8");
  if (assert(adminContent.includes("isMissingTable"), "Backend isMissingTable helper")) passed++;
  else failed++;
  if (assert(adminContent.includes("Radar data unavailable") || adminContent.includes("Ingestion data unavailable"), "Backend structured error messages")) passed++;
  else failed++;
  if (assert(adminContent.includes("[Admin API]"), "Backend improved logging")) passed++;
  else failed++;

  console.log("\n--- Summary ---");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  return failed;
}

async function main() {
  const failed = runTests();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
