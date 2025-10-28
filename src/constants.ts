/**
 * Application constants for AI providers, models, and default settings
 */

import type { ModelDefinition } from './types';

/**
 * Provider configuration with API types and requirements
 */
export const PROVIDERS = {
  google: {
    name: 'Google Gemini',
    defaultModels: ['gemini-2.0-flash-exp', 'gemini-exp-1206', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    api: 'google' as const,
    apiKeyNeeded: true,
  },
  openai: {
    name: 'OpenAI',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'],
    api: 'openai' as const,
    apiKeyNeeded: true,
  },
  anthropic: {
    name: 'Anthropic Claude',
    defaultModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    api: 'anthropic' as const,
    apiKeyNeeded: true,
  },
  mistral: {
    name: 'Mistral AI',
    defaultModels: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'pixtral-large-latest'],
    api: 'mistral' as const,
    apiKeyNeeded: true,
  },
  openrouter: {
    name: 'OpenRouter',
    defaultModels: [
      'google/gemini-2.0-flash-exp:free',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'meta-llama/llama-3.3-70b-instruct',
      'qwen/qwen-2.5-72b-instruct',
    ],
    api: 'openrouter' as const,
    apiKeyNeeded: true,
  },
  ollama: {
    name: 'Ollama (Local)',
    defaultModels: ['llama3.2-vision:11b', 'llama3.2:3b', 'qwen2.5:7b', 'mistral:7b'],
    api: 'ollama_community' as const,
    apiKeyNeeded: false,
    baseURL: 'http://localhost:11434',
  },
} as const;

/**
 * Default model configurations with capability flags
 */
export const DEFAULT_MODELS: Record<string, ModelDefinition[]> = {
  google: [
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)', supportsVision: true, supportsText: true },
    { id: 'gemini-exp-1206', name: 'Gemini Exp 1206', supportsVision: true, supportsText: true },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', supportsVision: true, supportsText: true },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', supportsVision: true, supportsText: true },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', supportsVision: true, supportsText: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', supportsVision: true, supportsText: true },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', supportsVision: true, supportsText: true },
    { id: 'o1', name: 'O1', supportsVision: false, supportsText: true },
    { id: 'o1-mini', name: 'O1 Mini', supportsVision: false, supportsText: true },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', supportsVision: true, supportsText: true },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', supportsVision: true, supportsText: true },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', supportsVision: true, supportsText: true },
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large', supportsVision: false, supportsText: true },
    { id: 'mistral-medium-latest', name: 'Mistral Medium', supportsVision: false, supportsText: true },
    { id: 'mistral-small-latest', name: 'Mistral Small', supportsVision: false, supportsText: true },
    { id: 'pixtral-large-latest', name: 'Pixtral Large', supportsVision: true, supportsText: true },
  ],
  openrouter: [
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', supportsVision: true, supportsText: true },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', supportsVision: true, supportsText: true },
    { id: 'openai/gpt-4o', name: 'GPT-4o', supportsVision: true, supportsText: true },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', supportsVision: false, supportsText: true },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', supportsVision: false, supportsText: true },
  ],
  ollama: [
    { id: 'llama3.2-vision:11b', name: 'Llama 3.2 Vision 11B', supportsVision: true, supportsText: true },
    { id: 'llama3.2:3b', name: 'Llama 3.2 3B', supportsVision: false, supportsText: true },
    { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', supportsVision: false, supportsText: true },
    { id: 'mistral:7b', name: 'Mistral 7B', supportsVision: false, supportsText: true },
  ],
};

/**
 * Initial application settings with sensible defaults
 */
export const INITIAL_SETTINGS = {
  provider: 'google' as const,
  apiKey: '',
  baseURL: '',
  visionModelId: 'gemini-2.5-pro',
  textModelId: 'gemini-2.5-flash',
  fetchModelsOnLoad: false,
};

/**
 * LocalStorage keys for settings persistence
 */
export const STORAGE_KEYS = {
  SETTINGS: 'screenguide-settings',
  MODELS: 'screenguide-models',
  THEME: 'screenguide-theme',
} as const;
