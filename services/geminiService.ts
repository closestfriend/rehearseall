
import { GoogleGenAI, Type } from "@google/genai";
import { MODELS, SYSTEM_INSTRUCTION_FEEDBACK } from "../constants";
import { InterviewFeedback, ResumeData, InterviewMessage } from "../types";
import { formatTranscriptForEvaluator } from "../lib/transcriptFormat";
import { buildEvaluatorPrompt } from "../lib/evaluatorPrompt";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
  }

  async generateFeedback(resume: ResumeData, transcript: InterviewMessage[]): Promise<InterviewFeedback> {
    const chatTranscript = formatTranscriptForEvaluator(transcript);

    const prompt = buildEvaluatorPrompt(resume, chatTranscript);

    const response = await this.ai.models.generateContent({
      model: MODELS.EVALUATOR,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_FEEDBACK,
        responseMimeType: "application/json",
        maxOutputTokens: 16384,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
            detailedAnalysis: { type: Type.STRING },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  replyIndex: { type: Type.NUMBER },
                  critique: { type: Type.STRING },
                  modelAnswer: { type: Type.STRING }
                },
                required: ["replyIndex", "critique", "modelAnswer"]
              }
            }
          },
          required: ["score", "strengths", "improvements", "detailedAnalysis"]
        }
      }
    });

    const raw = response.text;
    if (!raw) {
      throw new Error(`Evaluator returned empty response. finishReason=${(response as any)?.candidates?.[0]?.finishReason}`);
    }
    try {
      return JSON.parse(raw);
    } catch (parseErr) {
      const finishReason = (response as any)?.candidates?.[0]?.finishReason;
      const preview = raw.slice(0, 200);
      throw new Error(`Failed to parse evaluator JSON (finishReason=${finishReason}, len=${raw.length}). Preview: ${preview}`);
    }
  }
}

export const geminiService = new GeminiService();
