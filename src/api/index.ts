/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */

import { generateText } from "ai";
import { tool } from "ai";
import { z } from "zod";
import type { LanguageModel } from "ai";
import { Buffer } from "buffer";
import { DiarizedSegment, Caption, Settings } from "../types";
import { getLanguageModel } from "../services/aiService";

const setDiarizedTranscriptTool = tool({
  description:
    "Sets the diarized transcript of the video with speaker labels and timecodes for each segment.",
  inputSchema: z.object({
    transcript: z.array(
      z.object({
        speaker: z.string().describe("e.g., 'Speaker 1', 'Speaker 2'"),
        startTime: z
          .string()
          .describe("Start time of the segment in HH:MM:SS.sss format."),
        endTime: z
          .string()
          .describe("End time of the segment in HH:MM:SS.sss format."),
        text: z.string().describe("The transcribed text for this segment."),
      }),
    ),
  }),
});

interface TranscriptionParams {
  settings: Settings;
  videoBase64: string;
  mimeType: string;
  description?: string;
  userPrompt?: string;
}

async function transcribeVideo({
  settings,
  videoBase64,
  mimeType,
  description,
  userPrompt,
}: TranscriptionParams): Promise<DiarizedSegment[]> {
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
    const model = await getLanguageModel(settings, settings.visionModelId);

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              image: Buffer.from(videoBase64, "base64"),
            },
          ],
        },
      ],
      tools: { set_diarized_transcript: setDiarizedTranscriptTool },
    });

    const toolCalls = result.toolCalls;
    if (toolCalls && toolCalls.length > 0) {
      const firstCall = toolCalls[0];
      if (firstCall.toolName === "set_diarized_transcript") {
        return (firstCall as any).args.transcript as DiarizedSegment[];
      }
    }
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : "Unknown error occurred";
    console.error("Transcription failed:", {
      error: e,
      videoMimeType: mimeType,
    });
    throw new Error(`Failed to transcribe video: ${errorMessage}`);
  }
  return [];
}

const setTimecodesTool = tool({
  description: "Set the timecodes for the video with associated text",
  inputSchema: z.object({
    timecodes: z.array(
      z.object({
        startTime: z
          .string()
          .describe("Start time of the caption in HH:MM:SS.sss format."),
        endTime: z
          .string()
          .describe("End time of the caption in HH:MM:SS.sss format."),
        text: z.string(),
      }),
    ),
  }),
});

interface CaptionParams {
  settings: Settings;
  videoBase64: string;
  mimeType: string;
  description?: string;
  userPrompt?: string;
}

async function generateTimecodedCaptions({
  settings,
  videoBase64,
  mimeType,
  description,
  userPrompt,
}: CaptionParams): Promise<Caption[]> {
  let prompt = `For each scene or significant event in this video, generate a caption describing the visual action and any spoken text (in quotes). Provide a precise start and end timecode for each caption in HH:MM:SS.sss format. Use the set_timecodes function to format the output.`;

  if (description) {
    prompt += `\n\nFor context, this video is about: ${description}`;
  }
  if (userPrompt) {
    prompt += `\n\nPay close attention to the following instructions: ${userPrompt}`;
  }

  try {
    const model = await getLanguageModel(settings, settings.visionModelId);

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              image: Buffer.from(videoBase64, "base64"),
            },
          ],
        },
      ],
      tools: { set_timecodes: setTimecodesTool },
    });

    const toolCalls = result.toolCalls;
    if (toolCalls && toolCalls.length > 0) {
      const firstCall = toolCalls[0];
      if (firstCall.toolName === "set_timecodes") {
        return (firstCall as any).args.timecodes as Caption[];
      }
    }
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : "Unknown error occurred";
    console.error("Caption generation failed:", {
      error: e,
      videoMimeType: mimeType,
    });
    throw new Error(`Failed to generate timecoded captions: ${errorMessage}`);
  }

  return [];
}

