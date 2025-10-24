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

import React, { useState } from 'react';
import c from 'classnames';
import { DiarizedSegment, Caption } from './api';
import { exportToAss, exportToJson, downloadFile } from './exportUtils';

interface TranscriptEditorProps {
    transcript: DiarizedSegment[];
    captions: Caption[];
    onTranscriptChange: (newTranscript: DiarizedSegment[]) => void;
    onCaptionsChange: (newCaptions: Caption[]) => void;
}

export default function TranscriptEditor({ transcript, captions, onTranscriptChange, onCaptionsChange }: TranscriptEditorProps) {
    const [activeTab, setActiveTab] = useState<'transcript' | 'captions'>('transcript');

    const handleTranscriptSegmentChange = (index: number, field: 'speaker' | 'text', value: string) => {
        const newTranscript = [...transcript];
        newTranscript[index] = { ...newTranscript[index], [field]: value };
        onTranscriptChange(newTranscript);
    };
    
    const handleCaptionChange = (index: number, value: string) => {
        const newCaptions = [...captions];
        newCaptions[index] = { ...newCaptions[index], text: value };
        onCaptionsChange(newCaptions);
    };

    const handleExport = (format: 'ass' | 'json') => {
        if (format === 'ass') {
            const content = exportToAss(transcript, captions);
            downloadFile('transcript.ass', content, 'text/plain;charset=utf-8');
        } else {
            const content = exportToJson(transcript, captions);
            downloadFile('transcript.json', content, 'application/json');
        }
    };

    return (
        <div className="transcript-editor">
            <div className="editor-toolbar">
                <div className="tabs">
                    <button className={c({active: activeTab === 'transcript'})} onClick={() => setActiveTab('transcript')}>Diarized Transcript</button>
                    <button className={c({active: activeTab === 'captions'})} onClick={() => setActiveTab('captions')}>A/V Captions</button>
                </div>
                <div className="actions">
                    <button onClick={() => handleExport('json')}><span className="icon">code</span> Export as .json</button>
                    <button onClick={() => handleExport('ass')}><span className="icon">subtitles</span> Export as .ass</button>
                </div>
            </div>
            <div className="editor-content-area">
                {activeTab === 'transcript' && (
                    <div className="segment-list">
                        {transcript.map((segment, index) => (
                            <div key={index} className="transcript-segment">
                                <div className="timecodes">{segment.startTime} - {segment.endTime}</div>
                                <input 
                                    className="speaker-input"
                                    type="text" 
                                    value={segment.speaker} 
                                    onChange={(e) => handleTranscriptSegmentChange(index, 'speaker', e.target.value)}
                                    aria-label={`Speaker for segment ${index + 1}`}
                                />
                                <textarea 
                                    className="text-input"
                                    value={segment.text}
                                    onChange={(e) => handleTranscriptSegmentChange(index, 'text', e.target.value)}
                                    rows={2}
                                    aria-label={`Text for segment ${index + 1}`}
                                />
                            </div>
                        ))}
                    </div>
                )}
                {activeTab === 'captions' && (
                     <div className="segment-list">
                        {captions.map((caption, index) => (
                            <div key={index} className="caption-segment">
                                <div className="timecodes">{caption.startTime} - {caption.endTime}</div>
                                <textarea 
                                    className="text-input full-width"
                                    value={caption.text}
                                    onChange={(e) => handleCaptionChange(index, e.target.value)}
                                    rows={2}
                                    aria-label={`Caption text ${index + 1}`}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}