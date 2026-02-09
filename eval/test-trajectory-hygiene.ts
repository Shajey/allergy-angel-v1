/**
 * Lightweight hygiene test for trajectory inference.
 *
 * Tests the post-processing rules (suppression, gating) using
 * in-memory data structures — no Supabase, no HTTP.
 *
 * Run: npx tsx eval/test-trajectory-hygiene.ts
 */

// ── Inline minimal types matching analyzeTrajectory internals ────────

type ProximityBucket = "strong" | "medium" | "weak";

interface PriorityHints {
  triggerKind?: "meal" | "medication" | "supplement";
  triggerValue?: string;
  symptomValue?: string;
}

interface RawInsight {
  type: "trigger_symptom" | "repeated_symptom" | "medication_symptom_cluster";
  label: string;
  description: string;
  supportingEvents: string[];
  priorityHints: PriorityHints;
  proximityBucket?: ProximityBucket;
  hoursDelta?: number;
  whyIncluded: string[];
}

// ── Re-implement the suppression function (mirrors analyzeTrajectory.ts) ──

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function applyClusterSuppression(
  triggerInsights: RawInsight[],
  suppressionKeys: Set<string>
): RawInsight[] {
  if (suppressionKeys.size === 0) return triggerInsights;

  return triggerInsights.filter((ins) => {
    if (ins.priorityHints.triggerKind !== "medication") return true;
    const key = `${normalize(ins.priorityHints.triggerValue ?? "")}→${normalize(ins.priorityHints.symptomValue ?? "")}`;
    return !suppressionKeys.has(key);
  });
}

// ── Test fixtures ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    failed++;
  }
}

// ── Test 1: Cluster suppresses pairwise duplicates ───────────────────

function testClusterSuppression() {
  const suppressionKeys = new Set([
    "ibuprofen→headache",
    "ibuprofen→nausea",
  ]);

  const triggerInsights: RawInsight[] = [
    {
      type: "trigger_symptom",
      label: "Medication → Symptom",
      description: 'Ibuprofen → headache',
      supportingEvents: ["c1", "c2"],
      priorityHints: { triggerKind: "medication", triggerValue: "Ibuprofen", symptomValue: "headache" },
      proximityBucket: "strong",
      hoursDelta: 2,
      whyIncluded: ["proximity_strong"],
    },
    {
      type: "trigger_symptom",
      label: "Medication → Symptom",
      description: 'Ibuprofen → nausea',
      supportingEvents: ["c1", "c3"],
      priorityHints: { triggerKind: "medication", triggerValue: "Ibuprofen", symptomValue: "nausea" },
      proximityBucket: "strong",
      hoursDelta: 3,
      whyIncluded: ["proximity_strong"],
    },
    {
      type: "trigger_symptom",
      label: "Meal → Symptom",
      description: 'trail mix → itchy throat',
      supportingEvents: ["c4", "c5"],
      priorityHints: { triggerKind: "meal", triggerValue: "trail mix", symptomValue: "itchy throat" },
      proximityBucket: "strong",
      hoursDelta: 1,
      whyIncluded: ["proximity_strong", "allergen_related"],
    },
  ];

  const result = applyClusterSuppression(triggerInsights, suppressionKeys);

  assert(
    result.length === 1,
    "Cluster suppression: 2 medication pairs suppressed, 1 meal pair kept"
  );
  assert(
    result[0].priorityHints.triggerKind === "meal",
    "Cluster suppression: surviving insight is the meal trigger"
  );
}

// ── Test 2: Proximity gating rejects weak non-allergen, non-unique ───

function testProximityGating() {
  // Simulate the gating logic inline
  type Candidate = {
    triggerLabel: string;
    triggerType: string;
    proximityBucket: ProximityBucket;
    isAllergenRelated: boolean;
    isUniqueTrigger: boolean;
  };

  function shouldInclude(c: Candidate): string[] {
    const why: string[] = [];
    if (c.proximityBucket === "strong") why.push("proximity_strong");
    if (c.isAllergenRelated) why.push("allergen_related");
    if (c.isUniqueTrigger) why.push("unique_trigger");
    return why;
  }

  // Weak, not allergen, not unique → rejected
  const weak: Candidate = {
    triggerLabel: "salad",
    triggerType: "meal",
    proximityBucket: "weak",
    isAllergenRelated: false,
    isUniqueTrigger: false,
  };
  assert(
    shouldInclude(weak).length === 0,
    "Gating: weak + non-allergen + non-unique → rejected"
  );

  // Weak but allergen-related → included
  const weakAllergen: Candidate = {
    triggerLabel: "peanut butter sandwich",
    triggerType: "meal",
    proximityBucket: "weak",
    isAllergenRelated: true,
    isUniqueTrigger: false,
  };
  assert(
    shouldInclude(weakAllergen).length > 0,
    "Gating: weak + allergen-related → included"
  );

  // Strong proximity → always included
  const strong: Candidate = {
    triggerLabel: "salad",
    triggerType: "meal",
    proximityBucket: "strong",
    isAllergenRelated: false,
    isUniqueTrigger: false,
  };
  assert(
    shouldInclude(strong).length > 0,
    "Gating: strong proximity → always included"
  );

  // Medium, unique trigger → included
  const mediumUnique: Candidate = {
    triggerLabel: "sushi",
    triggerType: "meal",
    proximityBucket: "medium",
    isAllergenRelated: false,
    isUniqueTrigger: true,
  };
  assert(
    shouldInclude(mediumUnique).length > 0,
    "Gating: medium + unique trigger → included"
  );
}

// ── Test 3: Dedup keeps strongest bucket ─────────────────────────────

function testDedupKeepsStrongest() {
  const BUCKET_RANK: Record<ProximityBucket, number> = {
    strong: 3,
    medium: 2,
    weak: 1,
  };

  // Simulate dedup logic
  const candidates = [
    { key: "salad→headache", bucket: "weak" as ProximityBucket },
    { key: "salad→headache", bucket: "strong" as ProximityBucket },
    { key: "salad→headache", bucket: "medium" as ProximityBucket },
  ];

  const deduped = new Map<string, ProximityBucket>();
  for (const c of candidates) {
    const existing = deduped.get(c.key);
    if (!existing || BUCKET_RANK[c.bucket] > BUCKET_RANK[existing]) {
      deduped.set(c.key, c.bucket);
    }
  }

  assert(deduped.size === 1, "Dedup: 3 candidates → 1 after dedup");
  assert(
    deduped.get("salad→headache") === "strong",
    "Dedup: kept the strongest bucket"
  );
}

// ── Run all tests ────────────────────────────────────────────────────

console.log("\n🧹 Trajectory Hygiene Tests\n" + "─".repeat(60));
testClusterSuppression();
testProximityGating();
testDedupKeepsStrongest();
console.log("─".repeat(60));
console.log(`\n📊 ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exit(1);
