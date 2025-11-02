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
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-[--background] p-6 rounded-xl w-full max-w-xl shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="border-b border-[--border] pb-4 mb-4">
                    <h2 className="text-xl border-none p-0 m-0">Edit with GenAI</h2>
                </div>
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block mb-2 text-sm">Selected Text:</label>
                        <div className="max-h-36 overflow-y-auto bg-[--background-secondary] p-3 rounded-lg border border-[--border] text-sm whitespace-pre-wrap break-words">
                            <p>{selectedText}</p>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="rewrite-prompt" className="block mb-2 text-sm">How should I rewrite this?</label>
                        <textarea
                            id="rewrite-prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., Make this more concise, simplify the language..."
                            rows={3}
                            disabled={isRewriting}
                            className="w-full bg-[--background] text-[--text] border border-[--border] rounded-lg px-4 py-2 text-sm focus:border-blue-500 focus:outline-none resize-y"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-[--border]">
                    <button onClick={onClose} disabled={isRewriting} className="px-4 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary] disabled:opacity-50">Cancel</button>
                    <button onClick={onSubmit} disabled={isRewriting || !prompt.trim()} className="px-4 py-2 text-sm bg-[--primary-light] dark:bg-[--primary-dark] text-[--primary-text-light] dark:text-[--primary-text-dark] border-none rounded-lg hover:opacity-90 disabled:opacity-50">
                        {isRewriting ? 'Rewriting...' : 'Rewrite'}
                    </button>
                </div>
            </div>
        </div>
    );
}
