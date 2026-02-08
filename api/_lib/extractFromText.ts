import { extractFromTextHeuristic } from "./extractFromTextHeuristic";
import { extractFromTextLLM } from "./extractFromTextLLM";
import { getExtractionMode } from "./extractionMode";

export async function extractFromText(rawText: string) {
  const mode = getExtractionMode();

  // DEBUG LOG: This will show up in your terminal running 'npx vercel dev'
  console.log(`[Router] Raw EXTRACTION_MODE env var: "${process.env.EXTRACTION_MODE}"`);
  console.log(`[Router] Current Mode detected: "${mode}"`);

  if (mode === "llm") {
    console.log("[Router] Routing to LLM Specialist...");
    return await extractFromTextLLM(rawText);
  }

  console.log("[Router] Falling back to Heuristic logic.");
  return await extractFromTextHeuristic(rawText);
}
