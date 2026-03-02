/**
 * Phase 17 – Image text extraction
 *
 * Uses LLM vision to extract text from product label images.
 * Uses getOpenAIClient() from openaiClient.js.
 * OpenAI supports: png, jpeg, gif, webp. MIME type must match actual image data.
 */

import { getOpenAIClient } from "./openaiClient.js";

const SUPPORTED_MIME = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

export async function extractTextFromImage(
  imageBase64: string,
  mimeType?: string
): Promise<{ text: string; confidence: number }> {
  const openai = getOpenAIClient();

  // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,")
  const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

  const type =
    mimeType && SUPPORTED_MIME.includes(mimeType as (typeof SUPPORTED_MIME)[number])
      ? mimeType
      : "image/jpeg";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all text from this product label image. Return only the text, no commentary.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${type};base64,${base64Data}`,
            },
          },
        ],
      },
    ],
    max_tokens: 1000,
  });

  const text = response.choices[0]?.message?.content?.trim() ?? "";
  return { text, confidence: text.length > 0 ? 0.8 : 0.2 };
}
