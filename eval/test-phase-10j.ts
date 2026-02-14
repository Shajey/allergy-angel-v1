/**
 * Phase 10J – Cross-Reactivity Weighting + Risk-Driven Follow-Up Hygiene
 *
 * Cross-reactivity tests:
 *   - tree_nut + mango => medium (cross-reactive)
 *   - tree_nut + pistachio => high (direct match wins)
 *   - latex + banana => medium
 *   - peanut + mango => none
 *   - no allergy + mango => none
 *
 * Follow-up hygiene tests:
 *   - High allergen verdict → evidence/label questions, no carbs
 *   - No glucose intent → carb follow-ups stripped
 *   - Glucose intent → carb follow-ups allowed
 *   - Reasoning punctuation: exactly one trailing period
 */

import { checkRisk } from "../api/_lib/inference/checkRisk.js";
import {
  postProcessFollowUps,
  hasGlucoseIntent,
  hasHighAllergenVerdict,
} from "../api/_lib/inference/postProcessFollowUps.js";
import {
  postProcessExtractionResult,
} from "../api/_lib/inference/postProcessExtractionResult.js";

interface TestCase {
  name: string;
  profileAllergies: string[];
  mealText: string;
  expectRisk: "high" | "medium" | "none";
  expectReasoningContains?: string;
  expectCrossReactive?: boolean;
}

const CASES: TestCase[] = [
  {
    name: "tree_nut + mango => medium",
    profileAllergies: ["tree_nut"],
    mealText: "mango smoothie",
    expectRisk: "medium",
    expectReasoningContains: "cross-reactive",
    expectCrossReactive: true,
  },
  {
    name: "tree_nut + pistachio => high (direct wins)",
    profileAllergies: ["tree_nut"],
    mealText: "pistachio ice cream",
    expectRisk: "high",
    expectReasoningContains: "tree_nut",
    expectCrossReactive: false,
  },
  {
    name: "latex + banana => medium",
    profileAllergies: ["latex"],
    mealText: "banana",
    expectRisk: "medium",
    expectReasoningContains: "cross-reactive",
    expectCrossReactive: true,
  },
  {
    name: "peanut + mango => none",
    profileAllergies: ["peanut"],
    mealText: "mango",
    expectRisk: "none",
  },
  {
    name: "no allergy + mango => none",
    profileAllergies: [],
    mealText: "mango",
    expectRisk: "none",
  },
];

