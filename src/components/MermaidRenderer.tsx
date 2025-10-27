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

import {useRef, useState, useEffect} from 'react';
import mermaid from 'mermaid';

function MermaidRenderer({ content, theme }: { content: string, theme: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
    });

    const renderDiagram = async () => {
      if (content && containerRef.current) {
        setError('');
        containerRef.current.innerHTML = ''; // Clear previous render
        try {
          const {svg} = await mermaid.render('mermaid-graph', content);
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        } catch (e) {
          setError("Could not render the diagram. The generated syntax might be invalid.");
        }
      }
    };
    renderDiagram();
  }, [content, theme]);

  if (error) {
    return <div className="error-message">{error}</div>
  }

  return <div ref={containerRef} className="mermaid-content"></div>;
}

export default MermaidRenderer;