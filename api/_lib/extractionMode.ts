export type ExtractionMode = "heuristic" | "llm";

/**
 * Get extraction mode from environment variable.
 * Returns "llm" if EXTRACTION_MODE equals "llm" (case-insensitive, trimmed).
 * Defaults to "heuristic".
 */
export function getExtractionMode(): ExtractionMode {
  const envValue = process.env.EXTRACTION_MODE;
  if (envValue) {
    const normalized = envValue.trim().toLowerCase();
    if (normalized === "llm") {
      return "llm";
    }
  }
  return "heuristic";
}

/**
 * Debug helper to verify extraction mode detection.
 * Returns the detected mode and raw environment variable value.
 */
export function debugExtractionMode(): { mode: string; envValue: string | null } {
  return {
    mode: getExtractionMode(),
    envValue: process.env.EXTRACTION_MODE ?? null
  };
}
