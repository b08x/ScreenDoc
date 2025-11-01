/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */

import {
    GoogleGenerativeAI,
    GenerationConfig,
    GenerativeModel,
    Part,
} from "@google/generative-ai";
import type { Settings, DiarizedSegment, Caption } from "../../types";
import { nativeSetDiarizedTranscriptTool, nativeSetTimecodesTool } from "../../api/google-native-tools";

let genAI: GoogleGenerativeAI;

function getGenAI(apiKey: string): GoogleGenerativeAI {
    if (!genAI) {
        genAI = new GoogleGenerativeAI(apiKey);
    }
    return genAI;
}

export function getNativeGoogleModel(settings: Settings, isTextModel = false): GenerativeModel {
    const genAI = getGenAI(settings.apiKey);
    const modelId = isTextModel ? settings.textModelId : settings.visionModelId;
    return genAI.getGenerativeModel({ model: modelId });
}

function buildMultimodalParts(videoBase64: string, mimeType: string, prompt: string): Part[] {
    return [
        { text: prompt },
        {
            inlineData: {
                mimeType: mimeType,
                data: videoBase64,
            },
        },
    ];
}

export async function nativeTranscribeVideo(
    settings: Settings,
    videoBase64: string,
    mimeType: string,
    description?: string,
    userPrompt?: string
): Promise<DiarizedSegment[]> {
    let prompt = `Generate a verbatim text transcription...`; // Full prompt
    if (description) prompt += `\n\nFor context...`;
    if (userPrompt) prompt += `\n\nPay close attention...`;

    try {
        const model = getNativeGoogleModel(settings);
        const chat = model.startChat({
            tools: [nativeSetDiarizedTranscriptTool],
            toolConfig: {
                functionCallingConfig: {
                    mode: "ANY",
                },
            },
        });
        const parts = buildMultimodalParts(videoBase64, mimeType, prompt);
        const result = await chat.sendMessage(parts);
        const call = result.response.functionCalls()?.[0];
        if (call?.name === 'set_diarized_transcript') {
            return call.args.transcript as DiarizedSegment[];
        }
    } catch (e) {
        console.error("Native transcription failed:", e);
        throw new Error(`Failed to transcribe video: ${e instanceof Error ? e.message : e}`);
    }
    return [];
}

export async function nativeGenerateTimecodedCaptions(
    settings: Settings,
    videoBase64: string,
    mimeType: string,
    description?: string,
    userPrompt?: string
): Promise<Caption[]> {
    let prompt = `For each scene or significant event...`; // Full prompt
    if (description) prompt += `\n\nFor context...`;
    if (userPrompt) prompt += `\n\nPay close attention...`;

    try {
        const model = getNativeGoogleModel(settings);
        const chat = model.startChat({
            tools: [nativeSetTimecodesTool],
            toolConfig: {
                functionCallingConfig: {
                    mode: "ANY",
                },
            },
        });
        const parts = buildMultimodalParts(videoBase64, mimeType, prompt);
        const result = await chat.sendMessage(parts);
        const call = result.response.functionCalls()?.[0];
        if (call?.name === 'set_timecodes') {
            return call.args.timecodes as Caption[];
        }
    } catch (e) {
        console.error("Native caption generation failed:", e);
        throw new Error(`Failed to generate captions: ${e instanceof Error ? e.message : e}`);
    }
    return [];
}

export async function nativeGenerateGuide(
    settings: Settings,
    videoBase64: string,
    mimeType: string,
    transcript: string,
    description: string,
    prompt: string,
    format: string
): Promise<string> {
    const fullPrompt = `You are ScreenGuide AI...`; // Full prompt
    try {
        const model = getNativeGoogleModel(settings);
        const parts = buildMultimodalParts(videoBase64, mimeType, fullPrompt);
        const result = await model.generateContent(parts);
        return result.response.text();
    } catch (e) {
        console.error("Native guide generation failed:", e);
        throw new Error(`Failed to generate guide: ${e instanceof Error ? e.message : e}`);
    }
}

export async function nativeRewriteText(
    settings: Settings,
    textToRewrite: string,
    prompt: string
): Promise<string> {
    const fullPrompt = `You are an expert technical writer...`; // Full prompt
    try {
        const model = getNativeGoogleModel(settings, true);
        const result = await model.generateContent(fullPrompt);
        return result.response.text();
    } catch (e) {
        console.error("Native rewrite failed:", e);
        throw new Error(`Failed to rewrite text: ${e instanceof Error ? e.message : e}`);
    }
}

export async function nativeGenerateSummary(
    settings: Settings,
    videoBase64: string,
    mimeType: string,
    transcript: string,
    description: string
): Promise<string> {
    const fullPrompt = `You are an expert technical writer...`; // Full prompt
    try {
        const model = getNativeGoogleModel(settings);
        const parts = buildMultimodalParts(videoBase64, mimeType, fullPrompt);
        const result = await model.generateContent(parts);
        return result.response.text();
    } catch (e) {
        console.error("Native summary generation failed:", e);
        throw new Error(`Failed to generate summary: ${e instanceof Error ? e.message : e}`);
    }
}