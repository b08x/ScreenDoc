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
import React, {useRef, useState, useEffect} from 'react';
import JSZip from 'jszip';
import mermaid from 'mermaid';
import MarkdownPreview from '@uiw/react-markdown-preview';
import rehypeMermaid from 'rehype-mermaid';

import {timeToSecs} from './utils/utils';
import {transcribeVideo, generateGuide, generateTimecodedCaptions, rewriteText, generateSummary} from './api';
import {DiarizedSegment, Caption} from './types';
import { markdownToRtf, downloadFile, exportToAss, exportToJson } from './utils/exportUtils';
import { fileToBase64, simulateProgress, simulateShortProgress, extractFrame } from './utils/fileUtils';
import VideoPlayer from './components/VideoPlayer';
import TranscriptEditor from './components/TranscriptEditor';
import ContextModal from './components/ContextModal';
import RewriteModal from './components/RewriteModal';

const PROMPT_EXAMPLES = [
  'Generate a guide for absolute beginners',
  'Focus on accessibility features',
  'Make the tone friendly and informal',
  'Create a guide for expert users, focusing on advanced features',
];
const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function App() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('screenguide-theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );

  // App state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoBase64, setVideoBase64] = useState('');
  const [videoMimeType, setVideoMimeType] = useState('');
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);

  // Step states
  const [diarizedTranscript, setDiarizedTranscript] = useState<DiarizedSegment[]>([]);
  const [timecodedCaptions, setTimecodedCaptions] = useState<Caption[]>([]);
  const [videoDescription, setVideoDescription] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [outputFormat, setOutputFormat] = useState('guide');
  const [generatedContent, setGeneratedContent] = useState('');
  const [videoSummary, setVideoSummary] = useState('');

  // Loading states
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);

  // Modal and pending file state
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [skipAudioProcessing, setSkipAudioProcessing] = useState(false);

  // Retry state
  const [captioningFailed, setCaptioningFailed] = useState(false);
  const [isRetryingCaptions, setIsRetryingCaptions] = useState(false);
  
  // Rewrite state
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number, end: number } | null>(null);
  const [isRewriteModalOpen, setIsRewriteModalOpen] = useState(false);
  const [rewritePrompt, setRewritePrompt] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);


  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
    });
  }, [theme]);
  
  useEffect(() => {
    localStorage.setItem('screenguide-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
      setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const makeProgressUpdater = (startPercent: number, endPercent: number) => {
    return (taskProgress: number) => { // taskProgress is 0-100
        const overallProgress = startPercent + (taskProgress / 100) * (endPercent - startPercent);
        setProgress(overallProgress);
    };
  };

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
    setVideoSummary('');
    setIsProcessingVideo(false);
    setIsGenerating(false);
    setIsZipping(false);
    setIsSummarizing(false);
    setLoadingMessage('');
    setProgress(0);
    setPendingFile(null);
    setCaptioningFailed(false);
    setIsRetryingCaptions(false);
    setSkipAudioProcessing(false);
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
    setCaptioningFailed(false);

    try {
      if (skipAudioProcessing) {
        // ---- Visual captions only flow ----
        setLoadingMessage('Reading video file (1/2)...');
        const base64Data = await fileToBase64(pendingFile, makeProgressUpdater(0, 50));
        setVideoBase64(base64Data);
        setVideoMimeType(pendingFile.type);

        // Skip transcription and set an empty array
        setDiarizedTranscript([]);

        setLoadingMessage('Creating captions (2/2)...');
        const captionsPromise = generateTimecodedCaptions({
            videoBase64: base64Data,
            mimeType: pendingFile.type,
            description: videoDescription,
            userPrompt: userPrompt,
        });
        const captions = await simulateProgress(captionsPromise, makeProgressUpdater(50, 100));
        if (captions?.length > 0) {
          setTimecodedCaptions(captions);
        } else {
          setError(prev => prev ? `${prev}\nCaptioning failed; providing an empty editor.` : 'Captioning failed; providing an empty editor.');
          setTimecodedCaptions([{ text: '', startTime: '00:00:00.000', endTime: '00:00:05.000' }]);
          setCaptioningFailed(true);
        }
      } else {
        // ---- Full processing flow (existing) ----
        setLoadingMessage('Reading video file (1/4)...');
        const base64Data = await fileToBase64(pendingFile, makeProgressUpdater(0, 30));
        setVideoBase64(base64Data);
        setVideoMimeType(pendingFile.type);
  
        setLoadingMessage('Analyzing audio (2/4)...');
        await simulateShortProgress(makeProgressUpdater(30, 40));
  
        setLoadingMessage('Generating speaker diarization (3/4)...');
        const transcriptionPromise = transcribeVideo({
            videoBase64: base64Data,
            mimeType: pendingFile.type,
            description: videoDescription,
            userPrompt: userPrompt,
        });
        const transcribedText = await simulateProgress(transcriptionPromise, makeProgressUpdater(40, 70));
        if (transcribedText.length > 0) {
          setDiarizedTranscript(transcribedText);
        } else {
          setError(prev => prev ? `${prev}\nTranscription failed; providing an empty editor.` : 'Transcription failed; providing an empty editor.');
          setDiarizedTranscript([{ speaker: 'Speaker 1', text: '', startTime: '00:00:00.000', endTime: '00:00:05.000' }]);
        }
  
        setLoadingMessage('Creating captions (4/4)...');
        const captionsPromise = generateTimecodedCaptions({
            videoBase64: base64Data,
            mimeType: pendingFile.type,
            description: videoDescription,
            userPrompt: userPrompt,
        });
        const captions = await simulateProgress(captionsPromise, makeProgressUpdater(70, 100));
        if (captions?.length > 0) {
          setTimecodedCaptions(captions);
        } else {
          setError(prev => prev ? `${prev}\nCaptioning failed; providing an empty editor.` : 'Captioning failed; providing an empty editor.');
          setTimecodedCaptions([{ text: '', startTime: '00:00:00.000', endTime: '00:00:05.000' }]);
          setCaptioningFailed(true);
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      setError(`An error occurred during processing: ${errorMessage}. Please try again.`);
    } finally {
      setIsProcessingVideo(false);
      setLoadingMessage('');
      setProgress(0);
      setPendingFile(null); // Clear pending file after processing
    }
  };

  const handleRetryCaptions = async () => {
      if (!videoBase64 || !videoMimeType) return;
      
      setIsRetryingCaptions(true);
      setError(prev => (prev || '').replace('Captioning failed; providing an empty editor.', '').replace('\n\n', '\n').trim());
      setCaptioningFailed(false);
      setProgress(0);
      
      try {
          const captionsPromise = generateTimecodedCaptions({
              videoBase64,
              mimeType: videoMimeType,
              description: videoDescription,
              userPrompt: userPrompt,
          });
          
          const captions = await simulateProgress(captionsPromise, setProgress);

          if (captions?.length > 0) {
              setTimecodedCaptions(captions);
          } else {
              setError(prev => {
                const newError = 'Captioning failed; providing an empty editor.';
                if (!prev || prev.trim() === '') return newError;
                if (prev.includes(newError)) return prev;
                return `${prev}\n${newError}`;
              });
              setCaptioningFailed(true);
          }
      } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error';
          setError(prev => (prev || '') + `\nFailed to retry caption generation: ${errorMessage}`);
          setCaptioningFailed(true);
      } finally{
          setIsRetryingCaptions(false);
          setProgress(0);
      }
  };

  const handleGenerateSummary = async () => {
    if (!videoBase64) {
      setError('A video must be processed first to generate a summary.');
      return;
    }
    setIsSummarizing(true);
    setError('');
    setVideoSummary('');

    try {
      const transcriptString = diarizedTranscript.map(segment => `${segment.speaker}: ${segment.text}`).join('\n');
      const summary = await generateSummary({
        videoBase64,
        mimeType: videoMimeType,
        transcript: transcriptString,
        description: videoDescription,
      });
      setVideoSummary(summary);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      setError(`Failed to generate summary: ${errorMessage}. Please try again.`);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerate = async () => {
    if (!videoBase64) {
      setError('Missing video.');
      return;
    }
    if (diarizedTranscript.length === 0 && !skipAudioProcessing) {
      setError('Missing transcript. Process a video first or use the "visual captions only" option.');
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
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
      setError(`Failed to generate content: ${errorMessage}. Please try again.`);
    } finally {
      setIsGenerating(false);
      setLoadingMessage('');
      setProgress(0);
    }
  };

  const handleRecord = async (type) => {
    try {
      let stream;
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
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Could not start recording: ${errorMessage}. Please ensure permissions are granted.`);
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
      if (!generatedContent || !videoUrl || outputFormat === 'diagram') return;
  
      setIsZipping(true);
      setError('');
  
      try {
          const zip = new JSZip();
          let updatedContent = generatedContent;
          const imagePlaceholders = [...generatedContent.matchAll(/\[Image: (.*?)(?:\s+at\s+([0-9:.]+))?\]/gi)];
  
          if (imagePlaceholders.length > 0) {
              const imagesFolder = zip.folder("images");
              if (!imagesFolder) throw new Error("Could not create images folder in zip.");
  
              const replacements = await Promise.all(imagePlaceholders.map(async (match, index) => {
                  const placeholder = match[0];
                  const description = match[1];
                  const timecode = match[2];
                  
                  if (timecode) {
                      try {
                          const seconds = timeToSecs(timecode);
                          const blob = await extractFrame(videoUrl, seconds);
                          if (blob) {
                              const imageName = `image-${index + 1}.png`;
                              imagesFolder.file(imageName, blob);
                              const replacementText = `![${description}](./images/${imageName})`;
                              return { placeholder, replacementText };
                          }
                      } catch (e) {
                          // Silently continue if frame extraction fails for individual placeholders
                      }
                  }
                  return null; // Return null if extraction fails or no timecode
              }));

              const validReplacements = replacements.filter((r): r is { placeholder: string; replacementText: string; } => r !== null);
  
              // Sequentially replace placeholders to handle duplicates correctly
              for (const rep of validReplacements) {
                  updatedContent = updatedContent.replace(rep.placeholder, rep.replacementText);
              }
          }
  
          zip.file('guide.md', updatedContent);
  
          const zipBlob = await zip.generateAsync({type: 'blob'});
          downloadFile('ScreenGuide-Export.zip', zipBlob, 'application/zip');
  
      } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
          setError(`Failed to create zip file: ${errorMessage}. Some frames could not be extracted.`);
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

  const handleExportSessionData = async () => {
      if (isZipping) return;
      setIsZipping(true);
      setError('');

      try {
          const zip = new JSZip();

          // 1. Session metadata
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
          zip.file("session.json", JSON.stringify(sessionData, null, 2));

          // 2. Original video file
          if (videoFile) {
              const videoFolder = zip.folder("video");
              if (videoFolder) videoFolder.file(videoFile.name, videoFile);
          }

          // 3. Generated output file and all associated image files.
          if (generatedContent) {
              const fileExtension = outputFormat === 'diagram' ? 'mmd' : 'md';
              const outputFolder = zip.folder("output");
              if (!outputFolder) throw new Error("Could not create output folder.");
              
              let finalContent = generatedContent;

              if (videoUrl && outputFormat !== 'diagram') {
                  const imagePlaceholders = [...generatedContent.matchAll(/\[Image: (.*?)(?:\s+at\s+([0-9:.]+))?\]/gi)];
                  if (imagePlaceholders.length > 0) {
                      const imagesFolder = zip.folder("images");
                      if (!imagesFolder) throw new Error("Could not create images folder.");
                      
                      const replacements = await Promise.all(imagePlaceholders.map(async (match, index) => {
                          const placeholder = match[0];
                          const description = match[1];
                          const timecode = match[2];
                          
                          if (timecode) {
                            try {
                                const seconds = timeToSecs(timecode);
                                const blob = await extractFrame(videoUrl, seconds);
                                if (blob) {
                                    const imageName = `image-${index + 1}.png`;
                                    imagesFolder.file(imageName, blob);
                                    const replacementText = `![${description}](../images/${imageName})`;
                                    return { placeholder, replacementText };
                                }
                            } catch (e) {
                                // Silently continue if frame extraction fails for individual placeholders
                            }
                          }
                          return null;
                      }));

                      const validReplacements = replacements.filter((r): r is { placeholder: string; replacementText: string; } => r !== null);
                      
                      for (const rep of validReplacements) {
                          finalContent = finalContent.replace(rep.placeholder, rep.replacementText);
                      }
                  }
              }
              outputFolder.file(`output.${fileExtension}`, finalContent);
          }
          
          // 4. Subtitle files
          if (diarizedTranscript.length > 0 || timecodedCaptions.length > 0) {
              const subtitlesFolder = zip.folder("subtitles");
              if (subtitlesFolder) {
                  const assContent = exportToAss(diarizedTranscript, timecodedCaptions);
                  subtitlesFolder.file('transcript.ass', assContent);
                  
                  const jsonContent = exportToJson(diarizedTranscript, timecodedCaptions);
                  subtitlesFolder.file('transcript.json', jsonContent);
              }
          }

          // Generate and download zip
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          downloadFile('ScreenGuide-Session.zip', zipBlob, 'application/zip');

      } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
          setError(`Failed to create session zip file: ${errorMessage}. Some assets may be missing.`);
      } finally {
          setIsZipping(false);
      }
  };
  
  const handleSelectionChange = () => {
    if (editorRef.current) {
        const { selectionStart, selectionEnd } = editorRef.current;
        if (selectionStart !== selectionEnd) {
            setSelectionRange({ start: selectionStart, end: selectionEnd });
        } else {
            setSelectionRange(null);
        }
    }
  };

  const handleRewrite = async () => {
      if (!selectionRange || !rewritePrompt) return;
      
      setIsRewriting(true);
      const selectedText = generatedContent.substring(selectionRange.start, selectionRange.end);

      try {
          const rewrittenText = await rewriteText({
              textToRewrite: selectedText,
              prompt: rewritePrompt,
          });

          const newContent = 
              generatedContent.substring(0, selectionRange.start) +
              rewrittenText +
              generatedContent.substring(selectionRange.end);

          setGeneratedContent(newContent);

      } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
          setError(`Failed to rewrite text: ${errorMessage}. Please try again.`);
      } finally {
          setIsRewriting(false);
          setIsRewriteModalOpen(false);
          setRewritePrompt('');
          setSelectionRange(null);
          if (editorRef.current) {
              editorRef.current.blur(); // Deselect text
          }
      }
  };


  const onDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };
  
  const isLoading = isProcessingVideo || isGenerating;

  const processContentForPreview = (content: string) => {
    if (!content) return '';
    return content.replace(
        /\[Image: (.*?)(?:\s+at\s+[0-9:.]+)?\]/gim,
        '<div class="image-placeholder">🖼️ $1</div>'
    );
  };

  return (
    <main
      className={theme}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <header>
        <div className="header-content">
          <h1>ScreenGuide AI</h1>
          <p>Transform Screen Recordings into Technical Documentation</p>
        </div>
        <button onClick={toggleTheme} className="theme-toggle" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            <span className="icon">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
        </button>
      </header>
      <div className={c('container', {'preview-collapsed': isPreviewCollapsed})}>
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
            {error && (
              <div className="error-message">
                <span>{error}</span>
                {captioningFailed && (
                    <button onClick={handleRetryCaptions} disabled={isRetryingCaptions} className="button retry-button">
                        <span className="icon">refresh</span>
                        {isRetryingCaptions ? `Retrying... (${Math.round(progress)}%)` : 'Retry Captions'}
                    </button>
                )}
              </div>
            )}

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

        {/* MIDDLE COLUMN */}
        <div className="middle-column">
            {/* EDITOR PANEL */}
            <section className="panel editor-panel">
                <div className="panel-header">
                    <h2>Editor</h2>
                    <div className="output-actions">
                        {videoBase64 && !isLoading && (
                            <button onClick={handleGenerateSummary} disabled={isSummarizing}>
                                <span className="icon">summarize</span> {isSummarizing ? 'Summarizing...' : 'Summarize'}
                            </button>
                        )}
                        {generatedContent && !isLoading && (
                        <>
                            <button 
                                onClick={() => setIsRewriteModalOpen(true)} 
                                disabled={!selectionRange || isRewriting}
                            >
                                <span className="icon">auto_fix_high</span> Edit with AI
                            </button>
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
                            <button onClick={handleExportSessionData} disabled={isZipping}><span className="icon">dataset</span>{isZipping ? 'Exporting...' : 'Export Session'}</button>
                        </>
                        )}
                    </div>
                </div>

                {(isSummarizing || videoSummary) && (
                    <div className="summary-panel-content">
                        {isSummarizing && (
                            <div className="loading-summary">
                                <div className="spinner-small"></div>
                                <p>Generating summary...</p>
                            </div>
                        )}
                        {!isSummarizing && videoSummary && (
                            <>
                                <h3><span className="icon">auto_awesome</span> AI Summary</h3>
                                <p>{videoSummary}</p>
                            </>
                        )}
                    </div>
                )}

                <div className="panel-content">
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
                            <p>Your generated content will appear here.</p>
                        </div>
                    )}
                    {!isLoading && generatedContent && (
                        <textarea
                            ref={editorRef}
                            value={generatedContent}
                            onChange={(e) => setGeneratedContent(e.target.value)}
                            onSelect={handleSelectionChange}
                            className="editor-textarea-full"
                            aria-label="Markdown content editor"
                        />
                    )}
                </div>
            </section>
        </div>

        {/* PREVIEW PANEL */}
        <section className="panel preview-panel">
            <div className="panel-header">
                <h2>Preview</h2>
                <button onClick={() => setIsPreviewCollapsed(!isPreviewCollapsed)} className="collapse-btn" aria-label={isPreviewCollapsed ? 'Expand preview' : 'Collapse preview'}>
                    <span className="icon">{isPreviewCollapsed ? 'keyboard_double_arrow_left' : 'keyboard_double_arrow_right'}</span>
                </button>
            </div>
            <div className="panel-content editor-preview">
                {!generatedContent && (
                    <div className="empty-output">
                        <p>Preview will appear here.</p>
                    </div>
                )}
                {generatedContent && outputFormat === 'slides' && (
                    generatedContent.split(/\n---\n/).map((slideContent, index) => (
                        <div className="slide" key={index}>
                            <div className="slide-number">{index + 1}</div>
                            <div className="slide-content">
                                <MarkdownPreview
                                    source={processContentForPreview(slideContent.trim())}
                                    rehypePlugins={[[rehypeMermaid]]}
                                    wrapperElement={{ "data-color-mode": theme }}
                                    allowDangerousHtml={true}
                                />
                            </div>
                        </div>
                    ))
                )}
                {generatedContent && outputFormat !== 'slides' && (
                    <MarkdownPreview
                        source={processContentForPreview(outputFormat === 'diagram' ? '```mermaid\n' + generatedContent + '\n```' : generatedContent)}
                        rehypePlugins={[[rehypeMermaid]]}
                        wrapperElement={{ "data-color-mode": theme }}
                        allowDangerousHtml={true}
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
        skipAudio={skipAudioProcessing}
        setSkipAudio={setSkipAudioProcessing}
      />
      <RewriteModal
        isOpen={isRewriteModalOpen}
        onClose={() => setIsRewriteModalOpen(false)}
        onSubmit={handleRewrite}
        selectedText={selectionRange ? generatedContent.substring(selectionRange.start, selectionRange.end) : ''}
        prompt={rewritePrompt}
        setPrompt={setRewritePrompt}
        isRewriting={isRewriting}
      />
    </main>
  );
}