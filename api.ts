/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {GoogleGenAI, FunctionDeclaration, Type} from '@google/genai';

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

// Fix: Define Caption interface for type safety.
interface Caption {
  time: string;
  text: string;
}

async function transcribeVideo({ videoBase64, mimeType }: { videoBase64: string; mimeType: string; }) {
  const model = 'gemini-2.5-pro';
  const prompt =
    'Generate a verbatim text transcription of the audio in this video. Only output the transcribed text, with no extra formatting or commentary.';

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
  });

  return response.text;
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
              time: {
                type: Type.STRING,
              },
              text: {
                type: Type.STRING,
              },
            },
            required: ['time', 'text'],
          },
        },
      },
      required: ['timecodes'],
    },
};

// Fix: Add explicit return type to prevent it from being inferred as `unknown[]`.
async function generateTimecodedCaptions({ videoBase64, mimeType }: { videoBase64: string; mimeType: string; }): Promise<Caption[]> {
  const model = 'gemini-2.5-pro';
  const prompt = `For each scene in this video, generate captions that describe the scene along with any spoken text placed in quotation marks. Place each caption into an object sent to set_timecodes with the timecode of the caption in the video.`;

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
      // Fix: Cast the result to the correct type.
      return functionCall.args.timecodes as Caption[];
    }
  } catch (e) {
      console.error("Error generating timecoded captions:", e);
  }
  
  return [];
}


async function generateGuide({videoBase64, mimeType, transcript, description, prompt, format}: { videoBase64: string; mimeType: string; transcript: string; description: string; prompt: string; format: string; }) {
  const model = 'gemini-2.5-pro';
  const formatInstruction =
    format === 'guide'
      ? 'A step-by-step guide with numbered lists and placeholders for screenshots like [Image: description of the visual].'
      : 'A knowledge base article with structured headings, subheadings, paragraphs, and bullet points.';

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
Desired Output Format:
${formatInstruction}

---
Specific Instructions from the user:
${prompt || 'Not provided.'}

---

Please generate the final content in Markdown format. Do not include this prompt in your response, only the final markdown document.`;

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

export {transcribeVideo, generateGuide, generateTimecodedCaptions};