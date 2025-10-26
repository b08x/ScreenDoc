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

import React from 'react';

interface ContextModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    description: string;
    setDescription: (value: string) => void;
    prompt: string;
    setPrompt: (value: string) => void;
    skipAudio: boolean;
    setSkipAudio: (value: boolean) => void;
}

const PROMPT_EXAMPLES = [
  'Focus on any technical jargon used and define it.',
  'Identify the main goal of the user in this video.',
  'List all the keyboard shortcuts used.',
];

export default function ContextModal({ isOpen, onClose, onSubmit, description, setDescription, prompt, setPrompt, skipAudio, setSkipAudio }: ContextModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Add Context & Instructions</h2>
                </div>
                <div className="modal-body">
                    <div>
                        <label htmlFor="video-description">Video Description (Optional)</label>
                        <input
                            id="video-description"
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g., A tutorial on setting up a new project"
                        />
                    </div>
                    <div>
                        <label htmlFor="user-prompt">User Prompt (Optional)</label>
                        <textarea
                            id="user-prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Give specific instructions to the AI for the initial analysis..."
                            rows={4}
                        />
                         <div className="prompt-examples" style={{marginTop: '0.5rem'}}>
                            {PROMPT_EXAMPLES.map((p) => (
                            <button key={p} onClick={() => setPrompt(p)}>
                                {p}
                            </button>
                            ))}
                        </div>
                    </div>
                    <div className="skip-audio-checkbox">
                        <input
                            id="skip-audio-processing"
                            type="checkbox"
                            checked={skipAudio}
                            onChange={(e) => setSkipAudio(e.target.checked)}
                        />
                        <label htmlFor="skip-audio-processing">
                            Skip audio transcription (visual captions only)
                        </label>
                    </div>
                </div>
                <div className="modal-footer">
                    <button onClick={onClose}>Cancel</button>
                    <button className="primary" onClick={onSubmit}>
                        Start Processing
                    </button>
                </div>
            </div>
        </div>
    );
}
