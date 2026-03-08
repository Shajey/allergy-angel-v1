/**
 * Phase O3 – Context Workflow Tests
 *
 * Verifies selection context, Context Panel, quick actions.
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

function runTests(): number {
  let passed = 0;
  let failed = 0;

  console.log("\n--- Phase O3: Context Workflow ---\n");

  // OrchestratorSelectionContext
  const ctxPath = path.join(SRC, "orchestrator", "context", "OrchestratorSelectionContext.tsx");
  if (assert(fs.existsSync(ctxPath), "OrchestratorSelectionContext exists")) passed++;
  else failed++;

  const ctxContent = fs.readFileSync(ctxPath, "utf-8");
  if (assert(ctxContent.includes("OrchestratorSelection"), "Selection types defined")) passed++;
  else failed++;
  if (assert(ctxContent.includes("unknown-entity"), "unknown-entity kind")) passed++;
  else failed++;
  if (assert(ctxContent.includes("interaction-gap"), "interaction-gap kind")) passed++;
  else failed++;
  if (assert(ctxContent.includes("ingestion-candidate"), "ingestion-candidate kind")) passed++;
  else failed++;
  if (assert(ctxContent.includes("registry-entity"), "registry-entity kind")) passed++;
  else failed++;
  if (assert(ctxContent.includes("activity"), "activity kind")) passed++;
  else failed++;
  if (assert(ctxContent.includes("useOptionalOrchestratorSelection"), "Optional hook for admin pages")) passed++;
  else failed++;

  // Context components
  const contextSectionPath = path.join(SRC, "orchestrator", "components", "context", "ContextSection.tsx");
  if (assert(fs.existsSync(contextSectionPath), "ContextSection exists")) passed++;
  else failed++;

  const quickActionsPath = path.join(SRC, "orchestrator", "components", "context", "QuickActionsCard.tsx");
  if (assert(fs.existsSync(quickActionsPath), "QuickActionsCard exists")) passed++;
  else failed++;

  const quickActionsContent = fs.readFileSync(quickActionsPath, "utf-8");
  if (assert(quickActionsContent.includes("Link"), "QuickActionsCard has Link")) passed++;
  else failed++;
  if (assert(quickActionsContent.includes("to="), "QuickActionsCard has route links")) passed++;
  else failed++;

  // ContextPanel
  const panelPath = path.join(SRC, "orchestrator", "components", "ContextPanel.tsx");
  const panelContent = fs.readFileSync(panelPath, "utf-8");
  if (assert(panelContent.includes("EmptyState"), "Context Panel has empty state")) passed++;
  else failed++;
  if (assert(panelContent.includes("No item selected"), "Empty state copy")) passed++;
  else failed++;
  if (assert(panelContent.includes("UnknownEntityContext"), "Unknown entity context block")) passed++;
  else failed++;
  if (assert(panelContent.includes("InteractionGapContext"), "Interaction gap context block")) passed++;
  else failed++;
  if (assert(panelContent.includes("IngestionCandidateContext"), "Ingestion candidate context block")) passed++;
  else failed++;
  if (assert(panelContent.includes("RegistryEntityContext"), "Registry entity context block")) passed++;
  else failed++;
  if (assert(panelContent.includes("ActivityContext"), "Activity context block")) passed++;
  else failed++;
  if (panelContent.includes("/orchestrator/registry") && panelContent.includes("/orchestrator/radar")) {
    passed++;
  } else {
    failed++;
    console.error("✗ Quick action links to orchestrator routes");
  }

  // SignalCard selectable
  const cardPath = path.join(SRC, "orchestrator", "components", "SignalCard.tsx");
  const cardContent = fs.readFileSync(cardPath, "utf-8");
  if (assert(cardContent.includes("onSelect"), "SignalCard has onSelect")) passed++;
  else failed++;
  if (assert(cardContent.includes("isSelected"), "SignalCard has isSelected")) passed++;
  else failed++;

  // Shell integration
  const shellPath = path.join(SRC, "orchestrator", "layout", "OrchestratorShell.tsx");
  const shellContent = fs.readFileSync(shellPath, "utf-8");
  if (assert(shellContent.includes("OrchestratorSelectionProvider"), "Shell wraps with selection provider")) passed++;
  else failed++;

  // ActivityStream selectable
  const streamPath = path.join(SRC, "orchestrator", "components", "ActivityStream.tsx");
  const streamContent = fs.readFileSync(streamPath, "utf-8");
  if (assert(streamContent.includes("setSelection"), "ActivityStream uses setSelection")) passed++;
  else failed++;

  // Admin pages use selection
  const unmappedContent = fs.readFileSync(path.join(SRC, "pages", "AdminUnmappedPage.tsx"), "utf-8");
  if (assert(unmappedContent.includes("useOptionalOrchestratorSelection"), "Radar page uses selection")) passed++;
  else failed++;

  const registryContent = fs.readFileSync(path.join(SRC, "pages", "AdminRegistryPage.tsx"), "utf-8");
  if (assert(registryContent.includes("useOptionalOrchestratorSelection"), "Registry page uses selection")) passed++;
  else failed++;

  const ingestionContent = fs.readFileSync(path.join(SRC, "pages", "AdminIngestionPage.tsx"), "utf-8");
  if (assert(ingestionContent.includes("useOptionalOrchestratorSelection"), "Ingestion page uses selection")) passed++;
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
