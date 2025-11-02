import { create } from 'zustand';
import { DiarizedSegment, Caption } from '../types';
import * as api from '../api';

const fileToBase64 = (file: File, onProgress: (percent: number) => void): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onprogress = (event) => {
    if (event.lengthComputable) {
      onProgress((event.loaded / event.total) * 100);
    }
  };
  reader.onload = () => {
    onProgress(100);
    resolve((reader.result as string).split(',')[1]);
  };
  reader.onerror = reject;
});

function simulateProgress<T>(
  task: Promise<T>,
  onProgress: (percent: number) => void,
): Promise<T> {
  let progress = 0;
  onProgress(progress);
  const interval = setInterval(() => {
    progress += Math.random() * 5;
    if (progress >= 95) {
      clearInterval(interval);
      onProgress(95);
    } else {
      onProgress(progress);
    }
  }, 200);
  return task
    .then(result => {
      clearInterval(interval);
      onProgress(100);
      return result;
    })
    .catch(error => {
      clearInterval(interval);
      onProgress(0);
      throw error;
    });
}

interface AppState {
  videoFile: File | null;
  videoUrl: string;
  videoBase64: string;
  videoMimeType: string;
  error: string;
  isRecording: boolean;
  diarizedTranscript: DiarizedSegment[];
  timecodedCaptions: Caption[];
  videoDescription: string;
  userPrompt: string;
  outputFormat: string;
  generatedContent: string;
  videoSummary: string;
  isProcessingVideo: boolean;
  isGenerating: boolean;
  isZipping: boolean;
  isSummarizing: boolean;
  loadingMessage: string;
  progress: number;
  captioningFailed: boolean;
  isRetryingCaptions: boolean;

  setDiarizedTranscript: (transcript: DiarizedSegment[]) => void;
  setTimecodedCaptions: (captions: Caption[]) => void;
  setGeneratedContent: (content: string) => void;
  setOutputFormat: (format: string) => void;
  resetState: () => void;
  startProcessing: (file: File, description: string, prompt: string, skipAudio: boolean) => Promise<void>;
  retryCaptions: () => Promise<void>;
  generateSummary: () => Promise<void>;
  generateContent: () => Promise<void>;
  rewriteText: (textToRewrite: string, prompt: string) => Promise<string | null>;
}

