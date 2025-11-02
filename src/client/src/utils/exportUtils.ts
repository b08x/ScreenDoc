import { DiarizedSegment, Caption } from '../types';

const toAssTime = (time: string): string => {
    if (!time) return '0:00:00.00';
    const timeParts = time.split('.');
    const ms = (timeParts[1] || '000').padEnd(3, '0');
    const cs = Math.round(parseInt(ms, 10) / 10).toString().padStart(2, '0');
    
    const hmsParts = timeParts[0].split(':');
    if (hmsParts.length === 3) { // HH:MM:SS
        return `${parseInt(hmsParts[0], 10)}:${hmsParts[1]}:${hmsParts[2]}.${cs}`;
    }
    if (hmsParts.length === 2) { // MM:SS
        return `0:${hmsParts[0]}:${hmsParts[1]}.${cs}`;
    }
    if (hmsParts.length === 1) { // SS
        return `0:00:${hmsParts[0]}.${cs}`;
    }
    return '0:00:00.00';
};

export const exportToAss = (transcript: DiarizedSegment[], captions: Caption[]): string => {
    const speakers = [...new Set(transcript.map(t => t.speaker))];
    const colors = ['&H00FFFF&', '&H00FF00&', '&HFFFF00&', '&H0000FF&', '&HFF00FF&'];
    const speakerStyles = speakers.map((speaker, i) => `Style: ${speaker.replace(/,/g, '')},Arial,20,&H00FFFFFF,${colors[i % colors.length]},&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1`).join('\n');
    const allEvents = [
        ...transcript.map(t => ({...t, style: t.speaker.replace(/,/g, '')})),
        ...captions.map(c => ({...c, style: 'Narrator'}))
    ].filter(e => e.startTime && e.endTime).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const events = allEvents.map(e => `Dialogue: 0,${toAssTime(e.startTime)},${toAssTime(e.endTime)},${e.style},,0,0,0,,${e.text.replace(/\n/g, '\\N')}`).join('\n');
    return `[Script Info]
Title: ScreenGuide AI Export
ScriptType: v4.00+
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1
Style: Narrator,Arial,18,&H00B4B4B4,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1
${speakerStyles}
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}`;
};

export const exportToJson = (transcript: DiarizedSegment[], captions: Caption[]): string => {
    return JSON.stringify({ diarizedTranscript: transcript, avCaptions: captions }, null, 2);
};

export const downloadFile = (filename: string, content: string | Blob, mimeType: string) => {
    const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
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
  const escapeRtf = (str: string) => str.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
  let rtfContent = markdown.split(/\n---\n/).join('\\page ');
  const lines = rtfContent.split('\n').map(line => {
    let rtfLine = escapeRtf(line.trim())
      .replace(/\*\*(.*?)\*\*/g, '{\\b $1}')
      .replace(/\*(.*?)\*/g, '{\\i $1}');
    if (rtfLine.startsWith('# ')) return `{\\pard\\sa200\\b\\fs32 ${rtfLine.substring(2)}\\par}`;
    if (rtfLine.startsWith('## ')) return `{\\pard\\sa200\\b\\fs28 ${rtfLine.substring(3)}\\par}`;
    if (rtfLine.startsWith('### ')) return `{\\pard\\sa200\\b\\fs24 ${rtfLine.substring(4)}\\par}`;
    if (rtfLine.match(/^[-*] /)) return `{\\pard\\fi-360\\li720 {\\pntext\\f0\\'B7\\tab} ${rtfLine.substring(2)}\\par}`;
    const olMatch = rtfLine.match(/^(\d+)\. /);
    if (olMatch) return `{\\pard\\fi-360\\li720 {\\pntext\\f0 ${olMatch[1]}.\\tab} ${rtfLine.substring(olMatch[0].length)}\\par}`;
    rtfLine = rtfLine.replace(/\[Image: (.*?)(?:\s+at\s+[0-9:.]+)?\]/g, '{\\pard\\qc\\i [Image: $1]\\par}');
    return `{\\pard\\sa200\\fs22 ${rtfLine}\\par}`;
  });
  return `{\\rtf1\\ansi\\deff0\n${lines.join('\n')}\n}`;
};
