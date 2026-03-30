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
  if (assert(panelContent.includes("Emerging") && panelContent.includes("Signal Queue"), "Signal Radar has Emerging section + queue header")) passed++;
  else failed++;
  if (assert(panelContent.includes("Active") && panelContent.includes("Signal Queue"), "Signal Radar has Active section")) passed++;
  else failed++;
  if (assert(panelContent.includes("Governance") && panelContent.includes("Signal Queue"), "Signal Radar has Governance section")) passed++;
  else failed++;
  if (assert(panelContent.includes("SignalCard"), "Signal Radar uses SignalCard")) passed++;
  else failed++;

  // O6.4: high-density queue rows (risk bar + subtext + badge; actions in Context panel)
  const cardPath = path.join(SRC, "orchestrator", "components", "SignalCard.tsx");
  const cardContent = fs.readFileSync(cardPath, "utf-8");
  if (assert(cardContent.includes("riskLevel"), "SignalCard has riskLevel")) passed++;
  else failed++;
  if (assert(cardContent.includes("QueueBadge") || cardContent.includes("badge"), "SignalCard supports badge")) passed++;
  else failed++;
  if (assert(cardContent.includes("onSelect"), "SignalCard has onSelect")) passed++;
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
  if (assert(commandBarContent.includes("Signals"), "CommandBar includes Signals route")) passed++;
  else failed++;

  // Context Panel structure
  const contextPath = path.join(SRC, "orchestrator", "components", "ContextPanel.tsx");
  const contextContent = fs.readFileSync(contextPath, "utf-8");
  if (assert(contextContent.includes("Registry"), "Context Panel has Registry block")) passed++;
  else failed++;
  if (assert(contextContent.includes("Identity"), "Context Panel has Identity block (O6.6)")) passed++;
  else failed++;
  if (assert(contextContent.includes("ingestion-candidate"), "Context Panel handles ingestion selection")) passed++;
  else failed++;

  // O6.2: left rail selects into context; registry/research URLs live in ContextPanel / right rail
  if (assert(panelContent.includes("setSelection"), "Signal queue sets orchestrator selection")) passed++;
  else failed++;
  if (assert(panelContent.includes("fetchRadarEntities"), "Signal queue loads radar entities")) passed++;
  else failed++;
  if (assert(contextContent.includes("/orchestrator/registry"), "Context Panel links to registry")) passed++;
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
