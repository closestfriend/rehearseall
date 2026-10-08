import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import { applyCors } from './_lib/cors';
import { sendError, sendAuthError } from './_lib/http';
import { requireUser } from './_lib/auth';
import { authorizeInterview, recordCostEvent } from './_lib/commercial';
import { validateSetup } from './_lib/validate';
import { MODEL_ROUTES, generationConfig } from './_lib/modelRouting';
import { buildAssessmentDeckPrompt, validateAssessmentDeck } from './_lib/assessmentDeck';
import type { AssessmentDeckRequest } from '../lib/gatewayTypes';

const QUESTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    type: { type: Type.STRING, enum: ['single-choice', 'multiple-choice', 'short-text', 'long-text'] },
    prompt: { type: Type.STRING },
    stimulus: { type: Type.STRING },
    options: { type: Type.ARRAY, items: { type: Type.STRING } },
    answerKey: { type: Type.ARRAY, items: { type: Type.STRING } },
    evaluationCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
    rationale: { type: Type.STRING },
  },
  required: ['id', 'type', 'prompt', 'options', 'answerKey', 'evaluationCriteria', 'rationale'],
};

const DECK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    instructions: { type: Type.STRING },
    questions: { type: Type.ARRAY, items: QUESTION_SCHEMA },
  },
  required: ['title', 'instructions', 'questions'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const body = (req.body ?? {}) as AssessmentDeckRequest;
  const validatedSetup = validateSetup(body.setup);
  if (validatedSetup.ok === false) return sendError(res, 400, 'bad_request', `assessment-deck: ${validatedSetup.reason}`);
  if (validatedSetup.value.kind !== 'rehearsal' || validatedSetup.value.format !== 'assessment') {
    return sendError(res, 400, 'bad_request');
  }
  const setup = validatedSetup.value;
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser(req);
  } catch (error) {
    sendAuthError(res, error);
    return;
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return sendError(res, 500, 'server_misconfigured', 'GEMINI_API_KEY unset');
  const sessionId = typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : crypto.randomUUID();
  try {
    await authorizeInterview({ userId: user.id, mode: 'assessment', sessionId, initial: !body.sessionId });
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === 'quota_exceeded') return sendError(res, 429, 'quota_exceeded');
    return sendError(res, 500, 'server_misconfigured', error);
  }
  const ai = new GoogleGenAI({ apiKey: key });
  let lastError: unknown;

  for (const model of MODEL_ROUTES.ASSESSMENT_DECK.chain) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: buildAssessmentDeckPrompt(setup),
        config: {
          ...generationConfig(MODEL_ROUTES.ASSESSMENT_DECK),
          responseMimeType: 'application/json',
          responseSchema: DECK_SCHEMA,
          maxOutputTokens: 32768,
        },
      });
      if (!response.text) {
        lastError = `empty deck from ${model}`;
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(response.text);
      } catch {
        lastError = `unparseable deck from ${model}`;
        continue;
      }
      const deck = validateAssessmentDeck(parsed, setup.targetQuestionCount);
      if (deck.ok === false) {
        lastError = `invalid deck from ${model}: ${deck.reason}`;
        continue;
      }
      void recordCostEvent({ userId: user.id, operation: 'assessment_deck', mode: 'assessment', provider: 'google', model, succeeded: true });
      res.status(200).json(deck.value);
      return;
    } catch (error) {
      lastError = error;
      void recordCostEvent({ userId: user.id, operation: 'assessment_deck', mode: 'assessment', provider: 'google', model, succeeded: false, errorCode: 'upstream_error' });
    }
  }
  sendError(res, 502, 'upstream_error', lastError);
}
