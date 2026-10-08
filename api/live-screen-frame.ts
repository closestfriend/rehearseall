import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from './_lib/cors';
import { sendError, sendAuthError } from './_lib/http';
import { requireUser } from './_lib/auth';
import { recordCostEvent } from './_lib/commercial';
import type { LiveScreenFrameRequest, LiveScreenFrameResponse } from '../lib/gatewayTypes';

const VISION_MODEL = 'gpt-5.6-luna';
const MAX_IMAGE_LENGTH = 2_500_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const body = (req.body ?? {}) as LiveScreenFrameRequest;
  if (typeof body.image !== 'string' || body.image.length > MAX_IMAGE_LENGTH
    || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(body.image))
    return sendError(res, 400, 'bad_request', 'live-screen-frame: invalid JPEG image');
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser(req);
  } catch (error) {
    sendAuthError(res, error);
    return;
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return sendError(res, 500, 'server_misconfigured', 'OPENAI_API_KEY unset');

  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        reasoning: { effort: 'none' },
        max_output_tokens: 120,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: 'Briefly describe only the visible, task-relevant screen content. Read small text only when legible. Do not infer private facts or claim actions were taken.' },
            { type: 'input_image', image_url: body.image, detail: 'low' },
          ],
        }],
      }),
    });
    if (!upstream.ok) {
      const detail = await upstream.text();
      return sendError(res, 502, 'upstream_error', `screen vision upstream ${upstream.status}: ${detail.slice(0, 1000)}`);
    }
    const result = await upstream.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const description = result.output?.flatMap(item => item.content ?? [])
      .filter(item => item.type === 'output_text').map(item => item.text ?? '').join('\n').trim();
    if (!description) return sendError(res, 502, 'upstream_error', 'screen vision returned no description');
    const out: LiveScreenFrameResponse = { description };
    void recordCostEvent({ userId: user.id, operation: 'live_screen_frame', provider: 'openai', model: VISION_MODEL, succeeded: true });
    res.status(200).json(out);
  } catch (err) {
    void recordCostEvent({ userId: user.id, operation: 'live_screen_frame', provider: 'openai', model: VISION_MODEL, succeeded: false, errorCode: 'upstream_error' });
    sendError(res, 502, 'upstream_error', err);
  }
}
