import type { VercelRequest } from '@vercel/node';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export class AuthError extends Error {
  readonly code = 'unauthorized';

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthError';
  }
}

function bearerToken(req: VercelRequest): string {
  const raw = req.headers.authorization;
  if (typeof raw !== 'string' || !/^Bearer\s+\S+$/i.test(raw)) throw new AuthError();
  return raw.replace(/^Bearer\s+/i, '');
}

export async function requireUser(req: VercelRequest): Promise<AuthenticatedUser> {
  const token = bearerToken(req);
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });
  } catch (error) {
    console.error('[auth:provider_unreachable]', error);
    throw new AuthError('Identity provider unavailable');
  }

  if (!response.ok) throw new AuthError();
  const body = await response.json() as { id?: unknown; email?: unknown };
  if (typeof body.id !== 'string' || !body.id) throw new AuthError();
  return {
    id: body.id,
    ...(typeof body.email === 'string' ? { email: body.email } : {}),
  };
}
