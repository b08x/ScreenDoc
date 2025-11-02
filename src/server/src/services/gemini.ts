import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

interface Caption { startTime: string; endTime: string; text: string; }
interface DiarizedSegment { speaker: string; startTime: string; endTime: string; text: string; }
interface BaseParams { videoBase64: string; mimeType: string; description?: string; userPrompt?: string; }

const setDiarizedTranscriptFunctionDeclaration: FunctionDeclaration = {
    name: 'set_diarized_transcript',
    description: 'Sets the diarized transcript of the video with speaker labels and timecodes for each segment.',
    parameters: { type: Type.OBJECT, properties: { transcript: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { speaker: { type: Type.STRING }, startTime: { type: Type.STRING }, endTime: { type: Type.STRING }, text: { type: Type.STRING } }, required: ['speaker', 'startTime', 'endTime', 'text'] } } }, required: ['transcript'] },
};

export async function transcribeVideo({ videoBase64, mimeType, description, userPrompt }: BaseParams): Promise<DiarizedSegment[]> {
  const model = 'gemini-2.5-pro';
  let prompt = `Generate a verbatim text transcription of the audio in this video. Identify each speaker, label them consistently (e.g., "Speaker 1"), provide precise start/end timecodes (HH:MM:SS.sss), and use 'set_diarized_transcript' to format your response.`;
  if (description) prompt += `\n\nContext: ${description}`;
  if (userPrompt) prompt += `\n\nInstructions: ${userPrompt}`;
  
  const response = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{text: prompt}, { inlineData: { mimeType, data: videoBase64 } }] }], config: { tools: [{functionDeclarations: [setDiarizedTranscriptFunctionDeclaration]}] } });
  const functionCall = response.functionCalls?.[0];
  if (functionCall?.name === 'set_diarized_transcript' && functionCall.args.transcript) {
    return functionCall.args.transcript as DiarizedSegment[];
  }
  return [];
}

const setTimecodesFunctionDeclaration: FunctionDeclaration = {
    name: 'set_timecodes',
    description: 'Set the timecodes for the video with associated text',
    parameters: { type: Type.OBJECT, properties: { timecodes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { startTime: { type: Type.STRING }, endTime: { type: Type.STRING }, text: { type: Type.STRING } }, required: ['startTime', 'endTime', 'text'] } } }, required: ['timecodes'] },
};

export async function generateTimecodedCaptions({ videoBase64, mimeType, description, userPrompt }: BaseParams): Promise<Caption[]> {
  const model = 'gemini-2.5-pro';
  let prompt = `For each scene or significant event, generate a caption describing the visual action and any spoken text (in quotes). Provide precise start/end timecodes (HH:MM:SS.sss). Use 'set_timecodes' to format the output.`;
  if (description) prompt += `\n\nContext: ${description}`;
  if (userPrompt) prompt += `\n\nInstructions: ${userPrompt}`;

  const response = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{text: prompt}, { inlineData: { mimeType, data: videoBase64 } }] }], config: { tools: [{functionDeclarations: [setTimecodesFunctionDeclaration]}] } });
  const functionCall = response.functionCalls?.[0];
  if (functionCall?.name === 'set_timecodes' && functionCall.args.timecodes) {
    return functionCall.args.timecodes as Caption[];
  }
  return [];
}

export async function generateGuide({ videoBase64, mimeType, transcript, description, prompt, format }: { videoBase64: string; mimeType: string; transcript: string; description: string; prompt: string; format: string; }) {
  const model = 'gemini-2.5-pro';
  const formatInstructions: Record<string, string> = {
      guide: "A step-by-step guide with numbered lists and image placeholders: `[Image: description at HH:MM:SS.sss]`.",
      article: "A knowledge base article with headings and paragraphs, using image placeholders.",
      slides: "A presentation separated by '---', using markdown headers for titles, and image placeholders.",
      diagram: "A flowchart in Mermaid syntax ('graph TD'). Output ONLY the raw Mermaid code.",
  };
  const formatInstruction = formatInstructions[format] || formatInstructions.guide;

  const fullPrompt = `You are ScreenGuide AI. Create a guide from a screen recording. Analyze visuals and audio to create a comprehensive, chronological document.\n\nVideo Description: ${description || 'N/A'}\nAudio Transcription: ${transcript}\nOutput Format: ${formatInstruction}\nUser Instructions: ${prompt || 'N/A'}\n\nGenerate the final content only.`;
  const response = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{text: fullPrompt}, { inlineData: { mimeType, data: videoBase64 } }] }] });
  return response.text;
}

export async function rewriteText({ textToRewrite, prompt }: { textToRewrite: string; prompt: string; }): Promise<string> {
    const model = 'gemini-2.5-flash';
    const fullPrompt = `Rewrite the following text based on the user's instructions. Only return the rewritten text.\n\nInstructions: ${prompt}\n\nText to rewrite:\n${textToRewrite}`;
    const response = await ai.models.generateContent({ model, contents: [{ parts: [{ text: fullPrompt }] }] });
    return response.text.trim();
}

export async function generateSummary({ videoBase64, mimeType, transcript, description }: { videoBase64: string; mimeType: string; transcript: string; description: string; }): Promise<string> {
    const model = 'gemini-2.5-flash';
    const fullPrompt = `Generate a concise, one-paragraph (2-4 sentences) summary of the provided screen recording, using the video, transcription, and description.\n\nDescription: ${description || 'N/A'}\nTranscription: ${transcript || 'N/A'}\n\nGenerate only the summary paragraph.`;
    const response = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: fullPrompt }, { inlineData: { mimeType, data: videoBase64 } }] }] });
    return response.text.trim();
}
