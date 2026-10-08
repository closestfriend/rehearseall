import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireUser } from './auth';

function request(authorization?: string) {
  return { headers: authorization ? { authorization } : {} } as any;
}

describe('requireUser', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects requests without a bearer token', async () => {
    await expect(requireUser(request())).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('rejects when the identity provider does not validate the token', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));

    await expect(requireUser(request('Bearer expired'))).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('returns only the verified provider identity', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: 'user-123', email: 'hunter@example.com' }),
      { status: 200 },
    )));

    await expect(requireUser(request('Bearer valid'))).resolves.toEqual({
      id: 'user-123',
      email: 'hunter@example.com',
    });
  });
});
