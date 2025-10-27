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
import { Streamdown } from 'streamdown';

interface StyledMarkdownProps {
  content: string;
  theme?: string;
  isSlides?: boolean;
  parseIncomplete?: boolean;
}

// Custom component to handle image placeholders
const ImagePlaceholder = ({ children }: { children?: React.ReactNode }) => (
  <div className="image-placeholder">🖼️ {children}</div>
);

function StyledMarkdown({
  content,
  theme = 'light',
  isSlides = false,
  parseIncomplete = true
}: StyledMarkdownProps) {

  // Process content to replace image placeholders
  const processContent = (text: string) => {
    if (!text) return '';
    // Replace [Image: description at timestamp] with markdown that uses custom component
    return text.replace(
      /\[Image: (.*?)(?:\s+at\s+[0-9:.]+)?\]/gim,
      '![Image Placeholder]($1)'
    );
  };

  // Check if content should be rendered as slides
  if (isSlides && /\n---\n/.test(content)) {
    const slides = content.split(/\n---\n/);
    return (
      <>
        {slides.map((slideContent, index) => (
          <div className="slide" key={index}>
            <div className="slide-number">{index + 1}</div>
            <div className="slide-content">
              <Streamdown
                parseIncompleteMarkdown={parseIncomplete}
                components={{
                  img: ImagePlaceholder
                }}
                mermaidConfig={{
                  theme: theme === 'dark' ? 'dark' : 'default'
                }}
              >
                {processContent(slideContent.trim())}
              </Streamdown>
            </div>
          </div>
        ))}
      </>
    );
  }

  // Regular markdown rendering
  return (
    <div className="markdown-content">
      <Streamdown
        parseIncompleteMarkdown={parseIncomplete}
        components={{
          img: ImagePlaceholder
        }}
        mermaidConfig={{
          theme: theme === 'dark' ? 'dark' : 'default'
        }}
      >
        {processContent(content)}
      </Streamdown>
    </div>
  );
}

export default StyledMarkdown;
