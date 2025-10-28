/**
 * Google Gemini provider implementation using Vercel AI SDK
 */

import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * Get a Google Gemini language model instance
 * @param apiKey - Google API key
 * @param modelId - Model identifier (e.g., 'gemini-2.5-pro')
 * @returns Configured language model
 */
export function getGoogleModel(apiKey: string, modelId: string): LanguageModel {
  if (!apiKey) {
    throw new Error("Google API key is required");
  }

  // Set the API key in environment for the provider to use
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

  return google(modelId);
}
