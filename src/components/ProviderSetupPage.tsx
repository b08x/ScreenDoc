/**
 * Provider Setup Page - Configuration UI for AI providers
 */

import React, { useState, useEffect } from 'react';
import type { Settings, ApiKeyStatus, ModelDefinition, Provider } from '../types';
import { PROVIDERS } from '../constants';
import { hasEnvApiKey, getEnvApiKey, getEnvBaseUrl } from '../utils/env';
import { validateApiKey, fetchAvailableModels } from '../services/aiService';

interface ProviderSetupPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  apiKeyStatus: ApiKeyStatus;
  setApiKeyStatus: React.Dispatch<React.SetStateAction<ApiKeyStatus>>;
  availableModels: {
    visionModels: ModelDefinition[];
    textModels: ModelDefinition[];
  };
  setAvailableModels: React.Dispatch<
    React.SetStateAction<{
      visionModels: ModelDefinition[];
      textModels: ModelDefinition[];
    }>
  >;
  onComplete: () => void;
}

export function ProviderSetupPage({
  settings,
  setSettings,
  apiKeyStatus,
  setApiKeyStatus,
  availableModels,
  setAvailableModels,
  onComplete,
}: ProviderSetupPageProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fetchingModels, setFetchingModels] = useState(false);

  const providerConfig = PROVIDERS[settings.provider];
  const needsApiKey = providerConfig.apiKeyNeeded && !hasEnvApiKey(settings.provider);
  const needsBaseUrl = settings.provider === 'ollama';

  // Auto-fill API key from environment on provider change
  useEffect(() => {
    const envApiKey = getEnvApiKey(settings.provider);
    const envBaseUrl = getEnvBaseUrl(settings.provider);

    if (envApiKey) {
      setSettings((prev) => ({ ...prev, apiKey: envApiKey }));
    }
    if (envBaseUrl && settings.provider === 'ollama') {
      setSettings((prev) => ({ ...prev, baseURL: envBaseUrl }));
    }
  }, [settings.provider, setSettings]);

  const handleProviderChange = (provider: Provider) => {
    const newProviderConfig = PROVIDERS[provider];
    const defaultVisionModel = newProviderConfig.defaultModels[0];
    const defaultTextModel = newProviderConfig.defaultModels[newProviderConfig.defaultModels.length > 1 ? 1 : 0];

    setSettings((prev) => ({
      ...prev,
      provider,
      visionModelId: defaultVisionModel,
      textModelId: defaultTextModel,
      apiKey: getEnvApiKey(provider),
      baseURL: provider === 'ollama' ? getEnvBaseUrl(provider) : '',
    }));

    setApiKeyStatus('unchecked');
    setErrorMessage('');
  };

  const handleValidateAndSave = async () => {
    setIsValidating(true);
    setErrorMessage('');
    setApiKeyStatus('checking');

    try {
      // Validate the API key
      const status = await validateApiKey(settings);
      setApiKeyStatus(status);

      if (status === 'valid') {
        // Fetch available models if setting is enabled
        if (settings.fetchModelsOnLoad || fetchingModels) {
          setFetchingModels(true);
          const models = await fetchAvailableModels(settings);
          setAvailableModels(models);
          setFetchingModels(false);
        }

        // Save settings to localStorage
        localStorage.setItem('screenguide-settings', JSON.stringify(settings));

        // Complete setup
        onComplete();
      } else {
        setErrorMessage('Invalid API key or connection failed');
      }
    } catch (error) {
      console.error('Validation error:', error);
      setApiKeyStatus('invalid');
      setErrorMessage(error instanceof Error ? error.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    setErrorMessage('');

    try {
      const models = await fetchAvailableModels(settings);
      setAvailableModels(models);
    } catch (error) {
      console.error('Error fetching models:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch models');
    } finally {
      setFetchingModels(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          AI Provider Setup
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Configure your AI provider to get started with ScreenGuide AI
        </p>

        {/* Provider Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Select Provider
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(Object.keys(PROVIDERS) as Provider[]).map((provider) => (
              <button
                key={provider}
                onClick={() => handleProviderChange(provider)}
                className={`px-4 py-3 rounded-lg border-2 transition-all ${
                  settings.provider === provider
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                }`}
              >
                {PROVIDERS[provider].name}
              </button>
            ))}
          </div>
        </div>

        {/* API Key Input */}
        {needsApiKey && (
          <div className="mb-6">
            <label
              htmlFor="apiKey"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={settings.apiKey}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, apiKey: e.target.value }))
              }
              placeholder={`Enter your ${providerConfig.name} API key`}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Base URL Input (Ollama) */}
        {needsBaseUrl && (
          <div className="mb-6">
            <label
              htmlFor="baseURL"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Base URL
            </label>
            <input
              id="baseURL"
              type="text"
              value={settings.baseURL || ''}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, baseURL: e.target.value }))
              }
              placeholder="http://localhost:11434"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Fetch Models Toggle */}
        <div className="mb-6">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.fetchModelsOnLoad}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  fetchModelsOnLoad: e.target.checked,
                }))
              }
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Fetch available models on load
            </span>
          </label>
          {settings.fetchModelsOnLoad && (
            <button
              onClick={handleFetchModels}
              disabled={fetchingModels}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              {fetchingModels ? 'Fetching...' : 'Fetch models now'}
            </button>
          )}
        </div>

        {/* Model Selection */}
        {(availableModels.visionModels.length > 0 || availableModels.textModels.length > 0) && (
          <>
            <div className="mb-6">
              <label
                htmlFor="visionModel"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Vision/Multimodal Model
              </label>
              <select
                id="visionModel"
                value={settings.visionModelId}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, visionModelId: e.target.value }))
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {availableModels.visionModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label
                htmlFor="textModel"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Text-Only Model
              </label>
              <select
                id="textModel"
                value={settings.textModelId}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, textModelId: e.target.value }))
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {availableModels.textModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
          </div>
        )}

        {/* Validate & Save Button */}
        <button
          onClick={handleValidateAndSave}
          disabled={isValidating || (needsApiKey && !settings.apiKey)}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          {isValidating ? 'Validating...' : 'Validate & Save'}
        </button>

        {/* Status Indicator */}
        {apiKeyStatus === 'checking' && (
          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            Checking connection...
          </p>
        )}
        {apiKeyStatus === 'valid' && (
          <p className="mt-4 text-center text-sm text-green-600 dark:text-green-400">
            ✓ Configuration valid
          </p>
        )}
      </div>
    </div>
  );
}
