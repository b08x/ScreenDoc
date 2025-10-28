/**
 * Anthropic Claude provider implementation using Vercel AI SDK
 */

import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Get an Anthropic Claude language model instance
 * @param apiKey - Anthropic API key
 * @param modelId - Model identifier (e.g., 'claude-3-5-sonnet-20241022')
 * @returns Configured language model
 */
export function getAnthropicModel(
  apiKey: string,
  modelId: string,
): LanguageModel {
  if (!apiKey) {
    throw new Error("Anthropic API key is required");
  }

  // Set the API key in environment for the provider to use
  process.env.ANTHROPIC_API_KEY = apiKey;

  return anthropic(modelId);
}
