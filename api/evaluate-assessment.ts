import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import { applyCors } from './_lib/cors';
import { sendError } from './_lib/http';
import { validateSetup } from './_lib/validate';
import { MODEL_ROUTES, generationConfig } from './_lib/modelRouting';
import { validateAssessmentAnswers, validateAssessmentDeck } from './_lib/assessmentDeck';
import { ASSESSMENT_EVALUATOR_SYSTEM, buildAssessmentEvaluationPrompt } from './_lib/assessmentEvaluator';
import type { EvaluateAssessmentRequest } from '../lib/gatewayTypes';

const FEEDBACK_SCHEMA = {
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
          modelAnswer: { type: Type.STRING },
        },
        required: ['replyIndex', 'critique', 'modelAnswer'],
      },
    },
  },
  required: ['score', 'strengths', 'improvements', 'detailedAnalysis', 'suggestions'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const key = process.env.GEMINI_API_KEY;
  if (!key) return sendError(res, 500, 'server_misconfigured', 'GEMINI_API_KEY unset');

  const body = (req.body ?? {}) as EvaluateAssessmentRequest;
  const validatedSetup = validateSetup(body.setup);
  if (!validatedSetup.ok) return sendError(res, 400, 'bad_request');
  if (validatedSetup.value.kind !== 'rehearsal' || validatedSetup.value.format !== 'assessment')
    return sendError(res, 400, 'bad_request');
  const setup = validatedSetup.value;
  const deck = validateAssessmentDeck(body.deck, setup.targetQuestionCount);
  if (!deck.ok) return sendError(res, 400, 'bad_request');
  const answers = validateAssessmentAnswers(body.answers, deck.value);
  if (!answers.ok) return sendError(res, 400, 'bad_request');

  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = buildAssessmentEvaluationPrompt(setup, deck.value, answers.value);
  let lastError: unknown;
  for (const model of MODEL_ROUTES.EVALUATION.chain) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          ...generationConfig(MODEL_ROUTES.EVALUATION),
          systemInstruction: ASSESSMENT_EVALUATOR_SYSTEM,
          responseMimeType: 'application/json',
          responseSchema: FEEDBACK_SCHEMA,
          maxOutputTokens: 16384,
        },
      });
      if (!response.text) {
        lastError = `empty assessment evaluation from ${model}`;
        continue;
      }
      try {
        const feedback = JSON.parse(response.text);
        res.status(200).json({ ...feedback, suggestions: [] });
        return;
      } catch {
        lastError = `unparseable assessment evaluation from ${model}`;
      }
    } catch (error) {
      lastError = error;
    }
  }
  sendError(res, 502, 'upstream_error', lastError);
}
