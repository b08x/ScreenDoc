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
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-[--background] p-6 rounded-xl w-full max-w-xl shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="border-b border-[--border] pb-4 mb-4">
                    <h2 className="text-xl border-none p-0 m-0">Add Context & Instructions</h2>
                </div>
                <div className="flex flex-col gap-4">
                    <div>
                        <label htmlFor="video-description" className="block mb-2 text-sm">Video Description (Optional)</label>
                        <input
                            id="video-description"
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g., A tutorial on setting up a new project"
                            className="w-full bg-[--background] text-[--text] border border-[--border] rounded-lg px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="user-prompt" className="block mb-2 text-sm">User Prompt (Optional)</label>
                        <textarea
                            id="user-prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Give specific instructions to the AI..."
                            rows={4}
                            className="w-full bg-[--background] text-[--text] border border-[--border] rounded-lg px-4 py-2 text-sm focus:border-blue-500 focus:outline-none resize-y"
                        />
                         <div className="flex flex-wrap gap-2 mt-2">
                            {PROMPT_EXAMPLES.map((p) => (
                            <button key={p} onClick={() => setPrompt(p)} className="text-xs px-2 py-1 border border-[--border] rounded-md hover:bg-[--background-secondary]">
                                {p}
                            </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[--border]">
                        <input id="skip-audio" type="checkbox" checked={skipAudio} onChange={(e) => setSkipAudio(e.target.checked)} className="h-4 w-4 rounded accent-blue-500 cursor-pointer" />
                        <label htmlFor="skip-audio" className="text-sm cursor-pointer select-none">Skip audio transcription (visual captions only)</label>
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-[--border]">
                    <button onClick={onClose} className="px-4 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary]">Cancel</button>
                    <button className="px-4 py-2 text-sm bg-[--primary-light] dark:bg-[--primary-dark] text-[--primary-text-light] dark:text-[--primary-text-dark] border-none rounded-lg hover:opacity-90" onClick={onSubmit}>
                        Start Processing
                    </button>
                </div>
            </div>
        </div>
    );
}
