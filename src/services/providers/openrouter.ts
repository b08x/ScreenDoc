/**
 * OpenRouter provider implementation using community package
 */

import { openrouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

/**
 * Get an OpenRouter language model instance
 * @param apiKey - OpenRouter API key
 * @param modelId - Model identifier (e.g., 'google/gemini-2.0-flash-exp:free')
 * @returns Configured language model
 */
export function getOpenRouterModel(
  apiKey: string,
  modelId: string,
): LanguageModel {
  if (!apiKey) {
    throw new Error("OpenRouter API key is required");
  }

  // Set the API key in environment for the provider to use
  process.env.OPENROUTER_API_KEY = apiKey;

  return openrouter.chat(modelId);
}
