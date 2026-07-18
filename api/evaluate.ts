import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import { applyCors } from './_lib/cors';
import { sendError } from './_lib/http';
import { validateSetup, validateMessages, LIMITS } from './_lib/validate';
import { MODELS, SYSTEM_INSTRUCTION_FEEDBACK } from './_lib/prompts';
import { buildEvaluatorPrompt } from './_lib/evaluatorPrompt';
import { formatTranscriptForEvaluator } from './_lib/transcriptFormat';
import type { EvaluateRequest } from '../lib/gatewayTypes';

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
  required: ['score', 'strengths', 'improvements', 'detailedAnalysis'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const key = process.env.GEMINI_API_KEY;
  if (!key) return sendError(res, 500, 'server_misconfigured', 'GEMINI_API_KEY unset');

  const body = (req.body ?? {}) as EvaluateRequest;
  const setup = validateSetup(body.setup);
  if (setup.ok === false) return sendError(res, 400, 'bad_request', `evaluate: ${setup.reason}`);
  // Evaluation is one bounded call (unlike /api/chat, which pays per-turn), and a
  // long voice interview can legitimately produce more than the 80-message chat
  // ceiling in transcript lines. Give it double headroom here so those sessions
  // stay evaluable, while /api/chat keeps the strict 40-turn ceiling.
  const transcript = validateMessages(body.transcript, LIMITS.maxTurns * 4);
  if (transcript.ok === false) {
    // 400, not chat's 429: an over-cap transcript is permanently unevaluable
    // (the cap is on the whole submission, not a rate), so retrying won't help.
    if (transcript.reason === 'turn_limit') return sendError(res, 400, 'turn_limit', 'evaluate: turn_limit');
    return sendError(res, 400, 'bad_request', `evaluate: ${transcript.reason}`);
  }
  if (transcript.value.length === 0) return sendError(res, 400, 'bad_request', 'evaluate: empty transcript');

  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = buildEvaluatorPrompt(setup.value, formatTranscriptForEvaluator(transcript.value));

  let lastErr: unknown;
  for (const model of MODELS.EVALUATOR_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_FEEDBACK,
          responseMimeType: 'application/json',
          maxOutputTokens: 16384,
          responseSchema: FEEDBACK_SCHEMA,
        },
      });
      const raw = response.text;
      if (!raw) {
        lastErr = `empty response from ${model} (finishReason=${(response as any)?.candidates?.[0]?.finishReason})`;
        continue;
      }
      try {
        res.status(200).json(JSON.parse(raw));
        return;
      } catch {
        lastErr = `unparseable JSON from ${model} (len=${raw.length}) preview=${raw.slice(0, 200)}`;
        continue;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  sendError(res, 502, 'upstream_error', lastErr);
}
