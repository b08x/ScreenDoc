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

// A simple markdown to HTML converter component
function StyledMarkdown({content}: {content: string}) {
  const convertMarkdownToHTML = (text: string) => {
    if (!text) return '';

    const processChunk = (chunk: string) => {
        let html = chunk
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
        // Italic
        html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
        // Lists
        html = html.replace(/^\s*[-*] (.*)/gim, '<li>$1</li>');
        html = html.replace(/<li>/g, '<ul><li>');
        html = html.replace(/<\/li>\n<ul>/g, '</li><li>');
        html = html.replace(/<\/li>\n((?!<li>).)/g, '</li></ul>\n$1');
        html = html.replace(/<\/li>$/, '</li></ul>');
        // Numbered Lists
        html = html.replace(/^\s*\d+\. (.*)/gim, '<li>$1</li>');
        html = html.replace(/<li>/g, '<ol><li>');
        html = html.replace(/<\/li>\n<ol>/g, '</li><li>');
        html = html.replace(/<\/li>\n((?!<li>).)/g, '</li></ul>\n$1');
        html = html.replace(/<\/li>$/, '</li></ul>');
        // Image placeholders
        html = html.replace(
            /\[Image: (.*?)(?:\s+at\s+[0-9:.]+)?\]/gim,
            '<div class="image-placeholder">🖼️ $1</div>',
        );
        // Newlines
        html = html.replace(/\n/g, '<br />');
        return html;
    };
    
    // Check if the content is meant to be slides
    if (/\n---\n/.test(text)) {
        const slides = text.split(/\n---\n/);
        return slides.map((slideContent, index) => {
            const slideHtml = processChunk(slideContent.trim());
            return `<div class="slide"><div class="slide-number">${index + 1}</div><div class="slide-content">${slideHtml}</div></div>`;
        }).join('');
    }

    // Otherwise, process as a single block of content
    return processChunk(text);
  };

  return (
    <div
      className="markdown-content"
      dangerouslySetInnerHTML={{__html: convertMarkdownToHTML(content)}}
    />
  );
}

export default StyledMarkdown;