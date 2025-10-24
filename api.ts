/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {GoogleGenAI, FunctionDeclaration, Type, Content, GenerateContentResponse} from '@google/genai';

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

export interface Caption {
  startTime: string; // e.g., "00:01:23.456"
  endTime: string;
  text: string;
}

export interface DiarizedSegment {
  speaker: string;
  startTime: string; // e.g., "00:01:23.456"
  endTime: string;
  text: string;
}

export interface GroundingSource {
    uri: string;
    title: string;
}

const setDiarizedTranscriptFunctionDeclaration: FunctionDeclaration = {
    name: 'set_diarized_transcript',
    description: 'Sets the diarized transcript of the video with speaker labels and timecodes for each segment.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        transcript: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              speaker: { type: Type.STRING, description: "e.g., 'Speaker 1', 'Speaker 2'" },
              startTime: { type: Type.STRING, description: "Start time of the segment in HH:MM:SS.sss format." },
              endTime: { type: Type.STRING, description: "End time of the segment in HH:MM:SS.sss format." },
              text: { type: Type.STRING, description: "The transcribed text for this segment." },
            },
            required: ['speaker', 'startTime', 'endTime', 'text'],
          },
        },
      },
      required: ['transcript'],
    },
};

interface TranscriptionParams {
    videoBase64: string;
    mimeType: string;
    description?: string;
    userPrompt?: string;
}

async function transcribeVideo({ videoBase64, mimeType, description, userPrompt }: TranscriptionParams): Promise<DiarizedSegment[]> {
  const model = 'gemini-2.5-pro';
  let prompt = `Generate a verbatim text transcription of the audio in this video.
- Identify each speaker and label them consistently (e.g., "Speaker 1", "Speaker 2").
- Provide precise start and end timecodes for each spoken segment in HH:MM:SS.sss format.
- Use the 'set_diarized_transcript' function to format your response.`;

  if (description) {
    prompt += `\n\nFor context, this video is about: ${description}`;
  }
  if (userPrompt) {
    prompt += `\n\nPay close attention to the following instructions: ${userPrompt}`;
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        { role: 'user', parts: [{text: prompt}, { inlineData: { mimeType: mimeType, data: videoBase64, }, }, ], },
      ],
      config: {
          tools: [{functionDeclarations: [setDiarizedTranscriptFunctionDeclaration]}],
      }
    });
    
    const functionCall = response.functionCalls?.[0];
    if (functionCall?.name === 'set_diarized_transcript' && functionCall.args.transcript) {
      return functionCall.args.transcript as DiarizedSegment[];
    }
  } catch (e) {
      console.error("Error transcribing video:", e);
  }
  return [];
}

const setTimecodesFunctionDeclaration: FunctionDeclaration = {
    name: 'set_timecodes',
    description: 'Set the timecodes for the video with associated text',
    parameters: {
      type: Type.OBJECT,
      properties: {
        timecodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              startTime: { type: Type.STRING, description: "Start time of the caption in HH:MM:SS.sss format." },
              endTime: { type: Type.STRING, description: "End time of the caption in HH:MM:SS.sss format." },
              text: { type: Type.STRING, },
            },
            required: ['startTime', 'endTime', 'text'],
          },
        },
      },
      required: ['timecodes'],
    },
};

interface CaptionParams {
    videoBase64: string;
    mimeType: string;
    description?: string;
    userPrompt?: string;
}

async function generateTimecodedCaptions({ videoBase64, mimeType, description, userPrompt }: CaptionParams): Promise<Caption[]> {
  const model = 'gemini-2.5-pro';
  let prompt = `For each scene or significant event in this video, generate a caption describing the visual action and any spoken text (in quotes). Provide a precise start and end timecode for each caption in HH:MM:SS.sss format. Use the set_timecodes function to format the output.`;

  if (description) {
    prompt += `\n\nFor context, this video is about: ${description}`;
  }
  if (userPrompt) {
    prompt += `\n\nPay close attention to the following instructions: ${userPrompt}`;
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        {
          role: 'user',
          parts: [
            {text: prompt},
            {
              inlineData: {
                mimeType: mimeType,
                data: videoBase64,
              },
            },
          ],
        },
      ],
      config: {
          tools: [{functionDeclarations: [setTimecodesFunctionDeclaration]}],
      }
    });
    
    const functionCall = response.functionCalls?.[0];
  
    if (functionCall?.name === 'set_timecodes' && functionCall.args.timecodes) {
      return functionCall.args.timecodes as Caption[];
    }
  } catch (e) {
      console.error("Error generating timecoded captions:", e);
  }
  
  return [];
}


