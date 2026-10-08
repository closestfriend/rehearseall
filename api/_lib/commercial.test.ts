import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizeInterview, recordCostEvent, refundInterview } from './commercial';

describe('commercial server boundary', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('fails closed when persistence configuration is absent', async () => {
    await expect(authorizeInterview({ userId: 'u1', mode: 'text', sessionId: 's1', initial: true }))
      .rejects.toMatchObject({ code: 'server_misconfigured' });
  });

  it('returns the database decision for an initial interview charge', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    vi.stubEnv('FREE_MONTHLY_INTERVIEWS', '3');
    vi.stubEnv('PRO_MONTHLY_INTERVIEWS', '30');
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      allowed: true, plan: 'free', used: 1, remaining: 2,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    await expect(authorizeInterview({ userId: 'u1', mode: 'voice', sessionId: 's1', initial: true }))
      .resolves.toEqual({ allowed: true, plan: 'free', used: 1, remaining: 2 });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/rpc/authorize_interview',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('turns a quota denial into a stable error', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    vi.stubEnv('FREE_MONTHLY_INTERVIEWS', '3');
    vi.stubEnv('PRO_MONTHLY_INTERVIEWS', '30');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      allowed: false, plan: 'free', used: 3, remaining: 0,
    }), { status: 200 })));

    await expect(authorizeInterview({ userId: 'u1', mode: 'text', sessionId: 's1', initial: true }))
      .rejects.toMatchObject({ code: 'quota_exceeded' });
  });

  it('records cost metadata without including prompt content', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    const fetchSpy = vi.fn().mockResolvedValue(new Response('', { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);

    await recordCostEvent({
      userId: 'u1', sessionId: 's1', operation: 'chat', mode: 'text',
      provider: 'google', model: 'gemini-test', succeeded: false,
      inputTokens: 10, outputTokens: 5, errorCode: 'upstream_error',
    });
    const request = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(request.body).not.toContain('prompt');
    expect(request.body).toContain('upstream_error');
  });

  it('refunds a charged interview through the server-side RPC', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('true', { status: 200 })));

    await expect(refundInterview({ userId: 'u1', mode: 'text', sessionId: 's1' })).resolves.toBe(true);
  });
});
