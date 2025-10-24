/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
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

import c from 'classnames';
import {useRef, useState, useEffect} from 'react';
import {transcribeVideo, generateGuide, generateTimecodedCaptions} from './api';
import VideoPlayer from './VideoPlayer.jsx';

// Fix: Define Caption interface for type safety. This is used for timecodedCaptions state.
interface Caption {
  time: string;
  text: string;
}

const PROMPT_EXAMPLES = [
  'Generate a guide for absolute beginners',
  'Focus on accessibility features',
  'Make the tone friendly and informal',
  'Create a guide for expert users, focusing on advanced features',
];
const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Helper to convert File object to base64 string
const fileToBase64 = (file: File, onProgress: (percent: number) => void): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onprogress = (event) => {
    if (event.lengthComputable) {
      const percentLoaded = (event.loaded / event.total) * 100;
      onProgress(percentLoaded);
    }
  };
  reader.onload = () => {
    onProgress(100);
    // result is "data:video/webm;base64,..."
    // we need to strip the prefix
    resolve((reader.result as string).split(',')[1]);
  };
  reader.onerror = reject;
});

// FIX: Changed arrow function with generic to a standard function declaration to avoid JSX parsing ambiguity.
// This resolves errors related to 'T', 'let', 'progress', 'interval', 'onProgress', and call expression errors for simulateProgress.
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
      // Don't go to 100, wait for the promise to resolve
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


// A simple markdown to HTML converter component
// FIX: Added type for 'content' prop to resolve 'Cannot find name 'content'' error.
function MarkdownRenderer({content}: {content: string}) {
  const convertMarkdownToHTML = (text: string) => {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    // Lists
    html = html.replace(/^\s*[-*] (.*)/gim, '<li>$1</li>');
    html = html.replace(/<li>/g, '<ul><li>');
    html = html.replace(/<\/li>\n<ul>/g, '</li><li>');
    html = html.replace(/<\/li>\n((?!<li>).)/g, '</li></ul>\n$1');
    html = html.replace(/<\/li>$/, '</li></ul>');
    // Numbered Lists
    html = html.replace(/^\s*\d+\. (.*)/gim, '<li>$1</li>');
    html = html.replace(/<li>/g, '<ol><li>');
    html = html.replace(/<\/li>\n<ol>/g, '</li><li>');
    html = html.replace(/<\/li>\n((?!<li>).)/g, '</li></ol>\n$1');
    html = html.replace(/<\/li>$/, '</li></ul>');
    // Image placeholders
    html = html.replace(
      /\[Image: (.*?)\]/gim,
      '<div class="image-placeholder">🖼️ $1</div>',
    );
    // Newlines
    html = html.replace(/\n/g, '<br />');
    return html;
  };

  return (
    <div
      className="markdown-content"
      dangerouslySetInnerHTML={{__html: convertMarkdownToHTML(content)}}
    />
  );
}

