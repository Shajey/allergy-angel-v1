/**
 * O8 — Promotion export payload includes semantic safety fields.
 */

import { describe, it, expect } from "vitest";
import { buildAliasProposalExportChange } from "@api/_lib/admin/aliasProposalStore.ts";
import type { AliasProposal } from "@api/_lib/admin/aliasProposalStore.ts";

describe("buildAliasProposalExportChange (O8)", () => {
  it("includes type, class, aliases, and riskTags from proposed_entry", () => {
    const p = {
      id: "x",
      registry_type: "food",
      canonical_id: "channa-daal",
      proposed_alias: "channa daal",
      proposal_action: "create-entry" as const,
      status: "pending",
      created_at: "",
      proposed_entry: {
        name: "Channa daal",
        type: "food",
        class: "legume",
        aliases: ["channa daal", "chana dal"],
        riskTags: ["legume_family"],
      },
    } satisfies AliasProposal;

    const row = buildAliasProposalExportChange(p);
    expect(row.canonical).toBe("channa-daal");
    expect(row.type).toBe("food");
    expect(row.class).toBe("legume");
    expect(row.aliases).toEqual(["channa daal", "chana dal"]);
    expect(row.riskTags).toEqual(["legume_family"]);
  });
});
