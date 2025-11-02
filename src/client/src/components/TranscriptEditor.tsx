import React, { useState } from 'react';
import { useAppStore } from '../store';
import { DiarizedSegment, Caption } from '../types';
import { exportToAss, exportToJson, downloadFile } from '../utils/exportUtils';

export default function TranscriptEditor() {
    const { diarizedTranscript, timecodedCaptions, setDiarizedTranscript, setTimecodedCaptions } = useAppStore(state => ({
        diarizedTranscript: state.diarizedTranscript,
        timecodedCaptions: state.timecodedCaptions,
        setDiarizedTranscript: state.setDiarizedTranscript,
        setTimecodedCaptions: state.setTimecodedCaptions,
    }));
    const [activeTab, setActiveTab] = useState<'transcript' | 'captions'>('transcript');

    const handleTranscriptChange = (index: number, field: keyof DiarizedSegment, value: string) => {
        const newTranscript = [...diarizedTranscript];
        newTranscript[index] = { ...newTranscript[index], [field]: value };
        setDiarizedTranscript(newTranscript);
    };
    
    const handleCaptionChange = (index: number, field: keyof Caption, value: string) => {
        const newCaptions = [...timecodedCaptions];
        newCaptions[index] = { ...newCaptions[index], [field]: value };
        setTimecodedCaptions(newCaptions);
    };

    const addTranscriptSegment = () => {
        const last = diarizedTranscript[diarizedTranscript.length - 1];
        setDiarizedTranscript([...diarizedTranscript, { speaker: last?.speaker || 'Speaker 1', startTime: last?.endTime || '00:00:00.000', endTime: last?.endTime || '00:00:00.000', text: '' }]);
    };
    const removeTranscriptSegment = (index: number) => setDiarizedTranscript(diarizedTranscript.filter((_, i) => i !== index));

    const addCaption = () => {
        const last = timecodedCaptions[timecodedCaptions.length - 1];
        setTimecodedCaptions([...timecodedCaptions, { startTime: last?.endTime || '00:00:00.000', endTime: last?.endTime || '00:00:00.000', text: '' }]);
    };
    const removeCaption = (index: number) => setTimecodedCaptions(timecodedCaptions.filter((_, i) => i !== index));

    const handleExport = (format: 'ass' | 'json') => {
        const content = format === 'ass' ? exportToAss(diarizedTranscript, timecodedCaptions) : exportToJson(diarizedTranscript, timecodedCaptions);
        downloadFile(`transcript.${format}`, content, format === 'ass' ? 'text/plain' : 'application/json');
    };

    const renderTranscript = () => (
        <div className="space-y-4">
            {diarizedTranscript.map((segment, index) => (
                <div key={index} className="grid grid-cols-[180px_120px_1fr_40px] gap-2 items-center">
                    <div className="flex items-center gap-1 text-xs text-[--text-light]">
                        <input type="text" value={segment.startTime} onChange={e => handleTranscriptChange(index, 'startTime', e.target.value)} className="w-full text-center p-2 text-xs border border-[--border] rounded-md bg-[--background] focus:border-blue-500 focus:outline-none" />
                        -
                        <input type="text" value={segment.endTime} onChange={e => handleTranscriptChange(index, 'endTime', e.target.value)} className="w-full text-center p-2 text-xs border border-[--border] rounded-md bg-[--background] focus:border-blue-500 focus:outline-none" />
                    </div>
                    <input type="text" value={segment.speaker} onChange={e => handleTranscriptChange(index, 'speaker', e.target.value)} className="w-full p-2 text-sm border border-[--border] rounded-md bg-[--background] focus:border-blue-500 focus:outline-none" />
                    <textarea value={segment.text} onChange={e => handleTranscriptChange(index, 'text', e.target.value)} rows={2} className="w-full p-2 text-sm border border-[--border] rounded-md min-h-[40px] leading-snug resize-y bg-[--background] focus:border-blue-500 focus:outline-none" />
                    <button onClick={() => removeTranscriptSegment(index)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[--background-secondary] text-[--text-light] hover:text-red-500"><span className="material-symbols-outlined text-xl">delete</span></button>
                </div>
            ))}
        </div>
    );
    
    const renderCaptions = () => (
         <div className="space-y-4">
            {timecodedCaptions.map((caption, index) => (
                <div key={index} className="grid grid-cols-[180px_1fr_40px] gap-2 items-center">
                    <div className="flex items-center gap-1 text-xs text-[--text-light]">
                        <input type="text" value={caption.startTime} onChange={e => handleCaptionChange(index, 'startTime', e.target.value)} className="w-full text-center p-2 text-xs border border-[--border] rounded-md bg-[--background] focus:border-blue-500 focus:outline-none" />
                        -
                        <input type="text" value={caption.endTime} onChange={e => handleCaptionChange(index, 'endTime', e.target.value)} className="w-full text-center p-2 text-xs border border-[--border] rounded-md bg-[--background] focus:border-blue-500 focus:outline-none" />
                    </div>
                    <textarea value={caption.text} onChange={e => handleCaptionChange(index, 'text', e.target.value)} rows={2} className="w-full p-2 text-sm border border-[--border] rounded-md min-h-[40px] leading-snug resize-y bg-[--background] focus:border-blue-500 focus:outline-none" />
                    <button onClick={() => removeCaption(index)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[--background-secondary] text-[--text-light] hover:text-red-500"><span className="material-symbols-outlined text-xl">delete</span></button>
                </div>
            ))}
        </div>
    );

    return (
        <div className="border border-[--border] rounded-lg overflow-hidden flex flex-col max-h-[400px] bg-[--background]">
            <div className="flex justify-between items-center bg-[--background-secondary] border-b border-[--border] px-2">
                <div className="flex">
                    <button onClick={() => setActiveTab('transcript')} className={`border-b-2 px-4 py-2 text-sm ${activeTab === 'transcript' ? 'border-blue-500 text-[--text]' : 'border-transparent text-[--text-light]'}`}>Diarized Transcript</button>
                    <button onClick={() => setActiveTab('captions')} className={`border-b-2 px-4 py-2 text-sm ${activeTab === 'captions' ? 'border-blue-500 text-[--text]' : 'border-transparent text-[--text-light]'}`}>A/V Captions</button>
                </div>
                <div className="flex gap-2">
                    {activeTab === 'transcript' ? <button onClick={addTranscriptSegment} className="text-xs px-2 py-1 border border-[--border] rounded-md hover:bg-white dark:hover:bg-gray-700 inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm">add</span> Add</button> : <button onClick={addCaption} className="text-xs px-2 py-1 border border-[--border] rounded-md hover:bg-white dark:hover:bg-gray-700 inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm">add</span> Add</button>}
                    <button onClick={() => handleExport('json')} className="text-xs px-2 py-1 border border-[--border] rounded-md hover:bg-white dark:hover:bg-gray-700 inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm">code</span> .json</button>
                    <button onClick={() => handleExport('ass')} className="text-xs px-2 py-1 border border-[--border] rounded-md hover:bg-white dark:hover:bg-gray-700 inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm">subtitles</span> .ass</button>
                </div>
            </div>
            <div className="overflow-y-auto p-4 bg-[--background]">
                {activeTab === 'transcript' ? renderTranscript() : renderCaptions()}
            </div>
        </div>
    );
}