export default function App() {
  const [theme] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  // App state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoBase64, setVideoBase64] = useState('');
  const [videoMimeType, setVideoMimeType] = useState('');
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const speechRecognizer = useRef<any>(null);

  // Step states
  const [transcript, setTranscript] = useState('');
  // Fix: Strongly type the `timecodedCaptions` state to resolve type errors.
  const [timecodedCaptions, setTimecodedCaptions] = useState<Caption[]>([]);
  const [videoDescription, setVideoDescription] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [outputFormat, setOutputFormat] = useState('guide');
  const [generatedContent, setGeneratedContent] = useState('');

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);

  const resetState = () => {
    setVideoFile(null);
    setVideoUrl('');
    setVideoBase64('');
    setVideoMimeType('');
    setError('');
    setTranscript('');
    setTimecodedCaptions([]);
    setVideoDescription('');
    setUserPrompt('');
    setOutputFormat('guide');
    setGeneratedContent('');
    setIsLoading(false);
    setLoadingMessage('');
    setProgress(0);
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }
    if (!file.type.startsWith('video/')) {
      setError('Invalid file type. Please upload a video file.');
      return;
    }

    resetState();
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setIsLoading(true);
    setError('');

    try {
      setLoadingMessage('Reading video file...');
      const base64Data = await fileToBase64(file, setProgress);
      setVideoBase64(base64Data);
      setVideoMimeType(file.type);

      setLoadingMessage('Transcribing audio...');
      setProgress(0);
      const transcriptionPromise = transcribeVideo({ videoBase64: base64Data, mimeType: file.type });
      const transcribedText = await simulateProgress(transcriptionPromise, setProgress);
      setTranscript(transcribedText);
      
      setLoadingMessage('Generating video captions...');
      setProgress(0);
      const captionsPromise = generateTimecodedCaptions({ videoBase64: base64Data, mimeType: file.type });
      const captions = await simulateProgress(captionsPromise, setProgress);
      setTimecodedCaptions(captions || []);

    } catch (e) {
      console.error(e);
      setError('An error occurred during processing. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
      setProgress(0);
    }
  };

  const handleGenerate = async () => {
    if (!videoBase64 || !transcript) {
      setError('Missing video or transcript.');
      return;
    }
    setIsLoading(true);
    setLoadingMessage('Generating guide...');
    setError('');
    setGeneratedContent('');
    setProgress(0);

    try {
      const generationPromise = generateGuide({
        videoBase64,
        mimeType: videoMimeType,
        transcript: transcript,
        description: videoDescription,
        prompt: userPrompt,
        format: outputFormat,
      });
      const content = await simulateProgress(generationPromise, setProgress);
      setGeneratedContent(content);
    } catch (e) {
      console.error(e);
      setError('Failed to generate guide. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
      setProgress(0);
    }
  };

  const handleRecord = async (type) => {
    try {
      let stream;
      // FIX: Removed the incorrect 'DisplayMediaStreamOptions' type annotation to allow non-standard properties.
      const displayMediaOptions = {
        video: true,
        audio: true,
        selfBrowserSurface: 'exclude',
        systemAudio: 'include',
        surfaceSwitching: 'include',
      };
      if (type === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      } else if (type === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
      } else { // audio
        stream = await navigator.mediaDevices.getUserMedia({audio: true});
      }

      setIsRecording(true);
      const recordedChunks = [];
      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(recordedChunks, {type: 'video/webm'});
        const file = new File([blob], 'recording.webm', {type: 'video/webm'});
        handleFileUpload(file);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.current.start();
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Could not start recording. Please ensure permissions are granted.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
    }
  };

  const handleVoiceInput = () => {
    if (isListening) {
      speechRecognizer.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    speechRecognizer.current = new SpeechRecognition();
    speechRecognizer.current.continuous = true;
    speechRecognizer.current.interimResults = true;

    speechRecognizer.current.onstart = () => setIsListening(true);
    speechRecognizer.current.onend = () => setIsListening(false);
    speechRecognizer.current.onerror = (e) => {
      console.error("Speech recognition error", e);
      setIsListening(false);
    };

    speechRecognizer.current.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setUserPrompt(prev => prev ? `${prev.trim()} ${finalTranscript}` : finalTranscript);
      }
    };

    speechRecognizer.current.start();
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
  };
  
  const saveAsMarkdown = () => {
    const blob = new Blob([generatedContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ScreenGuide-Output.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  return (
    <main
      className={theme}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <header>
        <h1>ScreenGuide AI</h1>
        <p>Transform Screen Recordings into Technical Documentation</p>
      </header>
      <div className="container">
        {/* INPUT PANEL */}
        <section className="panel input-panel">
          <div className="panel-content">
            {/* Step 1: Provide Screencast */}
            <div className="step">
              <h2>1. Provide a Screencast</h2>
              <div className="input-group">
                <div className="upload-box">
                  <p>Drag & Drop a video file here</p>
                  <p className="light-text">or</p>
                  <label htmlFor="file-upload" className="button">
                    Upload File
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept="video/*"
                    onChange={(e) => handleFileUpload(e.target.files ? e.target.files[0] : null)}
                    style={{display: 'none'}}
                  />
                  <p className="light-text info">Max file size: {MAX_FILE_SIZE_MB}MB</p>
                </div>
                <div className="recorder-box">
                  <p className="light-text">Or record in-app:</p>
                  {isRecording ? (
                      <button className="button stop-button" onClick={stopRecording}>
                        <span className="icon">stop</span> Stop Recording
                      </button>
                  ) : (
                    <div className="record-buttons">
                      <button onClick={() => handleRecord('screen')}>
                        <span className="icon">desktop_windows</span> Screen
                      </button>
                      <button onClick={() => handleRecord('camera')}>
                        <span className="icon">videocam</span> Camera
                      </button>
                      <button onClick={() => handleRecord('audio')}>
                        <span className="icon">mic</span> Audio
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {videoUrl && <VideoPlayer url={videoUrl} captions={timecodedCaptions}/>}
            {error && <div className="error-message">{error}</div>}

            {/* Step 2: Review Transcription */}
            <div className={c('step', {disabled: !videoBase64})}>
              <h2>2. Review Transcription</h2>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="AI-generated transcript will appear here..."
                rows={8}
                disabled={!videoBase64 || isLoading}
              />
            </div>
            
            {/* Step 3: Add Context */}
            <div className={c('step', {disabled: !videoBase64})}>
              <h2>3. Add Context & Instructions</h2>
              <label>Video Description (Optional)</label>
              <input 
                type="text" 
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
                placeholder="e.g., A tutorial on setting up a new project" 
                disabled={!videoBase64 || isLoading}
              />
              <label>User Prompt (Optional)</label>
              <div className="prompt-area">
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Give specific instructions to the AI..."
                  rows={4}
                  disabled={!videoBase64 || isLoading}
                />
                <button 
                    className={c('mic-button', {active: isListening})}
                    onClick={handleVoiceInput}
                    title="Dictate prompt"
                    disabled={!videoBase64 || isLoading}
                >
                    <span className="icon">mic</span>
                </button>
              </div>
              <div className="prompt-examples">
                {PROMPT_EXAMPLES.map((p) => (
                  <button key={p} onClick={() => setUserPrompt(p)} disabled={!videoBase64 || isLoading}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 4: Choose Format */}
            <div className={c('step', {disabled: !videoBase64})}>
              <h2>4. Choose Output Format</h2>
              <div className="format-selector">
                <label className={c({active: outputFormat === 'guide'})}>
                  <input type="radio" name="format" value="guide" checked={outputFormat === 'guide'} onChange={() => setOutputFormat('guide')} />
                  Step-by-step Guide
                </label>
                <label className={c({active: outputFormat === 'article'})}>
                  <input type="radio" name="format" value="article" checked={outputFormat === 'article'} onChange={() => setOutputFormat('article')} />
                  Knowledge Base Article
                </label>
              </div>
            </div>

             {/* Step 5: Generate */}
            <div className={c('step', {disabled: !videoBase64})}>
                <button className="button generate-button" onClick={handleGenerate} disabled={!videoBase64 || isLoading}>
                  ▶️ Generate Guide
                </button>
            </div>
          </div>
        </section>

        {/* OUTPUT PANEL */}
        <section className="panel output-panel">
          <div className="panel-header">
            <h2>Output</h2>
            {generatedContent && !isLoading && (
              <div className="output-actions">
                <button onClick={copyToClipboard}><span className="icon">content_copy</span> Copy</button>
                <button onClick={saveAsMarkdown}><span className="icon">save</span> Save as .md</button>
              </div>
            )}
          </div>
          <div className="panel-content output-content">
            {isLoading && (
              <div className="loading">
                <div className="spinner"></div>
                <p className="loading-message">{loadingMessage}</p>
                <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="progress-percent">{Math.round(progress)}%</p>
              </div>
            )}
            {!isLoading && !generatedContent && (
                <div className="empty-output">
                    <p>Your generated guide will appear here.</p>
                </div>
            )}
            {generatedContent && <MarkdownRenderer content={generatedContent} />}
          </div>
        </section>
      </div>
    </main>
  );
}