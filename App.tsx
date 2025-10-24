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
import {useRef, useState} from 'react';
import JSZip from 'jszip';
import {timeToSecs} from './utils';
import {transcribeVideo, generateGuide, generateTimecodedCaptions, DiarizedSegment, Caption} from './api';
import { markdownToRtf } from './exportUtils';
import VideoPlayer from './VideoPlayer.jsx';
import MarkdownEditor from './MarkdownEditor';
import TranscriptEditor from './TranscriptEditor';
import ContextModal from './ContextModal';

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

// Helper for short, cosmetic loading steps to improve UX feedback
const simulateShortProgress = (onProgress: (percent: number) => void): Promise<void> => {
    return new Promise(resolve => {
        let progress = 0;
        onProgress(progress);
        const interval = setInterval(() => {
            progress += 15 + Math.random() * 10; // Faster progress
            if (progress >= 100) {
                clearInterval(interval);
                onProgress(100);
                // A short delay before resolving to ensure 100% is visible
                setTimeout(resolve, 100);
            } else {
                onProgress(progress);
            }
        }, 120); // Faster interval
    });
};

// Helper function to extract a frame from a video at a specific time
const extractFrame = (videoUrl: string, time: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.style.display = 'none';
    video.muted = true;
    video.crossOrigin = 'anonymous';

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas to Blob conversion failed.'));
          }
          document.body.removeChild(video);
        }, 'image/png');
      } else {
        reject(new Error('Could not get canvas context.'));
        document.body.removeChild(video);
      }
    };

    const onLoadedMetadata = () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      if (time > video.duration) {
          console.warn(`Seek time ${time} is beyond video duration ${video.duration}. Clamping to duration.`);
          video.currentTime = video.duration;
      } else {
          video.currentTime = time;
      }
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', (e) => {
        reject(new Error(`Video loading error`));
        document.body.removeChild(video);
    });

    video.src = videoUrl;
    document.body.appendChild(video);
    video.load();
  });
};


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
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  // Step states
  const [diarizedTranscript, setDiarizedTranscript] = useState<DiarizedSegment[]>([]);
  const [timecodedCaptions, setTimecodedCaptions] = useState<Caption[]>([]);
  const [videoDescription, setVideoDescription] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [outputFormat, setOutputFormat] = useState('guide');
  const [generatedContent, setGeneratedContent] = useState('');

  // Loading states
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);

  // Modal and pending file state
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const resetState = () => {
    setVideoFile(null);
    setVideoUrl('');
    setVideoBase64('');
    setVideoMimeType('');
    setError('');
    setDiarizedTranscript([]);
    setTimecodedCaptions([]);
    setVideoDescription('');
    setUserPrompt('');
    setOutputFormat('guide');
    setGeneratedContent('');
    setIsProcessingVideo(false);
    setIsGenerating(false);
    setIsZipping(false);
    setLoadingMessage('');
    setProgress(0);
    setPendingFile(null);
  };

  const handleFileSelect = (file: File | null) => {
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
    setPendingFile(file);
    setIsContextModalOpen(true);
  };

  const startProcessingAndCloseModal = async () => {
    setIsContextModalOpen(false);
    if (!pendingFile) return;

    setVideoFile(pendingFile);
    setVideoUrl(URL.createObjectURL(pendingFile));
    setIsProcessingVideo(true);
    setError('');

    try {
      setLoadingMessage('Reading video file...');
      const base64Data = await fileToBase64(pendingFile, setProgress);
      setVideoBase64(base64Data);
      setVideoMimeType(pendingFile.type);

      setLoadingMessage('Analyzing audio...');
      await simulateShortProgress(setProgress);

      setLoadingMessage('Generating speaker diarization...');
      const transcriptionPromise = transcribeVideo({ 
          videoBase64: base64Data, 
          mimeType: pendingFile.type,
          description: videoDescription,
          userPrompt: userPrompt,
      });
      const transcribedText = await simulateProgress(transcriptionPromise, setProgress);
      setDiarizedTranscript(transcribedText);
      
      setLoadingMessage('Creating captions...');
      const captionsPromise = generateTimecodedCaptions({ 
          videoBase64: base64Data, 
          mimeType: pendingFile.type,
          description: videoDescription,
          userPrompt: userPrompt,
      });
      const captions = await simulateProgress(captionsPromise, setProgress);
      setTimecodedCaptions(captions || []);

    } catch (e) {
      console.error(e);
      setError('An error occurred during processing. Please try again.');
    } finally {
      setIsProcessingVideo(false);
      setLoadingMessage('');
      setProgress(0);
      setPendingFile(null); // Clear pending file after processing
    }
  };


  const handleGenerate = async () => {
    if (!videoBase64 || diarizedTranscript.length === 0) {
      setError('Missing video or transcript.');
      return;
    }
    setIsGenerating(true);
    const message = outputFormat === 'diagram' ? 'Generating diagram...' : 'Generating content...';
    setLoadingMessage(message);
    setError('');
    setGeneratedContent('');
    setProgress(0);

    try {
      const transcriptString = diarizedTranscript.map(segment => `${segment.speaker}: ${segment.text}`).join('\n');
      const generationPromise = generateGuide({
        videoBase64,
        mimeType: videoMimeType,
        transcript: transcriptString,
        description: videoDescription,
        prompt: userPrompt,
        format: outputFormat,
      });
      const content = await simulateProgress(generationPromise, setProgress);
      setGeneratedContent(content);
    } catch (e) {
      console.error(e);
      setError('Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
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
        handleFileSelect(file);
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
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
  };
  
  const saveAsMarkdown = () => {
    const fileExtension = outputFormat === 'diagram' ? 'mmd' : 'md';
    const mimeType = outputFormat === 'diagram' ? 'text/plain' : 'text/markdown;charset=utf-8';
    const blob = new Blob([generatedContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ScreenGuide-Output.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportZip = async () => {
    if (!generatedContent || !videoUrl) return;

    setIsZipping(true);
    setError('');

    try {
        const zip = new JSZip();
        const imagePlaceholders = [...generatedContent.matchAll(/\[Image: (.*?)\s+at\s+([0-9:.]+)]/g)];
        
        if (imagePlaceholders.length === 0) {
            const fileExtension = outputFormat === 'diagram' ? 'mmd' : 'md';
            zip.file(`output.${fileExtension}`, generatedContent);
        } else {
            let updatedContent = generatedContent;
            const imagePromises: Promise<{ blob: Blob; index: number }>[] = [];
            
            imagePlaceholders.forEach((match, index) => {
                const timecode = match[2];
                const seconds = timeToSecs(timecode);
                const promise = extractFrame(videoUrl, seconds).then(blob => ({ blob, index }));
                imagePromises.push(promise);
            });

            const imageResults = await Promise.all(imagePromises);

            for (const result of imageResults) {
                const { blob, index } = result;
                const match = imagePlaceholders[index];
                const imageName = `image-${index + 1}.png`;
                zip.file(`images/${imageName}`, blob);
                
                const placeholder = match[0];
                const description = match[1];
                updatedContent = updatedContent.replace(placeholder, `![${description}](./images/${imageName})`);
            }
            
            zip.file(`guide.md`, updatedContent);
        }

        const zipBlob = await zip.generateAsync({type: 'blob'});

        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = 'ScreenGuide-Export.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

    } catch (e) {
        console.error("Error creating zip file:", e);
        setError("Failed to create zip file. Could not extract frames from video.");
    } finally {
        setIsZipping(false);
    }
  };

  const handleExportPdf = () => {
    window.print();
  };

  const handleExportRtf = () => {
      const rtfContent = markdownToRtf(generatedContent);
      const blob = new Blob([rtfContent], { type: 'application/rtf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ScreenGuide-Output.rtf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleExportSessionData = () => {
      const sessionData = {
          userContext: {
              videoDescription: videoDescription,
              userPrompt: userPrompt,
          },
          rawData: {
              diarizedTranscript: diarizedTranscript,
              timecodedCaptions: timecodedCaptions,
          },
          generatedOutput: {
              format: outputFormat,
              content: generatedContent,
          },
          timestamp: new Date().toISOString(),
      };
      const jsonContent = JSON.stringify(sessionData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ScreenGuide-Session.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };


  const onDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };
  
  const isLoading = isProcessingVideo || isGenerating;

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
                    onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null)}
                    style={{display: 'none'}}
                    value="" // Ensure onChange fires for the same file
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
              <h2>2. Review Transcription & Captions</h2>
              <TranscriptEditor
                transcript={diarizedTranscript}
                captions={timecodedCaptions}
                onTranscriptChange={setDiarizedTranscript}
                onCaptionsChange={setTimecodedCaptions}
              />
            </div>
            
            {/* Step 3: Choose Format */}
            <div className={c('step', {disabled: !videoBase64})}>
              <h2>3. Choose Output Format</h2>
              <div className="format-selector">
                <label className={c({active: outputFormat === 'guide'})}>
                  <input type="radio" name="format" value="guide" checked={outputFormat === 'guide'} onChange={() => setOutputFormat('guide')} />
                  Step-by-step Guide
                </label>
                <label className={c({active: outputFormat === 'article'})}>
                  <input type="radio" name="format" value="article" checked={outputFormat === 'article'} onChange={() => setOutputFormat('article')} />
                  Knowledge Base Article
                </label>
                <label className={c({active: outputFormat === 'slides'})}>
                  <input type="radio" name="format" value="slides" checked={outputFormat === 'slides'} onChange={() => setOutputFormat('slides')} />
                  Presentation Slides
                </label>
                <label className={c({active: outputFormat === 'diagram'})}>
                  <input type="radio" name="format" value="diagram" checked={outputFormat === 'diagram'} onChange={() => setOutputFormat('diagram')} />
                  Diagram / Flowchart
                </label>
              </div>
            </div>

             {/* Step 4: Generate */}
            <div className={c('step', {disabled: !videoBase64})}>
                <button className="button generate-button" onClick={handleGenerate} disabled={!videoBase64 || isLoading}>
                  ▶️ Generate Content
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
                <button onClick={saveAsMarkdown}><span className="icon">save</span> Save as .{outputFormat === 'diagram' ? 'mmd' : 'md'}</button>
                {outputFormat !== 'diagram' && (
                    <button onClick={handleExportZip} disabled={isZipping}>
                        <span className="icon">archive</span> {isZipping ? 'Zipping...' : 'Export as .zip'}
                    </button>
                )}
                <button onClick={handleExportPdf}><span className="icon">picture_as_pdf</span> Export as .pdf</button>
                {outputFormat !== 'diagram' && (
                    <button onClick={handleExportRtf}><span className="icon">description</span> Export as .rtf</button>
                )}
                <button onClick={handleExportSessionData}><span className="icon">dataset</span> Export Session</button>
              </div>
            )}
          </div>
          <div className="panel-content output-content">
            {isProcessingVideo && (
              <div className="loading">
                <div className="spinner"></div>
                <p className="loading-message">{loadingMessage}</p>
                <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="progress-percent">{Math.round(progress)}%</p>
              </div>
            )}
            {isGenerating && (
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
                    <p>Your generated content will appear here.</p>
                </div>
            )}
            {!isLoading && generatedContent && (
              <MarkdownEditor
                initialContent={generatedContent}
                onContentChange={setGeneratedContent}
                format={outputFormat as 'guide' | 'article' | 'diagram' | 'slides'}
                theme={theme}
              />
            )}
          </div>
        </section>
      </div>
      <ContextModal
        isOpen={isContextModalOpen}
        onClose={() => {
            setIsContextModalOpen(false);
            setPendingFile(null);
        }}
        onSubmit={startProcessingAndCloseModal}
        description={videoDescription}
        setDescription={setVideoDescription}
        prompt={userPrompt}
        setPrompt={setUserPrompt}
      />
    </main>
  );
}