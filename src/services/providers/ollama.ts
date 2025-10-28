/**
 * Ollama provider implementation using community package
 */

import { ollama } from "ollama-ai-provider-v2";
import type { LanguageModel } from "ai";

/**
 * Get an Ollama language model instance
 * @param baseURL - Ollama base URL (e.g., 'http://localhost:11434')
 * @param modelId - Model identifier (e.g., 'llama3.2-vision:11b')
 * @returns Configured language model
 */
export function getOllamaModel(
  baseURL: string,
  modelId: string,
): LanguageModel {
  if (!baseURL) {
    throw new Error("Ollama base URL is required");
  }

  // Set the base URL in environment for the provider to use
  process.env.OLLAMA_BASE_URL = baseURL;

  return ollama(modelId);
}
