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

interface RewriteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    selectedText: string;
    prompt: string;
    setPrompt: (value: string) => void;
    isRewriting: boolean;
}

export default function RewriteModal({ isOpen, onClose, onSubmit, selectedText, prompt, setPrompt, isRewriting }: RewriteModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Edit with GenAI</h2>
                </div>
                <div className="modal-body">
                    <div>
                        <label>Selected Text:</label>
                        <div className="selected-text-preview">
                            <p>{selectedText}</p>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="rewrite-prompt">How should I rewrite this?</label>
                        <textarea
                            id="rewrite-prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., Make this more concise, simplify the language, add an example..."
                            rows={3}
                            disabled={isRewriting}
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button onClick={onClose} disabled={isRewriting}>Cancel</button>
                    <button className="primary" onClick={onSubmit} disabled={isRewriting || !prompt.trim()}>
                        {isRewriting ? 'Rewriting...' : 'Rewrite'}
                    </button>
                </div>
            </div>
        </div>
    );
}
