/**
 * AI Service layer providing unified interface across multiple providers
 */

import { generateText } from "ai";
import type { LanguageModel } from "ai";
import type { Settings, ModelDefinition, ApiKeyStatus } from "../types";
import { PROVIDERS, DEFAULT_MODELS } from "../constants";
import { getEnvApiKey, getEnvBaseUrl } from "../utils/env";
import { saveModels, loadModels, areModelsFresh } from "../utils/modelStore";

/**
 * Type definition for OpenRouter model API response
 */
interface OpenRouterModel {
  id: string;
  name?: string;
  architecture?: {
    modality?: string;
  };
}

/**
 * Type definition for Ollama model API response
 */
interface OllamaModel {
  name: string;
}

/**
 * Get a language model instance based on settings
 * @param settings - Application settings
 * @param modelId - Specific model ID to use
 * @returns Configured language model
 */
export async function getLanguageModel(
  settings: Settings,
  modelId: string,
): Promise<LanguageModel> {
  const providerConfig = PROVIDERS[settings.provider];
  const effectiveApiKey = settings.apiKey || getEnvApiKey(settings.provider);
  const finalBaseURL = settings.baseURL || getEnvBaseUrl(settings.provider);

  // Validate required parameters
  if (providerConfig.apiKeyNeeded && !effectiveApiKey) {
    throw new Error(`API key is required for ${providerConfig.name}`);
  }

  // Dynamically import and instantiate the appropriate provider
  switch (providerConfig.api) {
    case "google": {
      const { getGoogleModel } = await import("./providers/google");
      return getGoogleModel(effectiveApiKey, modelId);
    }

    case "openai": {
      const { getOpenAIModel } = await import("./providers/openai");
      return getOpenAIModel(effectiveApiKey, modelId);
    }

    case "anthropic": {
      const { getAnthropicModel } = await import("./providers/anthropic");
      return getAnthropicModel(effectiveApiKey, modelId);
    }

    case "mistral": {
      const { getMistralModel } = await import("./providers/mistral");
      return getMistralModel(effectiveApiKey, modelId);
    }

    case "openrouter": {
      const { getOpenRouterModel } = await import("./providers/openrouter");
      return getOpenRouterModel(effectiveApiKey, modelId);
    }

    case "ollama_community": {
      const { getOllamaModel } = await import("./providers/ollama");
      return getOllamaModel(finalBaseURL, modelId);
    }

    default:
      throw new Error(`Unsupported provider: ${settings.provider}`);
  }
}

/**
 * Validate API key by attempting a simple generation
 * @param settings - Settings to validate
 * @returns Validation status
 */
export async function validateApiKey(
  settings: Settings,
): Promise<ApiKeyStatus> {
  try {
    // Use text model for validation (simpler/cheaper)
    const model = await getLanguageModel(settings, settings.textModelId);

    // Attempt a minimal generation to verify the API key works
    await generateText({
      model,
      prompt: 'Say "OK"',
      maxRetries: 1,
    });

    return "valid";
  } catch (error) {
    console.error("API key validation failed:", error);
    return "invalid";
  }
}

/**
 * Fetch available models from provider API
 * @param settings - Application settings
 * @returns Object with vision and text models
 */
export async function fetchAvailableModels(
  settings: Settings,
): Promise<{ visionModels: ModelDefinition[]; textModels: ModelDefinition[] }> {
  let models: ModelDefinition[] = [];

  // Check if we have fresh cached models
  if (settings.fetchModelsOnLoad) {
    const cached = loadModels(settings.provider);
    if (cached && areModelsFresh(cached)) {
      console.log(`Using cached models for ${settings.provider}`);
      models = cached.models;
    }
  }

  // Fetch models if not cached or not fresh
  if (models.length === 0) {
    try {
      if (settings.provider === "openrouter") {
        models = await fetchOpenRouterModels(
          settings.apiKey || getEnvApiKey("openrouter"),
        );
      } else if (settings.provider === "ollama") {
        const baseURL = settings.baseURL || getEnvBaseUrl("ollama");
        models = await fetchOllamaModels(baseURL);
      } else {
        // Use default models for other providers
        models = DEFAULT_MODELS[settings.provider] || [];
      }

      // Cache the fetched models
      if (settings.fetchModelsOnLoad && models.length > 0) {
        saveModels(settings.provider, models);
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
      // Fall back to defaults
      models = DEFAULT_MODELS[settings.provider] || [];
    }
  }

  // If still no models, use defaults
  if (models.length === 0) {
    models = DEFAULT_MODELS[settings.provider] || [];
  }

  // Categorize models by capability
  const visionModels = models.filter((m) => m.supportsVision);
  const textModels = models.filter((m) => m.supportsText);

  return { visionModels, textModels };
}

/**
 * Fetch models from OpenRouter API
 * @param apiKey - OpenRouter API key
 * @returns Array of model definitions
 */
async function fetchOpenRouterModels(
  apiKey: string,
): Promise<ModelDefinition[]> {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data = (await response.json()) as { data?: OpenRouterModel[] };

  // Map OpenRouter models to our format
  return (data.data || []).map((model: OpenRouterModel) => ({
    id: model.id,
    name: model.name || model.id,
    supportsVision: model.architecture?.modality === "multimodal" || false,
    supportsText: true,
  }));
}

/**
 * Fetch models from Ollama API
 * @param baseURL - Ollama base URL
 * @returns Array of model definitions
 */
async function fetchOllamaModels(baseURL: string): Promise<ModelDefinition[]> {
  const response = await fetch(`${baseURL}/api/tags`);

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = (await response.json()) as { models?: OllamaModel[] };

  // Map Ollama models to our format
  return (data.models || []).map((model: OllamaModel) => ({
    id: model.name,
    name: model.name,
    // Ollama doesn't provide capability info, so we infer from name
    supportsVision:
      model.name.includes("vision") || model.name.includes("llava"),
    supportsText: true,
  }));
}