export const useAppStore = create<AppState>((set, get) => ({
  videoFile: null,
  videoUrl: '',
  videoBase64: '',
  videoMimeType: '',
  error: '',
  isRecording: false,
  diarizedTranscript: [],
  timecodedCaptions: [],
  videoDescription: '',
  userPrompt: '',
  outputFormat: 'guide',
  generatedContent: '',
  videoSummary: '',
  isProcessingVideo: false,
  isGenerating: false,
  isZipping: false,
  isSummarizing: false,
  loadingMessage: '',
  progress: 0,
  captioningFailed: false,
  isRetryingCaptions: false,

  setDiarizedTranscript: (transcript) => set({ diarizedTranscript: transcript }),
  setTimecodedCaptions: (captions) => set({ timecodedCaptions: captions }),
  setGeneratedContent: (content) => set({ generatedContent: content }),
  setOutputFormat: (format) => set({ outputFormat: format }),

  resetState: () => set({
    videoFile: null, videoUrl: '', videoBase64: '', videoMimeType: '', error: '',
    diarizedTranscript: [], timecodedCaptions: [], videoDescription: '', userPrompt: '',
    outputFormat: 'guide', generatedContent: '', videoSummary: '', isProcessingVideo: false,
    isGenerating: false, isZipping: false, isSummarizing: false, loadingMessage: '',
    progress: 0, captioningFailed: false, isRetryingCaptions: false,
  }),

  startProcessing: async (file, description, prompt, skipAudio) => {
    get().resetState();
    set({
      isProcessingVideo: true,
      videoFile: file,
      videoUrl: URL.createObjectURL(file),
      videoMimeType: file.type,
      videoDescription: description,
      userPrompt: prompt,
    });
    const makeProgressUpdater = (start: number, end: number) => (p: number) => set({ progress: start + (p / 100) * (end - start) });

    try {
      set({ loadingMessage: 'Reading video file...' });
      const base64Data = await fileToBase64(file, makeProgressUpdater(0, 30));
      set({ videoBase64: base64Data });

      const apiParams = { videoBase64: base64Data, mimeType: file.type, description, userPrompt: prompt };

      if (!skipAudio) {
        set({ loadingMessage: 'Generating speaker diarization...' });
        const transcribedText = await simulateProgress(api.transcribeVideo(apiParams), makeProgressUpdater(30, 65));
        set({ diarizedTranscript: transcribedText.length > 0 ? transcribedText : [{ speaker: 'Speaker 1', text: '', startTime: '00:00:00.000', endTime: '00:00:05.000' }] });
      }

      set({ loadingMessage: 'Creating captions...' });
      const captions = await simulateProgress(api.generateTimecodedCaptions(apiParams), makeProgressUpdater(skipAudio ? 30 : 65, 100));
      if (captions?.length > 0) {
        set({ timecodedCaptions: captions });
      } else {
        set(state => ({ error: (state.error ? `${state.error}\n` : '') + 'Captioning failed.', timecodedCaptions: [], captioningFailed: true }));
      }
    } catch (e: any) {
      set({ error: e.message || 'An error occurred during processing.' });
    } finally {
      set({ isProcessingVideo: false, loadingMessage: '', progress: 0 });
    }
  },

  retryCaptions: async () => {
    const { videoBase64, videoMimeType, videoDescription, userPrompt } = get();
    if (!videoBase64) return;

    set({ isRetryingCaptions: true, error: get().error.replace('Captioning failed.', '').trim(), captioningFailed: false, progress: 0 });
    try {
      const captions = await simulateProgress(api.generateTimecodedCaptions({ videoBase64, mimeType: videoMimeType, description: videoDescription, userPrompt: userPrompt }), (p) => set({ progress: p }));
      if (captions?.length > 0) {
        set({ timecodedCaptions: captions });
      } else {
        set(state => ({ error: (state.error ? `${state.error}\n` : '') + 'Captioning failed.', captioningFailed: true }));
      }
    } catch (e: any) {
      set(state => ({ error: (state.error ? `${state.error}\n` : '') + (e.message || 'Failed to retry.'), captioningFailed: true }));
    } finally {
      set({ isRetryingCaptions: false, progress: 0 });
    }
  },

  generateSummary: async () => {
    const { videoBase64, videoMimeType, diarizedTranscript, videoDescription } = get();
    if (!videoBase64) return set({ error: 'A video must be processed first.' });
    set({ isSummarizing: true, error: '', videoSummary: '' });
    try {
      const transcriptString = diarizedTranscript.map(s => `${s.speaker}: ${s.text}`).join('\n');
      const summary = await api.generateSummary({ videoBase64, mimeType: videoMimeType, transcript: transcriptString, description: videoDescription });
      set({ videoSummary: summary });
    } catch (e: any) {
      set({ error: e.message || 'Failed to generate summary.' });
    } finally {
      set({ isSummarizing: false });
    }
  },

  generateContent: async () => {
    const { videoBase64, videoMimeType, diarizedTranscript, videoDescription, userPrompt, outputFormat } = get();
    if (!videoBase64) return set({ error: 'Missing video.' });
    set({ isGenerating: true, loadingMessage: 'Generating content...', error: '', generatedContent: '', progress: 0 });
    try {
      const transcriptString = diarizedTranscript.map(s => `${s.speaker}: ${s.text}`).join('\n');
      const content = await simulateProgress(api.generateGuide({ videoBase64, mimeType: videoMimeType, transcript: transcriptString, description: videoDescription, prompt: userPrompt, format: outputFormat }), (p) => set({ progress: p }));
      set({ generatedContent: content });
    } catch (e: any) {
      set({ error: e.message || 'Failed to generate content.' });
    } finally {
      set({ isGenerating: false, loadingMessage: '', progress: 0 });
    }
  },

  rewriteText: async (textToRewrite, prompt) => {
    try {
      return await api.rewriteText({ textToRewrite, prompt });
    } catch (e: any) {
      set({ error: e.message || 'Failed to rewrite text.' });
      return null;
    }
  },
}));
