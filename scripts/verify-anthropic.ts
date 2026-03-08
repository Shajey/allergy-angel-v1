#!/usr/bin/env npx tsx
/**
 * Verify Anthropic API key by calling the research entity endpoint.
 * Run: npx tsx scripts/verify-anthropic.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY in .env.local");
    process.exit(1);
  }

  console.log("Verifying Anthropic API key via research-entity (ashwagandha)...\n");

  try {
    const { createAnthropicProvider } = await import("../api/_lib/research/researchProvider.js");
    const { researchEntity } = await import("../api/_lib/research/researchService.js");

    const provider = await createAnthropicProvider();
    const outcome = await researchEntity(provider, {
      entity: "ashwagandha",
      entityType: "supplement",
      forceResearch: true,
    });

    if (!outcome.success) {
      console.error("Research failed:", outcome.error?.message ?? "Unknown error");
      if (outcome.error?.details) {
        console.error("Details:", outcome.error.details);
      }
      process.exit(1);
    }

    console.log("OK: Anthropic API key is valid.\n");
    console.log("Result (excerpt):");
    const result = outcome.result;
    if (result?.research?.identity) {
      console.log("  canonicalName:", result.research.identity.canonicalName);
      console.log("  category:", result.research.identity.category);
      console.log("  description:", (result.research.identity.description ?? "").slice(0, 80) + "...");
    }
    if (result?.proposal?.proposalType) {
      console.log("  proposalType:", result.proposal.proposalType);
    }
    console.log("\nFull result:", JSON.stringify(result, null, 2).slice(0, 500) + "...");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error:", msg);
    if (msg.includes("Invalid API key") || msg.includes("401") || msg.includes("authentication")) {
      console.error("\nYour ANTHROPIC_API_KEY may be invalid or expired. Check https://console.anthropic.com/");
    } else if (msg.includes("credit balance") || msg.includes("too low")) {
      console.error("\nAPI key is valid, but your Anthropic account has insufficient credits.");
      console.error("Add credits at https://console.anthropic.com/ → Plans & Billing");
    }
    process.exit(1);
  }
}

main();
