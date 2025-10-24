/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
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

export const timeToSecs = (timecode: string): number => {
  if (!timecode) return 0;
  const parts = timecode.split(':');

  if (parts.length === 2) { // MM:SS.ms
    const ssms = parts[1].split('.').map(parseFloat);
    const seconds = ssms[0] || 0;
    const ms = ssms[1] || 0;
    return parseFloat(parts[0]) * 60 + seconds + ms / 1000;
  }

  if (parts.length === 3) { // HH:MM:SS.ms
    const ssms = parts[2].split('.').map(parseFloat);
    const seconds = ssms[0] || 0;
    const ms = ssms[1] || 0;
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + seconds + ms / 1000;
  }

  return 0;
};