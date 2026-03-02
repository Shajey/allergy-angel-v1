/**
 * Phase 17 – Photo Input + Medication Interactions
 *
 * Tests supplement interactions, food-medication interactions, and determinism.
 * checkRisk signature: checkRisk({ profile, events })
 * Profile: { known_allergies: string[], current_medications: { name: string; dosage?: string }[] }
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { checkRisk } from "../api/_lib/inference/checkRisk.js";

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

  // 17.1 Supplement → Medication Interactions
  console.log("\n--- 17.1 Supplement → Medication Interactions ---");

  {
    const profile = {
      known_allergies: [] as string[],
      current_medications: [{ name: "Eliquis" }],
    };
    const events = [
      {
        type: "supplement",
        fields: { supplement: "fish oil" },
        confidence: 0.9,
      },
    ];

    const verdict = checkRisk({ profile, events });
    assert(verdict.riskLevel === "medium", "Fish oil + Eliquis returns MEDIUM risk");
    assert(
      (verdict.reasoning?.includes("bleeding") ?? false) ||
        (verdict.reasoning?.includes("blood") ?? false),
      "Reasoning mentions bleeding/blood risk"
    );
  }

  {
    const profile = {
      known_allergies: [] as string[],
      current_medications: [{ name: "Sertraline" }],
    };
    const events = [
      {
        type: "supplement",
        fields: { supplement: "St John's Wort" },
        confidence: 0.9,
      },
    ];

    const verdict = checkRisk({ profile, events });
    assert(verdict.riskLevel === "high", "St John's Wort + SSRI returns HIGH risk");
  }

  {
    const profile = {
      known_allergies: [] as string[],
      current_medications: [{ name: "Warfarin" }],
    };
    const events = [
      {
        type: "supplement",
        fields: { supplement: "Vitamin K" },
        confidence: 0.9,
      },
    ];

    const verdict = checkRisk({ profile, events });
    assert(verdict.riskLevel === "high", "Vitamin K + Warfarin returns HIGH risk");
  }

  {
    const profile = {
      known_allergies: [] as string[],
      current_medications: [{ name: "Metformin" }],
    };
    const events = [
      {
        type: "supplement",
        fields: { supplement: "Vitamin D" },
        confidence: 0.9,
      },
    ];

    const verdict = checkRisk({ profile, events });
    assert(
      verdict.riskLevel === "none",
      "Vitamin D + Metformin returns NONE (no interaction)"
    );
  }

  {
    const profile = {
      known_allergies: [] as string[],
      current_medications: [] as { name: string; dosage?: string }[],
    };
    const events = [
      {
        type: "supplement",
        fields: { supplement: "Fish Oil" },
        confidence: 0.9,
      },
    ];

    const verdict = checkRisk({ profile, events });
    assert(
      verdict.riskLevel === "none",
      "Supplement with no profile medications returns NONE"
    );
  }

  // 17.2 Food ↔ Medication Interactions (use fields.meal)
  console.log("\n--- 17.2 Food ↔ Medication Interactions ---");

  {
    const profile = {
      known_allergies: [] as string[],
      current_medications: [{ name: "Lipitor" }],
    };
    const events = [
      {
        type: "meal",
        fields: { meal: "grapefruit juice, toast" },
        confidence: 0.9,
      },
    ];

    const verdict = checkRisk({ profile, events });
    assert(verdict.riskLevel === "medium", "Grapefruit + Statin returns MEDIUM risk");
  }

  {
    const profile = {
      known_allergies: [] as string[],
      current_medications: [{ name: "Warfarin" }],
    };
    const events = [
      {
        type: "meal",
        fields: { meal: "spinach salad with feta" },
        confidence: 0.9,
      },
    ];

    const verdict = checkRisk({ profile, events });
    assert(
      verdict.riskLevel === "medium",
      "Spinach + Warfarin returns MEDIUM (vitamin K)"
    );
  }

  // 17.3 Determinism
  console.log("\n--- 17.3 Determinism ---");

  {
    const profile = {
      known_allergies: [] as string[],
      current_medications: [{ name: "Eliquis" }],
    };
    const events = [
      {
        type: "supplement",
        fields: { supplement: "Fish Oil" },
        confidence: 0.9,
      },
    ];

    const verdicts = [];
    for (let i = 0; i < 10; i++) {
      verdicts.push(checkRisk({ profile, events }));
    }

    const first = JSON.stringify(verdicts[0]);
    const allSame = verdicts.every((v) => JSON.stringify(v) === first);
    assert(allSame, "Same inputs produce identical verdict (10 runs)");
  }

  // 17.4 Normalization
  console.log("\n--- 17.4 Normalization ---");

  {
    const profile = {
      known_allergies: [] as string[],
      current_medications: [{ name: "Eliquis (5mg)" }],
    };
    const events = [
      {
        type: "supplement",
        fields: { supplement: "fish oil" },
        confidence: 0.9,
      },
    ];

    const verdict = checkRisk({ profile, events });
    assert(
      verdict.riskLevel === "medium",
      "Handles medication with dosage in parens"
    );
  }

  {
    const profile = {
      known_allergies: [] as string[],
      current_medications: [{ name: "Zoloft" }],
    };

    const variations = [
      { supplement: "St John's Wort" },
      { name: "st johns wort" },
      { supplement: "ST JOHNS WORT" },
    ];
    let allHigh = true;

    for (const fields of variations) {
      const events = [{ type: "supplement", fields, confidence: 0.9 }];
      const verdict = checkRisk({ profile, events });
      if (verdict.riskLevel !== "high") allHigh = false;
    }

    assert(allHigh, "Handles St John's Wort name variations (supplement/name)");
  }

  // Summary
  console.log(`\n=== Phase 17 Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
