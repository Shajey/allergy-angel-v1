/**
 * Phase 22.1 – Entity Type Inference (Radar-Only)
 *
 * Best-effort heuristic classification for unknown entities.
 * Does NOT affect inference engine. Radar metadata only.
 */

export type InferredEntityType = "medication" | "supplement" | "food" | "unknown";

export function inferEntityType(name: string): InferredEntityType {
  const n = name.toLowerCase().trim();
  if (!n) return "unknown";

  // Supplement patterns
  if (
    n.includes("oil") ||
    n.includes("extract") ||
    n.includes("capsule") ||
    /\d+\s*mg\b/.test(n) ||
    n.includes("vitamin") ||
    n.includes("omega") ||
    n.includes("probiotic") ||
    n.includes("herb") ||
    n.includes("root") ||
    n.includes("powder") ||
    n.includes("complex") ||
    n.includes("formula")
  ) {
    return "supplement";
  }

  // Food patterns
  if (
    n.includes("rice") ||
    n.includes("lentil") ||
    n.includes("dal") ||
    n.includes("daal") ||
    n.includes("milk") ||
    n.includes("yogurt") ||
    n.includes("yoghurt") ||
    n.includes("bread") ||
    n.includes("cheese") ||
    n.includes("butter") ||
    n.includes("flour") ||
    n.includes("nut") ||
    n.includes("seed") ||
    n.includes("fruit") ||
    n.includes("vegetable") ||
    n.includes("chicken") ||
    n.includes("beef") ||
    n.includes("fish") ||
    n.includes("sauce") ||
    n.includes("soup") ||
    n.includes("salad") ||
    n.includes("smoothie") ||
    n.includes("channa") ||
    n.includes("chana") ||
    n.includes("tofu") ||
    n.includes("paneer")
  ) {
    return "food";
  }

  // Medication patterns (common suffixes)
  if (
    n.endsWith("in") ||
    n.endsWith("ol") ||
    n.endsWith("ide") ||
    n.endsWith("ine") ||
    n.endsWith("ate") ||
    n.endsWith("one") ||
    /\b(hcl|hbr|sodium|citrate)\b/.test(n)
  ) {
    return "medication";
  }

  return "unknown";
}
