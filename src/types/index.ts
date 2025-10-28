/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// Copyright 2024 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export interface Caption {
  startTime: string; // e.g., "00:01:23.456"
  endTime: string;
  text: string;
}

export interface DiarizedSegment {
  speaker: string;
  startTime: string; // e.g., "00:01:23.456"
  endTime: string;
  text: string;
}

/**
 * AI Provider types derived from PROVIDERS constant
 */
import type { PROVIDERS } from '../constants';
export type Provider = keyof typeof PROVIDERS;

/**
 * Application settings for AI provider configuration
 */
export interface Settings {
  provider: Provider;
  apiKey: string;
  baseURL?: string;
  visionModelId: string;
  textModelId: string;
  fetchModelsOnLoad: boolean;
}

/**
 * Model definition with capability flags
 */
export interface ModelDefinition {
  id: string;
  name: string;
  supportsVision: boolean;
  supportsText: boolean;
}

/**
 * Stored model data with metadata
 */
export interface StoredModelData {
  provider: Provider;
  models: ModelDefinition[];
  lastFetched: string; // ISO 8601 timestamp
}

/**
 * API key validation status
 */
export type ApiKeyStatus = 'unchecked' | 'valid' | 'invalid' | 'checking';