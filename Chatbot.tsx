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

import React, { useState, useRef, useEffect } from 'react';

// Define message types
interface GroundingSource {
    uri: string;
    title: string;
}
interface Message {
  id: number;
  sender: 'user' | 'bot';
  text: string;
  sources?: GroundingSource[];
}

interface ContextMessage {
  id: number;
  text: string;
}

interface ChatbotProps {
  messages: Message[];
  selectedContext: ContextMessage[];
  isBotReplying: boolean;
  generatedContentExists: boolean;
  onSendMessage: (message: string) => void;
  onAddContext: (message: Message) => void;
  onRemoveContext: (id: number) => void;
}

export default function Chatbot({
  messages,
  selectedContext,
  isBotReplying,
  generatedContentExists,
  onSendMessage,
  onAddContext,
  onRemoveContext
}: ChatbotProps) {
  const [userInput, setUserInput] = useState('');
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom of chat history when new messages are added
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSend = () => {
    if (userInput.trim() && !isBotReplying) {
      onSendMessage(userInput.trim());
      setUserInput('');
    }
  };

  const isMessageInContext = (messageId: number) => {
    return selectedContext.some(ctx => ctx.id === messageId);
  }

  return (
    <div className="chatbot-container">
      <div className="chatbot-context-area">
        <h3>Context for Generation</h3>
        {selectedContext.length === 0 ? (
          <p className="light-text">Select bot messages to use as context when generating documentation.</p>
        ) : (
          <div className="context-messages">
            {selectedContext.map(ctx => (
              <div key={ctx.id} className="context-message">
                <p>{ctx.text}</p>
                <button onClick={() => onRemoveContext(ctx.id)} className="remove-context-btn" aria-label="Remove context message">
                  <span className="icon">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="chatbot-chat-area">
        <div className="chat-history" ref={chatHistoryRef}>
          {messages.length === 0 && (
              <div className="empty-output">
                  <p>Ask a question to get started.</p>
              </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.sender}`}>
              <div className="message-content">
                <p>{msg.text}</p>
                {msg.sources && msg.sources.length > 0 && (
                    <div className="message-sources">
                        <strong>Sources:</strong>
                        <ol>
                            {msg.sources.map((source, index) => (
                                <li key={index}>
                                    <a href={source.uri} target="_blank" rel="noopener noreferrer">
                                        {source.title || source.uri}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
                {msg.sender === 'bot' && !isMessageInContext(msg.id) && (
                  <button className="add-context-btn" onClick={() => onAddContext(msg)}>
                     <span className="icon">add</span> Add to Context
                  </button>
                )}
              </div>
            </div>
          ))}
          {isBotReplying && (
            <div className="chat-message bot">
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="chat-input-area">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={generatedContentExists ? "Ask a question or request an edit..." : "Ask a question..."}
            disabled={isBotReplying}
            aria-label="Chat input"
          />
          <button onClick={handleSend} disabled={isBotReplying || !userInput.trim()} aria-label="Send message">
            <span className="icon">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}