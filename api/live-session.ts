import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from './_lib/cors';
import { sendError } from './_lib/http';
import { validateSetup } from './_lib/validate';
import { pickPersona, buildPracticeSystemInstruction } from './_lib/prompts';
import type { ServerPersona } from './_lib/prompts';
import type { LiveSessionRequest, LiveSessionResponse } from '../lib/gatewayTypes';

const LIVE_MODEL = 'gpt-live-1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const key = process.env.OPENAI_API_KEY;
  if (!key) return sendError(res, 500, 'server_misconfigured', 'OPENAI_API_KEY unset');

  const body = (req.body ?? {}) as LiveSessionRequest;
  const setup = validateSetup(body.setup);
  if (setup.ok === false) return sendError(res, 400, 'bad_request', `live-session: ${setup.reason}`);
  if (typeof body.sdp !== 'string' || body.sdp.length < 20 || body.sdp.length > 200_000)
    return sendError(res, 400, 'bad_request', 'live-session: invalid SDP offer');

  const persona: ServerPersona = pickPersona(typeof body.lastPersonaId === 'string' ? body.lastPersonaId : undefined);
  try {
    const upstream = await fetch('https://api.openai.com/v1/live/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: {
          model: LIVE_MODEL,
          instructions: buildPracticeSystemInstruction(setup.value, persona),
          audio: {
            input: { transcription: { model: 'gpt-live-transcribe' } },
            output: { voice: 'marin' },
          },
          delegation: null,
        },
        transport: { type: 'webrtc', sdp: body.sdp },
      }),
    });
    if (!upstream.ok) {
      const detail = await upstream.text();
      return sendError(res, 502, 'upstream_error', `live-session upstream ${upstream.status}: ${detail.slice(0, 1000)}`);
    }
    const result = await upstream.json() as { session?: { id?: string }; transport?: { sdp?: string } };
    if (!result.session?.id || !result.transport?.sdp)
      return sendError(res, 502, 'upstream_error', 'live-session returned an incomplete WebRTC response');

    const out: LiveSessionResponse = {
      sessionId: result.session.id,
      personaId: persona.id,
      personaName: persona.name,
      sdp: result.transport.sdp,
    };
    res.status(201).json(out);
  } catch (err) {
    sendError(res, 502, 'upstream_error', err);
  }
}
