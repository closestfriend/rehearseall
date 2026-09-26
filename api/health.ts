import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from './_lib/cors';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  // hasKey verifies env wiring without ever echoing the key.
  res.status(200).json({
    ok: true,
    hasKey: Boolean(process.env.GEMINI_API_KEY),
    hasLiveKey: Boolean(process.env.OPENAI_API_KEY),
  });
}
