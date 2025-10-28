/**
 * OpenAI provider implementation using Vercel AI SDK
 */

import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Get an OpenAI language model instance
 * @param apiKey - OpenAI API key
 * @param modelId - Model identifier (e.g., 'gpt-4o')
 * @returns Configured language model
 */
export function getOpenAIModel(apiKey: string, modelId: string): LanguageModel {
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

  // Set the API key in environment for the provider to use
  process.env.OPENAI_API_KEY = apiKey;

  return openai(modelId);
}
