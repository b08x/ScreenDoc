import { FunctionDeclarationsTool } from "@google/generative-ai";
import { z, ZodType } from "zod";

/**
 * Converts a Zod schema to a Google-compatible JSON schema by removing unsupported properties.
 * @param schema The Zod schema to convert.
 * @returns A JSON schema object compatible with Google's API.
 */
function zodToGoogleSchema(schema: ZodType): any {
    const jsonSchema = z.toJSONSchema(schema) as any;

    function recursivelyRemoveProperties(obj: any) {
        if (typeof obj !== 'object' || obj === null) {
            return;
        }

        // The Google API does not support '$schema' or 'additionalProperties'
        delete obj.$schema;
        delete obj.additionalProperties;

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                recursivelyRemoveProperties(obj[key]);
            }
        }
    }

    recursivelyRemoveProperties(jsonSchema);
    return jsonSchema;
}

// Zod schemas for consistent validation
const transcriptSchema = z.object({
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
});

const timecodesSchema = z.object({
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
});

// Tool declarations for the native Google Generative AI SDK
export const nativeSetDiarizedTranscriptTool: FunctionDeclarationsTool = {
    functionDeclarations: [
        {
            name: "set_diarized_transcript",
            description: "Sets the diarized transcript of the video with speaker labels and timecodes for each segment.",
            parameters: zodToGoogleSchema(transcriptSchema),
        }
    ]
};

export const nativeSetTimecodesTool: FunctionDeclarationsTool = {
    functionDeclarations: [
        {
            name: "set_timecodes",
            description: "Set the timecodes for the video with associated text",
            parameters: zodToGoogleSchema(timecodesSchema),
        }
    ]
};