async function generateGuide({
  settings,
  videoBase64,
  mimeType,
  transcript,
  description,
  prompt,
  format,
}: {
  settings: Settings;
  videoBase64: string;
  mimeType: string;
  transcript: string;
  description: string;
  prompt: string;
  format: string;
}) {
  let formatInstruction: string;

  switch (format) {
    case "guide":
      formatInstruction =
        "A step-by-step guide with numbered lists and placeholders for screenshots. The placeholder format MUST be `[Image: description of the visual at HH:MM:SS.sss]`. The timecode should be the exact moment in the video the visual appears.";
      break;
    case "article":
      formatInstruction =
        "A knowledge base article with structured headings, subheadings, paragraphs, and bullet points. If screenshots are relevant, include placeholders in the format `[Image: description of the visual at HH:MM:SS.sss]`. The timecode should be the exact moment in the video the visual appears.";
      break;
    case "slides":
      formatInstruction =
        "A presentation with a title slide, an agenda, and multiple content slides. Separate each slide with '---'. Use markdown headers for slide titles and bullet points for content. If screenshots are relevant, include placeholders in the format `[Image: description of the visual at HH:MM:SS.sss]`. The timecode should be the exact moment in the video the visual appears. For example:\n# Slide Title\n- Point 1\n- [Image: Login screen at 00:00:12.345]\n- Point 2\n---";
      break;
    case "diagram":
      formatInstruction =
        "A flowchart diagram in Mermaid syntax (using 'graph TD' for a top-down chart) that visually represents the process shown in the video. The output should ONLY be the raw Mermaid code, without the markdown ```mermaid ... ``` wrapper.";
      break;
    default:
      formatInstruction = "A step-by-step guide.";
  }

  const fullPrompt = `You are ScreenGuide AI, an expert technical writer. Your task is to create a guide based on a screen recording.
You will be provided with the video, a transcription of the audio, a high-level description of the video's purpose, the desired output format, and specific instructions.
Analyze the visual actions in the video (mouse clicks, typing, UI changes) and correlate them with the audio transcription to create a comprehensive, chronologically accurate document.

---
Video Description:
${description || "Not provided."}

---
Audio Transcription (user-reviewed):
${transcript}

---
Desired Output Format:
${formatInstruction}

---
Specific Instructions from the user:
${prompt || "Not provided."}

---

Please generate the final content. For Markdown, use standard syntax. For diagrams, output ONLY the raw Mermaid code. Do not include this prompt in your response, only the final content.`;

  const model = await getLanguageModel(settings, settings.visionModelId);

  const result = await generateText({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: fullPrompt },
          {
            type: "image",
            image: Buffer.from(videoBase64, "base64"),
          },
        ],
      },
    ],
  });

  return result.text;
}

async function rewriteText({
  settings,
  textToRewrite,
  prompt,
}: {
  settings: Settings;
  textToRewrite: string;
  prompt: string;
}): Promise<string> {
  const fullPrompt = `You are an expert technical writer. Rewrite the following text based on the user's instructions.
Only return the rewritten text, without any preamble, explanation, or markdown formatting.

---
Instructions from user:
${prompt}

---
Text to rewrite:
${textToRewrite}
---
`;

  try {
    const model = await getLanguageModel(settings, settings.textModelId);

    const result = await generateText({
      model,
      prompt: fullPrompt,
    });

    return result.text.trim();
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : "Unknown error occurred";
    throw new Error(`Failed to rewrite text: ${errorMessage}`);
  }
}

async function generateSummary({
  settings,
  videoBase64,
  mimeType,
  transcript,
  description,
}: {
  settings: Settings;
  videoBase64: string;
  mimeType: string;
  transcript: string;
  description: string;
}): Promise<string> {
  const fullPrompt = `You are an expert technical writer. Generate a concise, one-paragraph summary of the screen recording provided.
Use the video, audio transcription, and high-level description to understand its content and purpose.
The summary should capture the main topic and key takeaways of the video. Keep it to 2-4 sentences.

---
Video Description:
${description || "Not provided."}

---
Audio Transcription:
${transcript || "Not provided."}
---

Generate only the summary paragraph.`;

  try {
    const model = await getLanguageModel(settings, settings.textModelId);

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: fullPrompt },
            {
              type: "image",
              image: Buffer.from(videoBase64, "base64"),
            },
          ],
        },
      ],
    });

    return result.text.trim();
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : "Unknown error occurred";
    throw new Error(`Failed to generate summary: ${errorMessage}`);
  }
}

export {
  transcribeVideo,
  generateGuide,
  generateTimecodedCaptions,
  rewriteText,
  generateSummary,
};
