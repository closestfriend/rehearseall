import { GoogleGenAI, Type } from '@google/genai';
import type { ConversationSetup, InterviewMessage } from '../types';
import { buildPracticeKickoff, buildPracticeSystemInstruction, getPersona, pickPersona } from '../api/_lib/prompts';
import { buildEvaluatorPrompt } from '../api/_lib/evaluatorPrompt';
import { formatTranscriptForEvaluator } from '../api/_lib/transcriptFormat';
import { MODEL_ROUTES, generationConfig } from '../api/_lib/modelRouting';
import { COMPETENCIES, type Competency } from './scenarios';
import type { Scorecard } from './store';

/** What the rehearsal server needs from a model. Faked in tests. */
export interface RehearsalLLM {
  /** The counterpart's next spoken line, given everything said so far. */
  counterpartTurn(setup: ConversationSetup, personaId: string, messages: InterviewMessage[]): Promise<string>;
  /** Score a finished rehearsal on the scenario's competencies. */
  score(setup: ConversationSetup, competencies: Competency[], messages: InterviewMessage[]): Promise<Scorecard>;
  /** A persona id for a fresh session. */
  choosePersona(): string;
}

const SCORECARD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER },
    headline: { type: Type.STRING },
    competencyScores: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          competency: { type: Type.STRING, enum: [...COMPETENCIES] },
          score: { type: Type.NUMBER },
          evidence: { type: Type.STRING },
        },
        required: ['competency', 'score', 'evidence'],
      },
    },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
    tryNextTime: { type: Type.STRING },
  },
  required: ['overallScore', 'headline', 'competencyScores', 'strengths', 'improvements', 'tryNextTime'],
};

/** Same shape as SCORECARD_SCHEMA, as plain JSON Schema for OpenAI-compatible gateways. */
export const SCORECARD_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overallScore: { type: 'number' },
    headline: { type: 'string' },
    competencyScores: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          competency: { type: 'string', enum: [...COMPETENCIES] },
          score: { type: 'number' },
          evidence: { type: 'string' },
        },
        required: ['competency', 'score', 'evidence'],
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    improvements: { type: 'array', items: { type: 'string' } },
    tryNextTime: { type: 'string' },
  },
  required: ['overallScore', 'headline', 'competencyScores', 'strengths', 'improvements', 'tryNextTime'],
};

export function scorecardInstruction(competencies: Competency[]): string {
  return `
You evaluate a spoken rehearsal for an important real-world conversation.
Write in ENGLISH. Judge the user's effectiveness in this specific exchange, not their personality.
The transcript came from speech recognition: never penalize suspected transcription noise.

Score each of these skills from 0 to 100, and only these: ${competencies.join(', ')}.
For each, give one sentence of evidence that quotes or closely paraphrases what the user actually said.
Then give an overall score (0-100), a one-sentence headline a voice assistant could read aloud,
two or three strengths, two or three improvements, and tryNextTime: one concrete line the user
could actually say next time, written in their voice.
Be specific and fair. Do not inflate scores for a short or evasive rehearsal.`;
}

/** Keep only the skills this scenario trains, so progress stays comparable across sessions. */
export function keepScenarioSkills(card: Scorecard, competencies: Competency[]): Scorecard {
  return { ...card, competencyScores: card.competencyScores.filter(c => competencies.includes(c.competency)) };
}

export class GeminiRehearsalLLM implements RehearsalLLM {
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  choosePersona(): string {
    return pickPersona().id;
  }

  async counterpartTurn(setup: ConversationSetup, personaId: string, messages: InterviewMessage[]): Promise<string> {
    const persona = getPersona(personaId) ?? pickPersona();
    const contents = [
      { role: 'user' as const, parts: [{ text: buildPracticeKickoff(setup) }] },
      ...messages.map(m => ({
        role: m.role === 'user' ? ('user' as const) : ('model' as const),
        parts: [{ text: m.content }],
      })),
    ];
    return this.withFallback(MODEL_ROUTES.INTERACTIVE, async model => {
      const response = await this.ai.models.generateContent({
        model,
        contents,
        config: {
          ...generationConfig(MODEL_ROUTES.INTERACTIVE),
          systemInstruction: buildPracticeSystemInstruction(setup, persona),
        },
      });
      const text = response.text?.trim();
      if (!text) throw new Error(`empty counterpart turn from ${model}`);
      return text;
    });
  }

  async score(setup: ConversationSetup, competencies: Competency[], messages: InterviewMessage[]): Promise<Scorecard> {
    const prompt = buildEvaluatorPrompt(setup, formatTranscriptForEvaluator(messages));
    return this.withFallback(MODEL_ROUTES.EVALUATION, async model => {
      const response = await this.ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          ...generationConfig(MODEL_ROUTES.EVALUATION),
          systemInstruction: scorecardInstruction(competencies),
          responseMimeType: 'application/json',
          responseSchema: SCORECARD_SCHEMA,
        },
      });
      const raw = response.text;
      if (!raw) throw new Error(`empty scorecard from ${model}`);
      return keepScenarioSkills(JSON.parse(raw) as Scorecard, competencies);
    });
  }

  private async withFallback<T>(route: { chain: readonly string[] }, call: (model: string) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (const model of route.chain) {
      try {
        return await call(model);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}
