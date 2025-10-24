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
import { DiarizedSegment, Caption } from './api';

// Helper to convert HH:MM:SS.ms to ASS format H:MM:SS.ss
const toAssTime = (time: string): string => {
    if (!time) return '0:00:00.00';
    const parts = time.split(':');
    const hh = parts[0];
    const mm = parts[1];
    const ssms = parts[2].split('.');
    const ss = ssms[0] || '00';
    const ms = ssms[1] || '000';
    const cs = Math.round(parseInt(ms, 10) / 10).toString().padStart(2, '0');
    return `${parseInt(hh, 10)}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}.${cs}`;
};

export const exportToAss = (transcript: DiarizedSegment[], captions: Caption[]) => {
    // generate styles for speakers
    const speakers = [...new Set(transcript.map(t => t.speaker))];
    const colors = ['&H00FFFF&', '&H00FF00&', '&HFFFF00&', '&H0000FF&', '&HFF00FF&', '&HFF8080&', '&H80FF80&', '&H8080FF&'];
    const speakerStyles = speakers.map((speaker, i) => 
        `Style: ${speaker.replace(/,/g, '')},Arial,20,&H00FFFFFF,${colors[i % colors.length]},&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1`
    ).join('\n');
    const narratorStyle = 'Style: Narrator,Arial,18,&H00B4B4B4,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1';
    
    // combine and sort all events
    const transcriptEvents = transcript.map(t => ({...t, type: 'transcript', style: t.speaker.replace(/,/g, '')}));
    const captionEvents = captions.map(c => ({...c, type: 'caption', style: 'Narrator'}));
    
    const allEvents = [...transcriptEvents, ...captionEvents]
        .filter(event => event.startTime && event.endTime)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const events = allEvents.map(event => {
        const start = toAssTime(event.startTime);
        const end = toAssTime(event.endTime);
        const text = event.text.replace(/\n/g, '\\N'); // ASS newlines are \N
        return `Dialogue: 0,${start},${end},${event.style},,0,0,0,,${text}`;
    }).join('\n');

    return `[Script Info]
Title: ScreenGuide AI Export
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1280
PlayResY: 720
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1
${narratorStyle}
${speakerStyles}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`;
};

export const exportToJson = (transcript: DiarizedSegment[], captions: Caption[]) => {
    return JSON.stringify({
        diarizedTranscript: transcript,
        avCaptions: captions,
    }, null, 2);
};

export const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const markdownToRtf = (markdown: string): string => {
  if (!markdown) return '';

  const escapeRtf = (str: string) => {
    return str.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
  };

  let rtfContent = markdown;

  // Process slides first by replacing splitter with a page break
  const slides = rtfContent.split(/\n---\n/);
  if (slides.length > 1) {
    rtfContent = slides.join('\\page ');
  }

  // Process line by line for lists and headers
  const lines = rtfContent.split('\n');
  const rtfLines = lines.map(line => {
    let rtfLine = escapeRtf(line.trim());

    // Headers
    if (rtfLine.startsWith('# ')) {
      return `{\\pard\\sa200\\sl276\\slmult1\\b\\f0\\fs32 ${rtfLine.substring(2)}\\par}`;
    }
    if (rtfLine.startsWith('## ')) {
      return `{\\pard\\sa200\\sl276\\slmult1\\b\\f0\\fs28 ${rtfLine.substring(3)}\\par}`;
    }
    if (rtfLine.startsWith('### ')) {
      return `{\\pard\\sa200\\sl276\\slmult1\\b\\f0\\fs24 ${rtfLine.substring(4)}\\par}`;
    }
    
    // Unordered List
    if (rtfLine.match(/^[-*] /)) {
        return `{\\pard\\fi-360\\li720 {\\pntext\\f0\\'B7\\tab} ${rtfLine.substring(2)}\\par}`;
    }
    
    // Ordered List
    const olMatch = rtfLine.match(/^(\d+)\. /);
    if (olMatch) {
        return `{\\pard\\fi-360\\li720 {\\pntext\\f0 ${olMatch[1]}.\\tab} ${rtfLine.substring(olMatch[0].length)}\\par}`;
    }

    // Bold and Italic (within a line)
    rtfLine = rtfLine.replace(/\*\*(.*?)\*\*/g, '{\\b $1}');
    rtfLine = rtfLine.replace(/\*(.*?)\*/g, '{\\i $1}');
    
    // Image placeholders
    rtfLine = rtfLine.replace(
        /\[Image: (.*?)(?:\s+at\s+[0-9:.]+)?\]/g,
        '{\\pard\\qc\\i [Image: $1]\\par}',
    );

    // Default paragraph
    return `{\\pard\\sa200\\sl276\\slmult1\\f0\\fs22 ${rtfLine}\\par}`;
  });

  return `{\\rtf1\\ansi\\deff0\n${rtfLines.join('\n')}\n}`;
};