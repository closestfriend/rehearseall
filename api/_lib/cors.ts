import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_ALLOWED = [
  'http://localhost:3000',
  'https://hireprep-ai-nine.vercel.app',
];

export function allowedOrigins(): string[] {
  const env = process.env.ALLOWED_ORIGINS;
  if (!env) return DEFAULT_ALLOWED;
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

export function resolveCorsOrigin(
  origin: string | undefined,
  host: string | undefined,
  allowlist: string[]
): 'no-origin' | 'same-origin' | 'allowed' | 'forbidden' {
  if (!origin) return 'no-origin';
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return 'forbidden';
  }
  // Same-origin lets every preview deployment call its own /api without the
  // allowlist having to enumerate ephemeral preview URLs.
  if (host && originHost === host) return 'same-origin';
  if (allowlist.includes(origin)) return 'allowed';
  return 'forbidden';
}

// Returns true when the request was fully handled (preflight or rejection)
// and the endpoint handler must return immediately.
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;
  const verdict = resolveCorsOrigin(origin, req.headers.host, allowedOrigins());

  if (verdict === 'forbidden') {
    res.status(403).json({
      error: { code: 'origin_forbidden', message: 'This origin is not allowed to call the API.' },
    });
    return true;
  }
  if (verdict === 'allowed' || verdict === 'same-origin') {
    res.setHeader('Access-Control-Allow-Origin', origin!);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return true;
  }
  return false;
}
