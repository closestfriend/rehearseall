import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { applyCors } from './_lib/cors';
import { sendError, sendAuthError, sendCommercialError } from './_lib/http';
import { requireUser } from './_lib/auth';
import { authorizeInterview, recordCostEvent, refundInterview } from './_lib/commercial';
import { validateSetup, validateMessages } from './_lib/validate';
import { getPersona, pickPersona, buildPracticeKickoff, buildPracticeSystemInstruction } from './_lib/prompts';
import { MODEL_ROUTES, generationConfig } from './_lib/modelRouting';
import type { ChatRequest, ChatResponse } from '../lib/gatewayTypes';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const body = (req.body ?? {}) as ChatRequest;
  const setup = validateSetup(body.setup);
  if (setup.ok === false) return sendError(res, 400, 'bad_request', `chat: ${setup.reason}`);
  const messages = validateMessages(body.messages);
  if (messages.ok === false) {
    if (messages.reason === 'turn_limit') return sendError(res, 429, 'turn_limit');
    return sendError(res, 400, 'bad_request', `chat: ${messages.reason}`);
  }
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
  const persona = typeof body.personaId === 'string'
    ? getPersona(body.personaId)
    : pickPersona(typeof body.lastPersonaId === 'string' ? body.lastPersonaId : undefined);
  if (!persona) return sendError(res, 400, 'bad_request', `chat: unknown personaId ${body.personaId}`);
  try {
    await authorizeInterview({
      userId: user.id,
      mode: 'text',
      sessionId,
      initial: !body.sessionId,
    });
  } catch (error) {
    sendCommercialError(res, error);
    return;
  }

  const contents = [
    { role: 'user' as const, parts: [{ text: buildPracticeKickoff(setup.value) }] },
    ...messages.value.map(m => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content }],
    })),
  ];

  const ai = new GoogleGenAI({ apiKey: key });
  let lastErr: unknown;
  for (const model of MODEL_ROUTES.INTERACTIVE.chain) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          ...generationConfig(MODEL_ROUTES.INTERACTIVE),
          systemInstruction: buildPracticeSystemInstruction(setup.value, persona),
        },
      });
      const reply = response.text;
      if (!reply) {
        lastErr = `empty reply from ${model}`;
        continue;
      }
      void recordCostEvent({
        userId: user.id, sessionId, operation: 'chat', mode: 'text', provider: 'google',
        model, succeeded: true,
      });
      const out: ChatResponse = {
        sessionId,
        personaId: persona.id,
        personaName: persona.name,
        reply,
      };
      res.status(200).json(out);
      return;
    } catch (err) {
      lastErr = err;
      void recordCostEvent({
        userId: user.id, sessionId, operation: 'chat', mode: 'text', provider: 'google',
        model, succeeded: false, errorCode: 'upstream_error',
      });
    }
  }
  void refundInterview({ userId: user.id, mode: 'text', sessionId })
    .catch(error => console.error('[commercial:refund_failed]', error));
  sendError(res, 502, 'upstream_error', lastErr);
}
