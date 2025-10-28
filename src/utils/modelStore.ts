/**
 * LocalStorage utilities for model data persistence
 */

import type { Provider, ModelDefinition, StoredModelData } from '../types';
import { STORAGE_KEYS } from '../constants';

/**
 * Save models to localStorage for a specific provider
 * @param provider - The AI provider
 * @param models - Array of model definitions
 */
export function saveModels(provider: Provider, models: ModelDefinition[]): void {
  try {
    const storedData: StoredModelData = {
      provider,
      models,
      lastFetched: new Date().toISOString(),
    };

    const key = `${STORAGE_KEYS.MODELS}-${provider}`;
    localStorage.setItem(key, JSON.stringify(storedData));
  } catch (error) {
    console.error('Failed to save models to localStorage:', error);
  }
}

/**
 * Load models from localStorage for a specific provider
 * @param provider - The AI provider
 * @returns Stored model data or null if not found
 */
export function loadModels(provider: Provider): StoredModelData | null {
  try {
    const key = `${STORAGE_KEYS.MODELS}-${provider}`;
    const stored = localStorage.getItem(key);

    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored) as StoredModelData;

    // Validate the stored data structure
    if (
      data.provider === provider &&
      Array.isArray(data.models) &&
      typeof data.lastFetched === 'string'
    ) {
      return data;
    }

    return null;
  } catch (error) {
    console.error('Failed to load models from localStorage:', error);
    return null;
  }
}

/**
 * Load all stored models from localStorage
 * @returns Map of provider to stored model data
 */
export function loadAllModels(): Map<Provider, StoredModelData> {
  const allModels = new Map<Provider, StoredModelData>();
  const providers: Provider[] = ['google', 'openai', 'anthropic', 'mistral', 'openrouter', 'ollama'];

  for (const provider of providers) {
    const data = loadModels(provider);
    if (data) {
      allModels.set(provider, data);
    }
  }

  return allModels;
}

/**
 * Clear stored models for a specific provider
 * @param provider - The AI provider
 */
export function clearStoredModels(provider: Provider): void {
  try {
    const key = `${STORAGE_KEYS.MODELS}-${provider}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear models from localStorage:', error);
  }
}

/**
 * Clear all stored models
 */
export function clearAllStoredModels(): void {
  const providers: Provider[] = ['google', 'openai', 'anthropic', 'mistral', 'openrouter', 'ollama'];

  for (const provider of providers) {
    clearStoredModels(provider);
  }
}

/**
 * Check if stored models are fresh (less than 24 hours old)
 * @param data - Stored model data
 * @returns True if data is fresh
 */
export function areModelsFresh(data: StoredModelData): boolean {
  try {
    const lastFetched = new Date(data.lastFetched);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60);

    return hoursDiff < 24;
  } catch (error) {
    return false;
  }
}
