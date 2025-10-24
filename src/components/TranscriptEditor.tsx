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
import { DiarizedSegment, Caption } from '../types';
import { exportToAss, exportToJson, downloadFile } from '../utils/exportUtils';

interface TranscriptEditorProps {
    transcript: DiarizedSegment[];
    captions: Caption[];
    onTranscriptChange: (newTranscript: DiarizedSegment[]) => void;
    onCaptionsChange: (newCaptions: Caption[]) => void;
}

export default function TranscriptEditor({ transcript, captions, onTranscriptChange, onCaptionsChange }: TranscriptEditorProps) {
    const [activeTab, setActiveTab] = useState<'transcript' | 'captions'>('transcript');

    const handleTranscriptSegmentChange = (index: number, field: keyof DiarizedSegment, value: string) => {
        const newTranscript = [...transcript];
        newTranscript[index] = { ...newTranscript[index], [field]: value };
        onTranscriptChange(newTranscript);
    };
    
    const handleCaptionChange = (index: number, field: keyof Caption, value: string) => {
        const newCaptions = [...captions];
        newCaptions[index] = { ...newCaptions[index], [field]: value };
        onCaptionsChange(newCaptions);
    };

    const handleAddTranscriptSegment = () => {
        const lastSegment = transcript[transcript.length - 1];
        const newSegment: DiarizedSegment = {
            speaker: lastSegment?.speaker || 'Speaker 1',
            startTime: lastSegment?.endTime || '00:00:00.000',
            endTime: lastSegment?.endTime || '00:00:00.000',
            text: '',
        };
        onTranscriptChange([...transcript, newSegment]);
    };

    const handleRemoveTranscriptSegment = (index: number) => {
        onTranscriptChange(transcript.filter((_, i) => i !== index));
    };

    const handleAddCaption = () => {
        const lastCaption = captions[captions.length - 1];
        const newCaption: Caption = {
            startTime: lastCaption?.endTime || '00:00:00.000',
            endTime: lastCaption?.endTime || '00:00:00.000',
            text: '',
        };
        onCaptionsChange([...captions, newCaption]);
    };

    const handleRemoveCaption = (index: number) => {
        onCaptionsChange(captions.filter((_, i) => i !== index));
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
                    {activeTab === 'transcript' && <button onClick={handleAddTranscriptSegment}><span className="icon">add</span> Add Segment</button>}
                    {activeTab === 'captions' && <button onClick={handleAddCaption}><span className="icon">add</span> Add Caption</button>}
                    <button onClick={() => handleExport('json')}><span className="icon">code</span> Export as .json</button>
                    <button onClick={() => handleExport('ass')}><span className="icon">subtitles</span> Export as .ass</button>
                </div>
            </div>
            <div className="editor-content-area">
                {activeTab === 'transcript' && (
                    <div className="segment-list">
                        {transcript.map((segment, index) => (
                            <div key={index} className="transcript-segment">
                                <div className="timecode-inputs">
                                    <input type="text" value={segment.startTime} onChange={(e) => handleTranscriptSegmentChange(index, 'startTime', e.target.value)} aria-label={`Start time for segment ${index + 1}`} />
                                    <span>-</span>
                                    <input type="text" value={segment.endTime} onChange={(e) => handleTranscriptSegmentChange(index, 'endTime', e.target.value)} aria-label={`End time for segment ${index + 1}`} />
                                </div>
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
                                <button className="remove-button" onClick={() => handleRemoveTranscriptSegment(index)} aria-label={`Remove segment ${index + 1}`}>
                                    <span className="icon">delete</span>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {activeTab === 'captions' && (
                     <div className="segment-list">
                        {captions.map((caption, index) => (
                            <div key={index} className="caption-segment">
                                <div className="timecode-inputs">
                                    <input type="text" value={caption.startTime} onChange={(e) => handleCaptionChange(index, 'startTime', e.target.value)} aria-label={`Start time for caption ${index + 1}`} />
                                    <span>-</span>
                                    <input type="text" value={caption.endTime} onChange={(e) => handleCaptionChange(index, 'endTime', e.target.value)} aria-label={`End time for caption ${index + 1}`} />
                                </div>
                                <textarea 
                                    className="text-input"
                                    value={caption.text}
                                    onChange={(e) => handleCaptionChange(index, 'text', e.target.value)}
                                    rows={2}
                                    aria-label={`Caption text ${index + 1}`}
                                />
                                <button className="remove-button" onClick={() => handleRemoveCaption(index)} aria-label={`Remove caption ${index + 1}`}>
                                    <span className="icon">delete</span>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}