async function generateGuide({videoBase64, mimeType, transcript, description, prompt, format, context}: { videoBase64: string; mimeType: string; transcript: string; description: string; prompt: string; format: string; context?: string; }) {
  const model = 'gemini-2.5-pro';
  let formatInstruction: string;

  switch (format) {
    case 'guide':
      formatInstruction = "A step-by-step guide with numbered lists and placeholders for screenshots. The placeholder format MUST be `[Image: description of the visual at HH:MM:SS.sss]`. The timecode should be the exact moment in the video the visual appears.";
      break;
    case 'article':
      formatInstruction = "A knowledge base article with structured headings, subheadings, paragraphs, and bullet points. If screenshots are relevant, include placeholders in the format `[Image: description of the visual at HH:MM:SS.sss]`. The timecode should be the exact moment in the video the visual appears.";
      break;
    case 'slides':
      formatInstruction = "A presentation with a title slide, an agenda, and multiple content slides. Separate each slide with '---'. Use markdown headers for slide titles and bullet points for content. If screenshots are relevant, include placeholders in the format `[Image: description of the visual at HH:MM:SS.sss]`. The timecode should be the exact moment in the video the visual appears. For example:\n# Slide Title\n- Point 1\n- [Image: Login screen at 00:00:12.345]\n- Point 2\n---";
      break;
    case 'diagram':
      formatInstruction = "A flowchart diagram in Mermaid syntax (using 'graph TD' for a top-down chart) that visually represents the process shown in the video. The output should ONLY be the raw Mermaid code, without the markdown ```mermaid ... ``` wrapper.";
      break;
    default:
      formatInstruction = 'A step-by-step guide.';
  }

  const fullPrompt = `You are ScreenGuide AI, an expert technical writer. Your task is to create a guide based on a screen recording.
You will be provided with the video, a transcription of the audio, a high-level description of the video's purpose, the desired output format, and specific instructions.
Analyze the visual actions in the video (mouse clicks, typing, UI changes) and correlate them with the audio transcription to create a comprehensive, chronologically accurate document.

---
Video Description:
${description || 'Not provided.'}

---
Audio Transcription (user-reviewed):
${transcript}

---
Additional Context from AI Assistant Chat:
${context || 'Not provided.'}

---
Desired Output Format:
${formatInstruction}

---
Specific Instructions from the user:
${prompt || 'Not provided.'}

---

Please generate the final content. For Markdown, use standard syntax. For diagrams, output ONLY the raw Mermaid code. Do not include this prompt in your response, only the final content.`;

  const response = await ai.models.generateContent({
    model: model,
    contents: [
      {
        role: 'user',
        parts: [
          {text: fullPrompt},
          {
            inlineData: {
              mimeType: mimeType,
              data: videoBase64,
            },
          },
        ],
      },
    ],
  });

  return response.text;
}

export const getChatResponse = async (
    history: Content[],
    latestMessage: string,
    currentDraft?: string | null,
): Promise<{ text: string; sources: GroundingSource[] }> => {
    let systemInstruction;
    let userMessage = latestMessage;

    if (currentDraft) {
        systemInstruction = `You are an AI assistant helping a user edit a technical document.
If the user's request seems like an edit instruction (e.g., "change the title", "add a step", "rephrase this part"), you MUST respond with the full, updated document content inside a single \`\`\`markdown code block. You can add a short confirmation message before the code block, like "Of course, here is the updated version:".
If the request is clearly a question and not an edit, provide a conversational answer.`;
        userMessage = `${latestMessage}\n\n(For context, here is the current document draft:\n---\n${currentDraft}\n---)`;
    } else {
        systemInstruction = `You are a helpful AI assistant called ScreenGuide AI. You can answer questions related to the user's video and documentation. When relevant, use search to find up-to-date information.`;
    }

    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history,
        config: {
            systemInstruction,
            tools: [{googleSearch: {}}],
        }
    });

    const response: GenerateContentResponse = await chat.sendMessage({ message: userMessage });
    
    const text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    
    const sources: GroundingSource[] = groundingChunks
        .filter(chunk => chunk.web)
        .map(chunk => ({
            uri: chunk.web.uri,
            title: chunk.web.title,
        }));

    return { text, sources };
}

export {transcribeVideo, generateGuide, generateTimecodedCaptions};