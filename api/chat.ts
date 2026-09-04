import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { applyCors } from './_lib/cors';
import { sendError } from './_lib/http';
import { validateSetup, validateMessages } from './_lib/validate';
import { MODELS, getPersona, pickPersona, buildPracticeSystemInstruction } from './_lib/prompts';
import type { ChatRequest, ChatResponse } from '../lib/gatewayTypes';

// The hidden opening user turn — moved from InterviewChat.tsx's initChat.
const KICKOFF = 'Hello. Please introduce yourself and start the interview.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const key = process.env.GEMINI_API_KEY;
  if (!key) return sendError(res, 500, 'server_misconfigured', 'GEMINI_API_KEY unset');

  const body = (req.body ?? {}) as ChatRequest;
  const setup = validateSetup(body.setup);
  if (setup.ok === false) return sendError(res, 400, 'bad_request', `chat: ${setup.reason}`);
  const messages = validateMessages(body.messages);
  if (messages.ok === false) {
    if (messages.reason === 'turn_limit') return sendError(res, 429, 'turn_limit');
    return sendError(res, 400, 'bad_request', `chat: ${messages.reason}`);
  }

  const persona = typeof body.personaId === 'string'
    ? getPersona(body.personaId)
    : pickPersona(typeof body.lastPersonaId === 'string' ? body.lastPersonaId : undefined);
  if (!persona) return sendError(res, 400, 'bad_request', `chat: unknown personaId ${body.personaId}`);

  const contents = [
    { role: 'user' as const, parts: [{ text: KICKOFF }] },
    ...messages.value.map(m => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content }],
    })),
  ];

  const ai = new GoogleGenAI({ apiKey: key });
  let lastErr: unknown;
  for (const model of MODELS.TEXT_CHEF_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: { systemInstruction: buildPracticeSystemInstruction(setup.value, persona) },
      });
      const reply = response.text;
      if (!reply) {
        lastErr = `empty reply from ${model}`;
        continue;
      }
      const out: ChatResponse = {
        sessionId: typeof body.sessionId === 'string' && body.sessionId
          ? body.sessionId
          : crypto.randomUUID(),
        personaId: persona.id,
        personaName: persona.name,
        reply,
      };
      res.status(200).json(out);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  sendError(res, 502, 'upstream_error', lastErr);
}
