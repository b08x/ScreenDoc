/**
 * Mistral AI provider implementation using Vercel AI SDK
 */

import { mistral } from "@ai-sdk/mistral";
import type { LanguageModel } from "ai";

/**
 * Get a Mistral AI language model instance
 * @param apiKey - Mistral API key
 * @param modelId - Model identifier (e.g., 'mistral-large-latest')
 * @returns Configured language model
 */
export function getMistralModel(
  apiKey: string,
  modelId: string,
): LanguageModel {
  if (!apiKey) {
    throw new Error("Mistral API key is required");
  }

  // Set the API key in environment for the provider to use
  process.env.MISTRAL_API_KEY = apiKey;

  return mistral(modelId);
}
