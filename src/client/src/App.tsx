import React, { useRef, useState, useEffect } from 'react';
import JSZip from 'jszip';
import mermaid from 'mermaid';
import MarkdownPreview from '@uiw/react-markdown-preview';
import rehypeMermaid from 'rehype-mermaid';
import { timeToSecs } from './utils/utils';
import { useAppStore } from './store';
import { markdownToRtf, downloadFile, exportToAss, exportToJson } from './utils/exportUtils';
import VideoPlayer from './components/VideoPlayer';
import TranscriptEditor from './components/TranscriptEditor';
import ContextModal from './components/ContextModal';
import RewriteModal from './components/RewriteModal';

const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const extractFrame = (videoUrl: string, time: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.style.display = 'none';
    video.muted = true;
    video.crossOrigin = 'anonymous';

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          document.body.removeChild(video);
          if (blob) resolve(blob);
          else reject(new Error('Canvas to Blob conversion failed.'));
        }, 'image/png');
      } else {
        document.body.removeChild(video);
        reject(new Error('Could not get canvas context.'));
      }
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.max(0, Math.min(time, video.duration));
    };
    video.onerror = () => {
      document.body.removeChild(video);
      reject(new Error(`Video loading error: ${video.error?.message || 'unknown'}`));
    };

    video.src = videoUrl;
    document.body.appendChild(video);
  });
};

