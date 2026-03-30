/**
 * Phase O4 – Research Workspace Tests
 *
 * Verifies research workspace page, target summary, output panel, proposal preview,
 * governance warning, and research action links.
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

  console.log("\n--- Phase O4: Research Workspace ---\n");

  // Research workspace route
  const appTsx = fs.readFileSync(path.join(SRC, "App.tsx"), "utf-8");
  if (assert(appTsx.includes('path="research"') || appTsx.includes("/orchestrator/research"), "Research route exists")) passed++;
  else failed++;
  if (assert(appTsx.includes("ResearchWorkspacePage"), "App uses ResearchWorkspacePage")) passed++;
  else failed++;

  // ResearchWorkspacePage
  const pagePath = path.join(SRC, "orchestrator", "pages", "ResearchWorkspacePage.tsx");
  if (assert(fs.existsSync(pagePath), "ResearchWorkspacePage exists")) passed++;
  else failed++;

  const pageContent = fs.readFileSync(pagePath, "utf-8");
  if (assert(pageContent.includes("parseResearchTargetFromSearchParams"), "Page uses query params for target")) passed++;
  else failed++;
  if (assert(pageContent.includes("researchTargetFromSelection"), "Page uses selection for target")) passed++;
  else failed++;
  if (assert(pageContent.includes("No research target selected"), "Empty state copy")) passed++;
  else failed++;
  if (assert(pageContent.includes("Start research"), "Start research action")) passed++;
  else failed++;
  if (assert(pageContent.includes("Force research"), "Force research action")) passed++;
  else failed++;

  // Research components
  const researchDir = path.join(SRC, "orchestrator", "components", "research");
  if (assert(fs.existsSync(researchDir), "research components directory exists")) passed++;
  else failed++;

  const targetSummaryPath = path.join(researchDir, "ResearchTargetSummary.tsx");
  if (assert(fs.existsSync(targetSummaryPath), "ResearchTargetSummary exists")) passed++;
  else failed++;
  const targetSummaryContent = fs.readFileSync(targetSummaryPath, "utf-8");
  if (assert(targetSummaryContent.includes("Unknown entity") || targetSummaryContent.includes("unknown entity"), "Target summary entity target")) passed++;
  else failed++;
  if (assert(targetSummaryContent.includes("Interaction gap") || targetSummaryContent.includes("interaction gap"), "Target summary combination target")) passed++;
  else failed++;

  const outputPanelPath = path.join(researchDir, "ResearchOutputPanel.tsx");
  if (assert(fs.existsSync(outputPanelPath), "ResearchOutputPanel exists")) passed++;
  else failed++;
  const outputPanelContent = fs.readFileSync(outputPanelPath, "utf-8");
  if (assert(outputPanelContent.includes("Research draft") || outputPanelContent.includes("Requires human review"), "Output panel draft identity")) passed++;
  else failed++;
  if (assert(outputPanelContent.includes("identity") || outputPanelContent.includes("canonicalName"), "Output panel entity sections")) passed++;
  else failed++;
  if (assert(outputPanelContent.includes("interactionType") || outputPanelContent.includes("mechanism"), "Output panel combination sections")) passed++;
  else failed++;

  const proposalPreviewPath = path.join(researchDir, "ProposalPreviewPanel.tsx");
  if (assert(fs.existsSync(proposalPreviewPath), "ProposalPreviewPanel exists")) passed++;
  else failed++;
  const proposalPreviewContent = fs.readFileSync(proposalPreviewPath, "utf-8");
  if (assert(proposalPreviewContent.includes("Proposal preview") || proposalPreviewContent.includes("proposal preview"), "Proposal preview header")) passed++;
  else failed++;
  if (assert(proposalPreviewContent.includes("entityDraft") || proposalPreviewContent.includes("relationshipDraft"), "Proposal preview draft fields")) passed++;
  else failed++;
  if (assert(proposalPreviewContent.includes("Requires human review") || proposalPreviewContent.includes("Not verified"), "Proposal preview governance note")) passed++;
  else failed++;

  const layoutPath = path.join(researchDir, "ResearchWorkspaceLayout.tsx");
  if (assert(fs.existsSync(layoutPath), "ResearchWorkspaceLayout exists")) passed++;
  else failed++;
  const layoutContent = fs.readFileSync(layoutPath, "utf-8");
  if (assert(layoutContent.includes("Research Workspace"), "Layout title")) passed++;
  else failed++;
  if (assert(layoutContent.includes("admin-only") || layoutContent.includes("governed proposal flow"), "Governance warning block")) passed++;
  else failed++;

  // researchTarget lib
  const researchTargetPath = path.join(SRC, "orchestrator", "lib", "researchTarget.ts");
  if (assert(fs.existsSync(researchTargetPath), "researchTarget lib exists")) passed++;
  else failed++;
  const researchTargetContent = fs.readFileSync(researchTargetPath, "utf-8");
  if (assert(researchTargetContent.includes("parseResearchTargetFromSearchParams"), "parseResearchTargetFromSearchParams")) passed++;
  else failed++;
  if (assert(researchTargetContent.includes("buildResearchUrl"), "buildResearchUrl")) passed++;
  else failed++;

  // Context Panel research links
  const contextPanelPath = path.join(SRC, "orchestrator", "components", "ContextPanel.tsx");
  const contextPanelContent = fs.readFileSync(contextPanelPath, "utf-8");
  if (assert(contextPanelContent.includes("buildResearchUrl"), "Context Panel uses buildResearchUrl")) passed++;
  else failed++;
  if (assert(contextPanelContent.includes("/orchestrator/research"), "Context Panel links to research")) passed++;
  else failed++;

  // O6.2: center workbench is selection-only; research links remain on Context Panel / right rail
  const unmappedContent = fs.readFileSync(path.join(SRC, "pages", "AdminUnmappedPage.tsx"), "utf-8");
  if (assert(unmappedContent.includes("useOptionalOrchestratorSelection"), "Radar workbench uses selection context")) passed++;
  else failed++;
  if (assert(!unmappedContent.includes("ResearchModal"), "Radar does not use ResearchModal")) passed++;
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