function runTests(): void {
  let passed = 0;
  let failed = 0;

  for (const tc of CASES) {
    const verdict = checkRisk({
      profile: {
        known_allergies: tc.profileAllergies,
        current_medications: [],
      },
      events: [{ type: "meal", fields: { meal: tc.mealText } }],
    });

    const riskOk = verdict.riskLevel === tc.expectRisk;
    const reasoningOk =
      !tc.expectReasoningContains ||
      verdict.reasoning.toLowerCase().includes(tc.expectReasoningContains.toLowerCase());
    const crossReactiveOk =
      tc.expectCrossReactive === undefined ||
      (verdict.meta?.crossReactive === tc.expectCrossReactive);

    const ok = riskOk && reasoningOk && crossReactiveOk;
    if (ok) {
      passed++;
      console.log(`✓ ${tc.name}`);
    } else {
      failed++;
      console.error(`✗ ${tc.name}`);
      if (!riskOk) {
        console.error(`  Expected riskLevel ${tc.expectRisk}, got ${verdict.riskLevel}`);
      }
      if (!reasoningOk) {
        console.error(`  Reasoning: ${verdict.reasoning}`);
      }
      if (!crossReactiveOk) {
        console.error(
          `  Expected crossReactive ${tc.expectCrossReactive}, got ${verdict.meta?.crossReactive}`
        );
      }
    }
  }

  // ── Phase 10J: Follow-up hygiene tests ─────────────────────────────
  const followUpCases = [
    {
      name: "high allergen verdict → evidence questions, no carbs",
      rawText: "I ate pistachio ice cream and biscuits",
      events: [{ type: "meal", fields: { meal: "pistachio ice cream and biscuits" } }],
      followUpQuestions: ["How many grams of carbs?"],
      verdict: {
        riskLevel: "high",
        matched: [{ rule: "allergy_match", details: { allergen: "pistachio" } }],
        meta: { matchedChild: "pistachio", matchedCategory: "tree_nut" },
      },
      expectEvidence: true,
      expectNoCarbs: true,
    },
    {
      name: "no glucose intent → carb follow-ups stripped",
      rawText: "I ate mango for breakfast",
      events: [{ type: "meal", fields: { meal: "mango" } }],
      followUpQuestions: ["How many grams of carbs?"],
      verdict: { riskLevel: "none", matched: [] },
      expectNoCarbs: true,
    },
    {
      name: "glucose intent → carb follow-up allowed",
      rawText: "I ate mango for breakfast, carbs 45g",
      events: [{ type: "meal", fields: { meal: "mango" } }],
      followUpQuestions: ["How many grams of carbs?"],
      verdict: { riskLevel: "none", matched: [] },
      expectCarbsAllowed: true,
    },
    {
      name: "glucose intent + empty follow-ups → add carb question",
      rawText: "I ate mango for breakfast, carbs 45g",
      events: [{ type: "meal", fields: { meal: "mango" } }],
      followUpQuestions: [],
      verdict: { riskLevel: "none", matched: [] },
      expectLength: 1,
      expectContains: "carbohydrates",
    },
    // Phase 10J.2: medium cross-reactive evidence-seeking
    {
      name: "tree_nut + mango breakfast (no cues) → []",
      rawText: "I ate mango for breakfast",
      events: [{ type: "meal", fields: { meal: "mango" } }],
      followUpQuestions: [],
      verdict: {
        riskLevel: "medium",
        matched: [{ rule: "cross_reactive" }],
        meta: { crossReactive: true },
      },
      expectLength: 0,
    },
    {
      name: "tree_nut + mango carbs 45g → carb question",
      rawText: "I ate mango for breakfast, carbs 45g",
      events: [{ type: "meal", fields: { meal: "mango" } }],
      followUpQuestions: [],
      verdict: {
        riskLevel: "medium",
        matched: [{ rule: "cross_reactive" }],
        meta: { crossReactive: true },
      },
      expectLength: 1,
      expectContains: "carbohydrates",
    },
    {
      name: "tree_nut + mango throat itchy → symptom question",
      rawText: "I ate mango and my throat feels itchy",
      events: [{ type: "meal", fields: { meal: "mango" } }],
      followUpQuestions: [],
      verdict: {
        riskLevel: "medium",
        matched: [{ rule: "cross_reactive" }],
        meta: { crossReactive: true },
      },
      expectLength: 1,
      expectContains: "symptoms",
    },
  ];

  for (const tc of followUpCases) {
    const out = postProcessFollowUps({
      rawText: tc.rawText,
      events: tc.events,
      followUpQuestions: tc.followUpQuestions,
      verdict: tc.verdict,
    });
    let ok = true;
    if (tc.expectEvidence) {
      ok = ok && out.followUpQuestions.some((q) => q.includes("ingredient") || q.includes("label"));
    }
    if (tc.expectNoCarbs) {
      ok = ok && !out.followUpQuestions.some((q) => /\b(carbs?|grams?)\b/i.test(q));
    }
    if (tc.expectCarbsAllowed) {
      ok = ok && out.followUpQuestions.some((q) => /\b(carbs?|grams?)\b/i.test(q));
    }
    if (tc.expectLength != null) {
      ok = ok && out.followUpQuestions.length === tc.expectLength;
    }
    if (tc.expectContains) {
      ok = ok && out.followUpQuestions.some((q) => q.toLowerCase().includes(tc.expectContains!.toLowerCase()));
    }
    if (ok) {
      passed++;
      console.log(`✓ ${tc.name}`);
    } else {
      failed++;
      console.error(`✗ ${tc.name}`, { got: out.followUpQuestions });
    }
  }

  // ── Punctuation: reasoning ends with exactly one period ─────────────
  const punctVerdict = checkRisk({
    profile: { known_allergies: ["tree_nut"], current_medications: [] },
    events: [{ type: "meal", fields: { meal: "pistachio ice cream" } }],
  });
  const endsWithSinglePeriod = /\.$/.test(punctVerdict.reasoning) && !/\.\.$/.test(punctVerdict.reasoning);
  if (endsWithSinglePeriod) {
    passed++;
    console.log("✓ allergen reasoning ends with exactly one period");
  } else {
    failed++;
    console.error("✗ allergen reasoning punctuation:", JSON.stringify(punctVerdict.reasoning.slice(-5)));
  }

  // ── hasGlucoseIntent / hasHighAllergenVerdict unit tests ────────────
  if (hasGlucoseIntent("carbs 45g")) {
    passed++;
    console.log("✓ hasGlucoseIntent('carbs 45g') === true");
  } else {
    failed++;
    console.error("✗ hasGlucoseIntent('carbs 45g') expected true");
  }
  if (!hasGlucoseIntent("I ate mango for breakfast")) {
    passed++;
    console.log("✓ hasGlucoseIntent('I ate mango...') === false");
  } else {
    failed++;
    console.error("✗ hasGlucoseIntent('I ate mango...') expected false");
  }
  if (hasHighAllergenVerdict({ riskLevel: "high", matched: [{ rule: "allergy_match" }] })) {
    passed++;
    console.log("✓ hasHighAllergenVerdict(high+allergy_match) === true");
  } else {
    failed++;
    console.error("✗ hasHighAllergenVerdict expected true");
  }
  if (!hasHighAllergenVerdict({ riskLevel: "medium", matched: [{ rule: "cross_reactive" }] })) {
    passed++;
    console.log("✓ hasHighAllergenVerdict(medium+cross_reactive) === false");
  } else {
    failed++;
    console.error("✗ hasHighAllergenVerdict(medium) expected false");
  }

  // ── postProcessExtractionResult: meal needsClarification + carb follow-up suppression ─
  const extractionResult = {
    events: [
      { type: "meal", fields: { meal: "ice cream", carbs: 45 }, needsClarification: false },
      { type: "meal", fields: { meal: "biscuits", carbs: null }, needsClarification: true },
    ],
    followUpQuestions: ["What is the carbohydrate content of the biscuits?"],
    warnings: [],
  };
  postProcessExtractionResult("I ate ice cream and biscuits, carbs 45 grams", extractionResult);

  const extractOk =
    extractionResult.events.length === 2 &&
    extractionResult.events.every((e) => e.type === "meal" && e.needsClarification === false) &&
    !extractionResult.followUpQuestions?.some((q) => /carb|carbohydrate/i.test(q));

  if (extractOk) {
    passed++;
    console.log("✓ ice cream + biscuits + carbs 45g: needsClarification=false, no carb follow-ups");
  } else {
    failed++;
    console.error("✗ postProcessExtractionResult", {
      events: extractionResult.events.map((e) => ({ meal: e.fields?.meal, needsClarification: e.needsClarification })),
      followUpQuestions: extractionResult.followUpQuestions,
    });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
