/**
 * Environment variable utilities for API key and configuration management
 */

import type { Provider } from '../types';

/**
 * Get API key from environment variables for a given provider
 * NOTE: API keys are no longer exposed via environment variables for security.
 * They should only come from user input via ProviderSetupPage.
 * @param provider - The AI provider name
 * @returns Always returns empty string (API keys must be provided by users)
 */
export function getEnvApiKey(provider: Provider): string {
  // API keys are no longer exposed via build-time environment variables
  // for security reasons. Users must provide them via ProviderSetupPage.
  return '';
}

/**
 * Get base URL from environment variables (primarily for Ollama)
 * @param provider - The AI provider name
 * @returns The base URL or empty string
 */
export function getEnvBaseUrl(provider: Provider): string {
  if (provider === 'ollama') {
    return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }
  return '';
}

/**
 * Check if a provider has an API key set in environment
 * NOTE: Always returns false now since we removed API key exposure from environment.
 * @param provider - The AI provider name
 * @returns True only for Ollama (doesn't need API key), false for all others
 */
export function hasEnvApiKey(provider: Provider): boolean {
  if (provider === 'ollama') {
    return true; // Ollama doesn't require an API key
  }
  // Always return false since we no longer expose API keys via environment
  return false;
}

/**
 * Get all available environment variables for debugging
 * NOTE: API keys are no longer exposed via environment for security.
 * @returns Object with only non-sensitive configuration values
 */
export function getAvailableEnvKeys(): Record<string, boolean> {
  return {
    GEMINI_API_KEY: false,
    OPENAI_API_KEY: false,
    ANTHROPIC_API_KEY: false,
    MISTRAL_API_KEY: false,
    OPENROUTER_API_KEY: false,
    OLLAMA_BASE_URL: !!process.env.OLLAMA_BASE_URL,
  };
}
