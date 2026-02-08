import OpenAI from "openai";

/**
 * Singleton-style helper to get the OpenAI client.
 * It pulls the key automatically from the OPENAI_API_KEY environment variable.
 */
export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const err: any = new Error("Missing OPENAI_API_KEY environment variable.");
    err.statusCode = 500;
    throw err;
  }

  // The OpenAI SDK automatically looks for 'OPENAI_API_KEY' if no options are passed,
  // but explicitly passing it here is safer for our triage logic.
  return new OpenAI({
    apiKey: apiKey,
  });
}

export function getModelName() {
  // Allows you to switch models via environment variables without changing code.
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}