export default function App() {
  const store = useAppStore();
  // FIX: Explicitly type the theme state with 'light' | 'dark' and add a check for the value from localStorage to prevent type widening to 'string'.
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
    return 'light';
  });
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [localDescription, setLocalDescription] = useState('');
  const [localPrompt, setLocalPrompt] = useState('');
  const [skipAudio, setSkipAudio] = useState(false);
  const [isRewriteModalOpen, setIsRewriteModalOpen] = useState(false);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [rewritePrompt, setRewritePrompt] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('theme', theme);
    mermaid.initialize({ startOnLoad: false, theme: theme === 'dark' ? 'dark' : 'default' });
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      store.resetState();
      useAppStore.setState({ error: `File is too large. Max size: ${MAX_FILE_SIZE_MB}MB.` });
      return;
    }
    setPendingFile(file);
    setIsContextModalOpen(true);
  };

  const startProcessing = async () => {
    if (!pendingFile) return;
    setIsContextModalOpen(false);
    await store.startProcessing(pendingFile, localDescription, localPrompt, skipAudio);
    setPendingFile(null);
    setLocalDescription('');
    setLocalPrompt('');
  };

  const handleRecord = async (type: 'screen' | 'camera' | 'audio') => {
    try {
      const displayMediaOptions = { video: true, audio: true, selfBrowserSurface: 'exclude', systemAudio: 'include', surfaceSwitching: 'include' };
      const stream = type === 'screen' ? await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
        : type === 'camera' ? await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          : await navigator.mediaDevices.getUserMedia({ audio: true });

      useAppStore.setState({ isRecording: true });
      const recordedChunks: Blob[] = [];
      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = e => e.data.size > 0 && recordedChunks.push(e.data);
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        handleFileSelect(new File([blob], 'recording.webm', { type: 'video/webm' }));
        useAppStore.setState({ isRecording: false });
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.current.start();
    } catch (err) {
      useAppStore.setState({ error: 'Could not start recording. Please ensure permissions are granted.', isRecording: false });
    }
  };

  const stopRecording = () => mediaRecorder.current?.stop();

  const handleRewrite = async () => {
    if (!selectionRange || !rewritePrompt) return;
    setIsRewriting(true);
    const selectedText = store.generatedContent.substring(selectionRange.start, selectionRange.end);
    const rewritten = await store.rewriteText(selectedText, rewritePrompt);
    if (rewritten) {
      const newContent = store.generatedContent.substring(0, selectionRange.start) + rewritten + store.generatedContent.substring(selectionRange.end);
      store.setGeneratedContent(newContent);
    }
    setIsRewriting(false);
    setIsRewriteModalOpen(false);
    setRewritePrompt('');
    setSelectionRange(null);
  };

  const handleExportZip = async () => {
    if (!store.generatedContent || !store.videoUrl || store.outputFormat === 'diagram') return;
    useAppStore.setState({ isZipping: true, error: '' });
    try {
      const zip = new JSZip();
      let updatedContent = store.generatedContent;
      const imagePlaceholders = [...store.generatedContent.matchAll(/\[Image: (.*?)(?:\s+at\s+([0-9:.]+))?\]/gi)];
      if (imagePlaceholders.length > 0) {
        const imagesFolder = zip.folder("images")!;
        const replacements = await Promise.all(imagePlaceholders.map(async (match, index) => {
          const [placeholder, description, timecode] = match;
          if (timecode) {
            try {
              const blob = await extractFrame(store.videoUrl, timeToSecs(timecode));
              const imageName = `image-${index + 1}.png`;
              imagesFolder.file(imageName, blob);
              return { placeholder, replacementText: `![${description}](./images/${imageName})` };
            } catch (e) { console.warn(`Failed to extract frame: ${placeholder}`, e); }
          }
          return null;
        }));
        replacements.filter(Boolean).forEach(rep => {
          updatedContent = updatedContent.replace(rep!.placeholder, rep!.replacementText);
        });
      }
      zip.file('guide.md', updatedContent);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadFile('ScreenGuide-Export.zip', zipBlob, 'application/zip');
    } catch (e) {
      useAppStore.setState({ error: 'Failed to create zip file.' });
    } finally {
      useAppStore.setState({ isZipping: false });
    }
  };

  const handleExportSessionData = async () => {
    useAppStore.setState({ isZipping: true, error: '' });
    try {
      const zip = new JSZip();
      zip.file("session.json", JSON.stringify({
        userContext: { videoDescription: store.videoDescription, userPrompt: store.userPrompt },
        rawData: { diarizedTranscript: store.diarizedTranscript, timecodedCaptions: store.timecodedCaptions },
        generatedOutput: { format: store.outputFormat, content: store.generatedContent },
        timestamp: new Date().toISOString(),
      }, null, 2));

      if (store.videoFile) zip.folder("video")!.file(store.videoFile.name, store.videoFile);

      const subtitlesFolder = zip.folder("subtitles")!;
      subtitlesFolder.file('transcript.ass', exportToAss(store.diarizedTranscript, store.timecodedCaptions));
      subtitlesFolder.file('transcript.json', exportToJson(store.diarizedTranscript, store.timecodedCaptions));

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadFile('ScreenGuide-Session.zip', zipBlob, 'application/zip');
    } catch (e) {
      useAppStore.setState({ error: 'Failed to create session zip file.' });
    } finally {
      useAppStore.setState({ isZipping: false });
    }
  };

  const isLoading = store.isProcessingVideo || store.isGenerating;
  const processContentForPreview = (content: string) => content.replace(
    /\[Image: (.*?)(?:\s+at\s+[0-9:.]+)?\]/gim,
    '<div class="border border-dashed border-[--dashed-border] bg-[--background-secondary] p-4 rounded-lg my-4 text-center text-[--text-light]">🖼️ $1</div>'
  );

  return (
    <main className="font-mono bg-[--background] text-[--text] flex flex-col w-screen h-screen">
      <header className="px-8 py-4 border-b border-[--border] text-center relative flex justify-center items-center">
        <div>
          <h1 className="text-2xl">ScreenGuide AI</h1>
          <p className="text-sm text-[--text-light]">Transform Screen Recordings into Technical Documentation</p>
        </div>
        <button onClick={toggleTheme} className="absolute right-8 top-1/2 -translate-y-1/2 border-none bg-transparent rounded-full w-10 h-10 p-0 hover:bg-[--background-secondary]" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
          <span className="material-symbols-outlined text-2xl">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
        </button>
      </header>
      <div className={`grid flex-1 overflow-hidden transition-all duration-300 ${isPreviewCollapsed ? 'grid-cols-[1fr_1fr_50px]' : 'grid-cols-[1.2fr_1.2fr_1fr]'}`}>

        {/* Input Panel */}
        <section className="flex flex-col h-full border-r border-[--border] overflow-hidden">
          <div className="p-6 overflow-y-auto h-full">
            <div className="mb-8">
              <h2 className="text-lg pb-2 border-b border-[--border] mb-4">1. Provide a Screencast</h2>
              <div className="flex gap-4">
                <div className="flex-1 border-2 border-dashed border-[--dashed-border] rounded-lg p-4 text-center flex flex-col justify-center gap-2">
                  <p>Drag & Drop a video file here</p>
                  <p className="text-sm text-[--text-light]">or</p>
                  <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary]">Upload File</label>
                  <input id="file-upload" type="file" accept="video/*" onChange={e => handleFileSelect(e.target.files?.[0] || null)} className="hidden" value="" />
                  <p className="text-xs text-[--text-light]">Max file size: {MAX_FILE_SIZE_MB}MB</p>
                </div>
                <div className="flex-1 border-2 border-dashed border-[--dashed-border] rounded-lg p-4 text-center flex flex-col justify-center gap-2">
                  <p className="text-sm text-[--text-light]">Or record in-app:</p>
                  {store.isRecording ? (
                    <button className="bg-red-600 text-white border-red-600 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg" onClick={stopRecording}>
                      <span className="material-symbols-outlined text-base leading-none">stop</span> Stop Recording
                    </button>
                  ) : (
                    <div className="flex justify-center gap-2">
                      <button className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary]" onClick={() => handleRecord('screen')}><span className="material-symbols-outlined text-base leading-none">desktop_windows</span> Screen</button>
                      <button className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary]" onClick={() => handleRecord('camera')}><span className="material-symbols-outlined text-base leading-none">videocam</span> Camera</button>
                      <button className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary]" onClick={() => handleRecord('audio')}><span className="material-symbols-outlined text-base leading-none">mic</span> Audio</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {store.videoUrl && <VideoPlayer url={store.videoUrl} captions={store.timecodedCaptions} />}
            {store.error && (
              <div className="bg-[--error-bg] text-[--error-text] border border-[--error-border] p-4 rounded-lg mt-4 whitespace-pre-wrap flex flex-col gap-3 items-start">
                <span>{store.error}</span>
                {store.captioningFailed && <button onClick={store.retryCaptions} disabled={store.isRetryingCaptions} className="bg-transparent border border-current text-current px-2 py-1 text-sm rounded-md hover:bg-opacity-10 hover:bg-black dark:hover:bg-opacity-10 dark:hover:bg-white inline-flex items-center gap-2"><span className="material-symbols-outlined text-base leading-none">refresh</span> {store.isRetryingCaptions ? `Retrying... (${Math.round(store.progress)}%)` : 'Retry'}</button>}
              </div>
            )}
            <div className={`mb-8 mt-4 ${!store.videoBase64 && 'opacity-40 pointer-events-none'}`}>
              <h2 className="text-lg pb-2 border-b border-[--border] mb-4">2. Review Transcription & Captions</h2>
              <TranscriptEditor />
            </div>
            <div className={`mb-8 ${!store.videoBase64 && 'opacity-40 pointer-events-none'}`}>
              <h2 className="text-lg pb-2 border-b border-[--border] mb-4">3. Choose Output Format</h2>
              <div className="grid grid-cols-2 gap-4">
                {(['guide', 'article', 'slides', 'diagram'] as const).map(f => (
                  <label key={f} className={`border p-4 rounded-lg cursor-pointer text-center transition-all ${store.outputFormat === f ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50' : 'border-[--border] hover:bg-[--background-secondary]'}`}>
                    <input type="radio" name="format" value={f} checked={store.outputFormat === f} onChange={() => store.setOutputFormat(f)} className="hidden" />
                    {f === 'guide' ? 'Step-by-step Guide' : f === 'article' ? 'Knowledge Base Article' : f === 'slides' ? 'Presentation Slides' : 'Diagram / Flowchart'}
                  </label>
                ))}
              </div>
            </div>
            <div className={`mb-8 ${!store.videoBase64 && 'opacity-40 pointer-events-none'}`}>
              <button className="w-full py-3 bg-[--primary-light] dark:bg-[--primary-dark] text-[--primary-text-light] dark:text-[--primary-text-dark] border-none text-base rounded-lg hover:opacity-90 disabled:opacity-50" onClick={store.generateContent} disabled={!store.videoBase64 || isLoading}>
                ▶️ Generate Content
              </button>
            </div>
          </div>
        </section>

        {/* Middle Column */}
        <div className="flex flex-col h-full border-r border-[--border] overflow-hidden">
          <section className="flex-grow flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[--border] flex-shrink-0">
              <h2 className="text-lg border-none m-0 p-0">Editor</h2>
              <div className="flex gap-2 flex-wrap justify-end">
                {store.videoBase64 && !isLoading && <button className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary] disabled:opacity-50" onClick={store.generateSummary} disabled={store.isSummarizing}><span className="material-symbols-outlined text-base leading-none">summarize</span> {store.isSummarizing ? 'Summarizing...' : 'Summarize'}</button>}
                {store.generatedContent && !isLoading && (
                  <>
                    <button onClick={() => setIsRewriteModalOpen(true)} disabled={!selectionRange || isRewriting} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary] disabled:opacity-50"><span className="material-symbols-outlined text-base leading-none">auto_fix_high</span> Edit with AI</button>
                    <button onClick={() => navigator.clipboard.writeText(store.generatedContent)} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary]"><span className="material-symbols-outlined text-base leading-none">content_copy</span></button>
                    <button onClick={() => downloadFile(`ScreenGuide.${store.outputFormat === 'diagram' ? 'mmd' : 'md'}`, new Blob([store.generatedContent]), 'text/plain')} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary]"><span className="material-symbols-outlined text-base leading-none">save</span></button>
                  </>
                )}
              </div>
            </div>
            {(store.isSummarizing || store.videoSummary) && (
              <div className="px-6 py-4 border-b border-[--border] bg-[--background]">
                {store.isSummarizing ? (
                  <div className="flex items-center gap-4 text-[--text-light]"><div className="w-6 h-6 border-2 border-[--border] border-t-blue-500 rounded-full animate-spin"></div> Generating summary...</div>
                ) : (
                  <>
                    <h3 className="flex items-center gap-2 text-base mb-2"><span className="material-symbols-outlined text-blue-500">auto_awesome</span> AI Summary</h3>
                    <p className="text-sm leading-relaxed">{store.videoSummary}</p>
                  </>
                )}
              </div>
            )}
            <div className="relative flex-1">
              {isLoading && (
                <div className="absolute inset-0 bg-[--background] bg-opacity-90 flex flex-col justify-center items-center z-10 gap-4">
                  <div className="w-12 h-12 border-4 border-[--border] border-t-blue-500 rounded-full animate-spin"></div>
                  <p className="text-lg">{store.loadingMessage}</p>
                  <div className="w-4/5 max-w-sm h-2.5 bg-[--background-secondary] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${store.progress}%` }}></div>
                  </div>
                  <p className="font-mono text-sm text-[--text-light]">{Math.round(store.progress)}%</p>
                </div>
              )}
              {!isLoading && !store.generatedContent && <div className="flex justify-center items-center h-full text-[--text-light]"><p>Your generated content will appear here.</p></div>}
              {!isLoading && store.generatedContent && <textarea ref={editorRef} value={store.generatedContent} onChange={e => store.setGeneratedContent(e.target.value)} onSelect={() => { const { selectionStart, selectionEnd } = editorRef.current!; setSelectionRange(selectionStart !== selectionEnd ? { start: selectionStart, end: selectionEnd } : null); }} className="w-full h-full border-none rounded-none p-6 resize-none text-sm leading-relaxed bg-[--background] text-[--text] focus:outline-none" aria-label="Markdown content editor" />}
            </div>
            <div className="flex justify-end items-center px-6 py-4 border-t border-[--border] flex-shrink-0 gap-2">
              {store.generatedContent && !isLoading && store.outputFormat !== 'diagram' && <button onClick={handleExportZip} disabled={store.isZipping} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary]"><span className="material-symbols-outlined text-base leading-none">archive</span> {store.isZipping ? 'Zipping...' : 'Export .zip'}</button>}
              {store.generatedContent && !isLoading && <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary]"><span className="material-symbols-outlined text-base leading-none">picture_as_pdf</span> Export .pdf</button>}
              {store.generatedContent && !isLoading && store.outputFormat !== 'diagram' && <button onClick={() => downloadFile('guide.rtf', new Blob([markdownToRtf(store.generatedContent)]), 'application/rtf')} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary]"><span className="material-symbols-outlined text-base leading-none">description</span> Export .rtf</button>}
              {store.videoFile && <button onClick={handleExportSessionData} disabled={store.isZipping} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-[--border] rounded-lg hover:bg-[--background-secondary]"><span className="material-symbols-outlined text-base leading-none">dataset</span>{store.isZipping ? 'Exporting...' : 'Export Session'}</button>}
            </div>
          </section>
        </div>

        {/* Preview Panel */}
        <section className="flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center px-6 py-4 border-b border-[--border]">
            <h2 className={`text-lg border-none m-0 p-0 transition-opacity ${isPreviewCollapsed && 'opacity-0'}`}>Preview</h2>
            <button onClick={() => setIsPreviewCollapsed(!isPreviewCollapsed)} className="bg-transparent border-none p-0 hover:bg-[--background-secondary] rounded-full w-8 h-8 flex items-center justify-center" aria-label={isPreviewCollapsed ? 'Expand preview' : 'Collapse preview'}>
              <span className="material-symbols-outlined text-2xl">{isPreviewCollapsed ? 'keyboard_double_arrow_left' : 'keyboard_double_arrow_right'}</span>
            </button>
          </div>
          <div className={`p-6 h-full overflow-y-auto transition-opacity ${isPreviewCollapsed && 'opacity-0'}`}>
            {!store.generatedContent && <div className="flex justify-center items-center h-full text-[--text-light]"><p>Preview will appear here.</p></div>}
            {store.generatedContent && store.outputFormat === 'slides' ? (
              store.generatedContent.split(/\n---\n/).map((slideContent, index) => (
                <div className="border border-[--border] rounded-lg p-6 mb-6 bg-[--background-secondary] relative min-h-[250px]" key={index}>
                  <div className="absolute bottom-2.5 right-4 text-xs text-[--text-light] font-mono">{index + 1}</div>
                  <MarkdownPreview source={processContentForPreview(slideContent.trim())} rehypePlugins={[[rehypeMermaid]]} wrapperElement={{ "data-color-mode": theme }} allowDangerousHtml={true} />
                </div>
              ))
            ) : store.generatedContent && (
              <MarkdownPreview source={processContentForPreview(store.outputFormat === 'diagram' ? '```mermaid\n' + store.generatedContent + '\n```' : store.generatedContent)} rehypePlugins={[[rehypeMermaid]]} wrapperElement={{ "data-color-mode": theme }} allowDangerousHtml={true} />
            )}
          </div>
        </section>
      </div>

      <ContextModal isOpen={isContextModalOpen} onClose={() => setIsContextModalOpen(false)} onSubmit={startProcessing} description={localDescription} setDescription={setLocalDescription} prompt={localPrompt} setPrompt={setLocalPrompt} skipAudio={skipAudio} setSkipAudio={setSkipAudio} />
      <RewriteModal isOpen={isRewriteModalOpen} onClose={() => setIsRewriteModalOpen(false)} onSubmit={handleRewrite} selectedText={selectionRange ? store.generatedContent.substring(selectionRange.start, selectionRange.end) : ''} prompt={rewritePrompt} setPrompt={setRewritePrompt} isRewriting={isRewriting} />
    </main>
  );
}