/**
 * Phase 18.1 – Intelligent Follow-up Questions
 *
 * - Skip "Does this contain X?" when user already said X (e.g. "peanut pie")
 * - Cross-reactive: when food (e.g. mango) is explicit, ask awareness question
 */

import { checkRisk } from "../api/_lib/inference/checkRisk.js";
import { isAllergenExplicitInInput } from "../api/_lib/inference/explicitMentionCheck.js";
import { postProcessFollowUps } from "../api/_lib/inference/postProcessFollowUps.js";

function assert(condition: boolean, message: string): boolean {
  if (condition) {
    console.log(`✓ ${message}`);
    return true;
  }
  console.error(`✗ ${message}`);
  return false;
}

function runTests(): void {
  let passed = 0;
  let failed = 0;

  console.log("\n--- 18.1 Explicit Mention Detection ---");

  if (assert(isAllergenExplicitInInput("peanut pie with mango", { term: "peanut" }), '"peanut pie" — peanut is explicit')) passed++;
  else failed++;

  if (assert(!isAllergenExplicitInInput("pad thai from the restaurant", { term: "peanut" }), '"pad thai" — peanut is NOT explicit')) passed++;
  else failed++;

  if (assert(isAllergenExplicitInInput("cashew chicken", { term: "tree_nut", childTerm: "cashew" }), '"cashew chicken" — cashew is explicit')) passed++;
  else failed++;

  if (assert(!isAllergenExplicitInInput("granola bar", { term: "tree_nut" }), '"granola bar" — tree_nut is NOT explicit')) passed++;
  else failed++;

  if (assert(isAllergenExplicitInInput("mango smoothie", { term: "tree_nut", childTerm: "mango" }), '"mango smoothie" — mango is explicit (cross-reactive)')) passed++;
  else failed++;

  if (assert(isAllergenExplicitInInput("groundnut curry", { term: "peanut", synonyms: ["groundnut"] }), '"groundnut curry" — groundnut synonym is explicit')) passed++;
  else failed++;

  console.log("\n--- 18.1 Follow-up Question Filtering (High Allergen) ---");

  // Explicit peanut → no confirmation question, only label question
  {
    const out = postProcessFollowUps({
      rawText: "peanut pie with mango",
      events: [{ type: "meal", fields: { meal: "peanut pie with mango" } }],
      followUpQuestions: [],
      verdict: {
        riskLevel: "high",
        matched: [{ rule: "allergy_match", details: { allergen: "peanut", matchedCategory: "peanut" } }],
        meta: { matchedChild: "peanut", matchedCategory: "peanut" },
      },
    });
    const noSillyQuestion = !out.followUpQuestions.some((q) => /does this contain.*peanut/i.test(q));
    const hasLabelQuestion = out.followUpQuestions.some((q) => /label|ingredient/i.test(q));
    if (assert(noSillyQuestion && hasLabelQuestion, '"peanut pie" — no "Does this contain peanut?", has label question')) passed++;
    else failed++;
  }

  // Implicit peanut (pad thai) → confirmation + label
  {
    const out = postProcessFollowUps({
      rawText: "pad thai from the restaurant",
      events: [{ type: "meal", fields: { meal: "pad thai" } }],
      followUpQuestions: [],
      verdict: {
        riskLevel: "high",
        matched: [{ rule: "allergy_match", details: { allergen: "peanut", matchedCategory: "peanut" } }],
        meta: { matchedChild: "peanut", matchedCategory: "peanut" },
      },
    });
    const hasConfirmation = out.followUpQuestions.some((q) => /might contain|confirm/i.test(q));
    const hasLabelQuestion = out.followUpQuestions.some((q) => /label|ingredient/i.test(q));
    if (assert(hasConfirmation && hasLabelQuestion, '"pad thai" — has confirmation + label question')) passed++;
    else failed++;
  }

  // Explicit cashew → no confirmation
  {
    const out = postProcessFollowUps({
      rawText: "cashew chicken",
      events: [{ type: "meal", fields: { meal: "cashew chicken" } }],
      followUpQuestions: [],
      verdict: {
        riskLevel: "high",
        matched: [{ rule: "allergy_match", details: { allergen: "cashew", matchedCategory: "tree_nut" } }],
        meta: { matchedChild: "cashew", matchedCategory: "tree_nut" },
      },
    });
    const noSillyQuestion = !out.followUpQuestions.some((q) => /does this contain.*cashew/i.test(q));
    if (assert(noSillyQuestion, '"cashew chicken" — no silly confirmation')) passed++;
    else failed++;
  }

  // Implicit tree nut (granola bar) → confirmation
  {
    const out = postProcessFollowUps({
      rawText: "granola bar",
      events: [{ type: "meal", fields: { meal: "granola bar" } }],
      followUpQuestions: [],
      verdict: {
        riskLevel: "high",
        matched: [{ rule: "allergy_match", details: { allergen: "almond", matchedCategory: "tree_nut" } }],
        meta: { matchedChild: "almond", matchedCategory: "tree_nut" },
      },
    });
    const hasConfirmation = out.followUpQuestions.some((q) => /might contain|confirm/i.test(q));
    if (assert(hasConfirmation, '"granola bar" — has confirmation question')) passed++;
    else failed++;
  }

  console.log("\n--- 18.1 Cross-Reactive Awareness Question ---");

  // Mango explicit + cross-reactive → awareness question
  {
    const out = postProcessFollowUps({
      rawText: "mango smoothie",
      events: [{ type: "meal", fields: { meal: "mango smoothie" } }],
      followUpQuestions: [],
      verdict: {
        riskLevel: "medium",
        matched: [{ rule: "cross_reactive" }],
        meta: { crossReactive: true, source: "tree_nut", matchedTerm: "mango" },
      },
    });
    const hasAwareness = out.followUpQuestions.some(
      (q) => q.includes("cross-react") && q.toLowerCase().includes("mango")
    );
    if (assert(hasAwareness, '"mango smoothie" — cross-reactive awareness question')) passed++;
    else failed++;
  }

  // Cross-reactive without source/matchedTerm (legacy) → empty
  {
    const out = postProcessFollowUps({
      rawText: "I ate mango for breakfast",
      events: [{ type: "meal", fields: { meal: "mango" } }],
      followUpQuestions: [],
      verdict: {
        riskLevel: "medium",
        matched: [{ rule: "cross_reactive" }],
        meta: { crossReactive: true },
      },
    });
    if (assert(out.followUpQuestions.length === 0, "cross-reactive (no meta source/matchedTerm) → []")) passed++;
    else failed++;
  }

  console.log("\n--- 18.1 Dish→Allergen (pad thai + peanut) ---");

  const verdict = checkRisk({
    profile: { known_allergies: ["peanut", "Peanuts"], current_medications: [] },
    events: [{ type: "meal", fields: { meal: "pad thai" } }],
  });
  const post = postProcessFollowUps({
    rawText: "pad thai",
    events: [{ type: "meal", fields: { meal: "pad thai" } }],
    followUpQuestions: [],
    verdict,
  });

  if (assert(verdict.riskLevel === "high", "pad thai + peanut → HIGH risk")) passed++;
  else failed++;
  if (
    assert(
      post.followUpQuestions.length >= 1 && post.followUpQuestions.some((q) => /might contain|label|ingredient/i.test(q)),
      "pad thai + peanut → follow-up questions"
    )
  )
    passed++;
  else failed++;

  console.log(`\n=== Phase 18.1 Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
