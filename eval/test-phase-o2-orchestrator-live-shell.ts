/**
 * Phase O2 – Orchestrator Live Shell Tests
 *
 * Verifies Signal Radar, Activity feed, active tab, route wiring.
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

  console.log("\n--- Phase O2: Orchestrator Live Shell ---\n");

  // orchestratorSummary
  const summaryPath = path.join(SRC, "orchestrator", "lib", "orchestratorSummary.ts");
  if (assert(fs.existsSync(summaryPath), "orchestratorSummary.ts exists")) passed++;
  else failed++;

  const summaryContent = fs.readFileSync(summaryPath, "utf-8");
  if (assert(summaryContent.includes("loadOrchestratorSummary"), "loadOrchestratorSummary exported")) passed++;
  else failed++;
  if (assert(summaryContent.includes("emergingSignals"), "emergingSignals in summary")) passed++;
  else failed++;
  if (assert(summaryContent.includes("unknownEntities"), "unknownEntities in summary")) passed++;
  else failed++;
  if (assert(summaryContent.includes("governanceQueue"), "governanceQueue in summary")) passed++;
  else failed++;

  // SignalRadarPanel sections
  const panelPath = path.join(SRC, "orchestrator", "components", "SignalRadarPanel.tsx");
  const panelContent = fs.readFileSync(panelPath, "utf-8");
  if (assert(panelContent.includes("Emerging Signals"), "Signal Radar has Emerging Signals section")) passed++;
  else failed++;
  if (assert(panelContent.includes("Unknown Entities"), "Signal Radar has Unknown Entities section")) passed++;
  else failed++;
  if (assert(panelContent.includes("Governance Queue"), "Signal Radar has Governance Queue section")) passed++;
  else failed++;
  if (assert(panelContent.includes("SignalCard"), "Signal Radar uses SignalCard")) passed++;
  else failed++;

  // SignalCard link support
  const cardPath = path.join(SRC, "orchestrator", "components", "SignalCard.tsx");
  const cardContent = fs.readFileSync(cardPath, "utf-8");
  if (assert(cardContent.includes("linkTo"), "SignalCard supports linkTo")) passed++;
  else failed++;
  if (assert(cardContent.includes("searchParam"), "SignalCard supports searchParam")) passed++;
  else failed++;
  if (assert(cardContent.includes("Link"), "SignalCard uses Link for routing")) passed++;
  else failed++;

  // Activity feed
  const activityFeedPath = path.join(SRC, "orchestrator", "lib", "activityFeed.ts");
  if (assert(fs.existsSync(activityFeedPath), "activityFeed.ts exists")) passed++;
  else failed++;

  const activityPagePath = path.join(SRC, "orchestrator", "pages", "ActivityPage.tsx");
  const activityPageContent = fs.readFileSync(activityPagePath, "utf-8");
  if (assert(activityPageContent.includes("ActivityFeedList"), "Activity page uses ActivityFeedList")) passed++;
  else failed++;
  if (assert(activityPageContent.includes("loadActivityFeed"), "Activity page loads activity feed")) passed++;
  else failed++;

  // CommandBar active state
  const commandBarPath = path.join(SRC, "orchestrator", "components", "CommandBar.tsx");
  const commandBarContent = fs.readFileSync(commandBarPath, "utf-8");
  if (assert(commandBarContent.includes("rounded-full"), "CommandBar uses rounded pill for tabs")) passed++;
  else failed++;
  if (assert(commandBarContent.includes("Governed Safety Intelligence"), "CommandBar has identity subtitle")) passed++;
  else failed++;

  // Context Panel structure
  const contextPath = path.join(SRC, "orchestrator", "components", "ContextPanel.tsx");
  const contextContent = fs.readFileSync(contextPath, "utf-8");
  if (assert(contextContent.includes("Registry"), "Context Panel has Registry block")) passed++;
  else failed++;
  if (assert(contextContent.includes("Source"), "Context Panel has Source block")) passed++;
  else failed++;
  if (assert(contextContent.includes("Governance"), "Context Panel has Governance block")) passed++;
  else failed++;

  // Route links in SignalRadarPanel
  if (assert(panelContent.includes("/orchestrator/radar"), "Signal cards link to radar")) passed++;
  else failed++;
  if (assert(panelContent.includes("/orchestrator/registry"), "Signal cards link to registry")) passed++;
  else failed++;
  if (assert(panelContent.includes("/orchestrator/ingestion"), "Signal cards link to ingestion")) passed++;
  else failed++;

  // No AA contamination
  const appShellPath = path.join(SRC, "components", "layout", "AppShell.tsx");
  const appShellContent = fs.readFileSync(appShellPath, "utf-8");
  if (assert(!appShellContent.includes("SignalRadarPanel"), "AppShell does not use Orchestrator components")) passed++;
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
