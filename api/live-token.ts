import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Modality } from '@google/genai';
import { applyCors } from './_lib/cors';
import { sendError } from './_lib/http';
import { validateSetup } from './_lib/validate';
import { MODELS, getPersona, pickPersona, buildPracticeSystemInstruction } from './_lib/prompts';
import type { ServerPersona } from './_lib/prompts';
import type { LiveTokenRequest, LiveTokenResponse } from '../lib/gatewayTypes';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const key = process.env.GEMINI_API_KEY;
  if (!key) return sendError(res, 500, 'server_misconfigured', 'GEMINI_API_KEY unset');

  const body = (req.body ?? {}) as LiveTokenRequest;
  const setup = validateSetup(body.setup);
  if (setup.ok === false) return sendError(res, 400, 'bad_request', `live-token: ${setup.reason}`);

  let persona: ServerPersona | undefined;
  if (body.reconnect) {
    if (typeof body.sessionId !== 'string' || typeof body.personaId !== 'string')
      return sendError(res, 400, 'bad_request', 'live-token: reconnect requires sessionId + personaId');
    persona = getPersona(body.personaId);
  } else {
    persona = pickPersona(typeof body.lastPersonaId === 'string' ? body.lastPersonaId : undefined);
  }
  if (!persona) return sendError(res, 400, 'bad_request', `live-token: unknown personaId ${body.personaId}`);

  // Phase 3 attaches quota here: initial mints charge one interview; reconnect
  // mints within the 30-minute session window don't (spec §3).

  // Ephemeral tokens require the v1alpha API surface.
  const ai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: 'v1alpha' } });
  const now = Date.now();
  try {
    const token = await ai.authTokens.create({
      config: {
        uses: 1, // single-use: each reconnect mints fresh (spec §3)
        expireTime: new Date(now + 30 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 2 * 60_000).toISOString(),
        // Config-locked (lockAdditionalFields: [] locks exactly these fields):
        // the system instruction, voice, and transcription settings never
        // reach the client. sessionResumption stays unlocked — the client
        // passes the varying resumption handle per connect.
        liveConnectConstraints: {
          model: MODELS.VOICE_INTERVIEWER,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.voiceId } },
            },
            systemInstruction: buildPracticeSystemInstruction(setup.value, persona),
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        },
        lockAdditionalFields: [],
      },
    });
    if (!token.name) return sendError(res, 502, 'upstream_error', 'live-token: token minted without name');

    const out: LiveTokenResponse = {
      token: token.name,
      model: MODELS.VOICE_INTERVIEWER,
      sessionId: body.reconnect && body.sessionId ? body.sessionId : crypto.randomUUID(),
      personaId: persona.id,
      personaName: persona.name,
    };
    res.status(200).json(out);
  } catch (err) {
    sendError(res, 502, 'upstream_error', err);
  }
}
