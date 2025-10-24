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

import React, { useState, useEffect } from 'react';
import c from 'classnames';
import StyledMarkdown from './StyledMarkdown';
import MermaidRenderer from './MermaidRenderer'; 

type ContentFormat = 'guide' | 'article' | 'diagram' | 'slides';

interface MarkdownEditorProps {
    initialContent: string;
    format: ContentFormat;
    theme: string;
    onContentChange: (newContent: string) => void;
}

function MarkdownEditor({ initialContent, format, theme, onContentChange }: MarkdownEditorProps) {
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('preview');
    const [content, setContent] = useState(initialContent);

    useEffect(() => {
        setContent(initialContent);
        // When new content is generated, switch back to preview
        setActiveTab('preview'); 
    }, [initialContent]);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        onContentChange(newContent);
    };

    return (
        <div className="markdown-editor">
            <div className="editor-tabs">
                <button 
                    className={c('tab-button', { active: activeTab === 'edit' })} 
                    onClick={() => setActiveTab('edit')}
                    aria-pressed={activeTab === 'edit'}
                >
                    Edit
                </button>
                <button 
                    className={c('tab-button', { active: activeTab === 'preview' })} 
                    onClick={() => setActiveTab('preview')}
                    aria-pressed={activeTab === 'preview'}
                >
                    Preview
                </button>
            </div>
            <div className="editor-content">
                {activeTab === 'edit' ? (
                    <textarea
                        value={content}
                        onChange={handleContentChange}
                        className="editor-textarea"
                        aria-label="Markdown content editor"
                    />
                ) : (
                    <div className="editor-preview" aria-label="Markdown content preview">
                        {format === 'diagram' ? (
                            <MermaidRenderer content={content} theme={theme} />
                        ) : (
                            <StyledMarkdown content={content} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MarkdownEditor;