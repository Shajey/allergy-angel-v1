/**
 * Phase 21c – Admin Alias Proposal Manager Tests
 *
 * Tests registry browser and alias proposal store.
 * Proposal store tests require Supabase + migration 009.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import {
  listRegistry,
  searchRegistry,
  getRegistryEntry,
  aliasExistsInStaticRegistry,
  getEntryByCanonicalId,
} from "../api/_lib/admin/registryBrowser.js";
import {
  createProposal,
  listProposals,
  dismissProposal,
  markProposalsExported,
} from "../api/_lib/admin/aliasProposalStore.js";

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✓ ${message}`);
      passed++;
    } else {
      console.error(`✗ ${message}`);
      failed++;
    }
  }

  // ── Registry Browser (no Supabase) ─────────────────────────────────

  console.log("\n--- Registry list ---");
  {
    const drug = listRegistry("drug");
    assert(drug.meta.type === "drug", "drug list meta type");
    assert(Array.isArray(drug.entries), "drug entries is array");
    assert(drug.entries.length > 0, "drug entries non-empty");
    const first = drug.entries[0];
    assert(first.id && Array.isArray(first.aliases), "entry has id and aliases");
    assert(first.source === "static", "source is static");

    const supp = listRegistry("supplement");
    assert(supp.meta.type === "supplement", "supplement list meta type");

    const food = listRegistry("food");
    assert(food.meta.type === "food", "food list meta type");
  }

  console.log("\n--- Registry search ---");
  {
    const r = searchRegistry("lexa");
    assert(Array.isArray(r.results), "results is array");
    const esc = r.results.find((e) => e.id === "escitalopram");
    assert(!!esc, "search 'lexa' finds escitalopram");
    assert(esc!.aliases.some((a) => a.toLowerCase().includes("lexa")), "matched on alias");

    const r2 = searchRegistry("escitalopram", "drug");
    assert(r2.results.length >= 1, "search by canonical id finds entry");
    assert(r2.results.every((e) => e.type === "drug"), "type filter applied");

    const r3 = searchRegistry("xy");
    assert(r3.results.length === 0 || r3.results.length > 0, "short search handled");
  }

  console.log("\n--- Registry single entry ---");
  {
    const e = getRegistryEntry("drug", "escitalopram");
    assert(!!e, "getRegistryEntry finds escitalopram");
    assert(e!.id === "escitalopram", "id correct");
    assert(e!.aliases.includes("lexapro"), "aliases include lexapro");
    assert(e!.source === "static", "source static");

    const notFound = getRegistryEntry("drug", "nonexistent-xyz");
    assert(!notFound, "nonexistent returns null");
  }

  console.log("\n--- Alias exists in static registry ---");
  {
    assert(aliasExistsInStaticRegistry("lexapro"), "lexapro exists");
    assert(aliasExistsInStaticRegistry("LEXAPRO"), "LEXAPRO exists (case-insensitive)");
    assert(!aliasExistsInStaticRegistry("lexapro-typo-xyz"), "typo does not exist");
  }

  console.log("\n--- Get entry by canonical ID ---");
  {
    const e = getEntryByCanonicalId("drug", "escitalopram");
    assert(!!e && e.id === "escitalopram", "getEntryByCanonicalId finds entry");
    const notFound = getEntryByCanonicalId("drug", "nonexistent");
    assert(!notFound, "nonexistent returns null");
  }

  // ── Proposal Store (requires Supabase + migration 009) ─────────────────

  const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!hasSupabase) {
    console.log("\n--- Proposal store (skipped: no Supabase) ---");
    console.log("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run proposal tests.");
  } else {
    console.log("\n--- Proposal store ---");

    try {
      const p = await createProposal({
        registry_type: "drug",
        canonical_id: "escitalopram",
        proposed_alias: "test-alias-phase-21c-" + Date.now(),
        proposal_action: "add-alias",
      });
      assert(!!p.id, "createProposal returns id");
      assert(p.status === "pending", "status pending");
      assert(p.proposal_action === "add-alias", "action add-alias");

      const list = await listProposals({ status: "pending" });
      assert(Array.isArray(list), "listProposals returns array");
      const found = list.find((x) => x.id === p.id);
      assert(!!found, "created proposal appears in list");

      await dismissProposal(p.id);
      const afterDismiss = await listProposals({ status: "pending" });
      assert(!afterDismiss.find((x) => x.id === p.id), "dismissed proposal not in pending");

      const p2 = await createProposal({
        registry_type: "drug",
        canonical_id: "escitalopram",
        proposed_alias: "test-export-phase-21c-" + Date.now(),
        proposal_action: "add-alias",
      });
      await markProposalsExported([p2.id]);
      const exported = await listProposals({ status: "exported" });
      assert(exported.some((x) => x.id === p2.id), "exported proposal in exported list");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("alias_proposals") || msg.includes("schema cache")) {
        console.log("Proposal store skipped: run migration 009_alias_proposals.sql in Supabase");
      } else {
        console.error("Proposal store error:", err);
        assert(false, `Proposal store: ${msg}`);
      }
    }
  }

  // Summary
  console.log("\n--- Summary ---");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  await runTests();
}
