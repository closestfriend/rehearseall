import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from './live-session';

function responseDouble() {
  return {
    statusCode: 0,
    body: undefined as any,
    setHeader() {},
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
    end() { return this; },
  };
}

const request = {
  method: 'POST', headers: { authorization: 'Bearer test-user-token' }, body: {
    setup: { text: 'Independent researcher', role: 'Researcher', experienceLevel: 'mid' },
    sdp: 'v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\n',
  },
};

describe('GPT-Live session endpoint', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects an unauthenticated valid offer before calling OpenAI', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-server-key');
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const res = responseDouble();
    await handler({ ...request, headers: {} } as any, res as any);
    expect(res.statusCode).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('creates a WebRTC session without the unsupported Realtime audio.input field', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-server-key');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubEnv('FREE_MONTHLY_INTERVIEWS', '3');
    vi.stubEnv('PRO_MONTHLY_INTERVIEWS', '30');
    const upstream = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      // Reproduce the actual production rejection from GPT-Live, which has
      // native transcript events rather than Realtime's audio.input config.
      if (body.session.audio?.input !== undefined) {
        return new Response(JSON.stringify({ error: {
          message: "Unknown parameter: 'session.audio.input'.", code: 'unknown_parameter',
        } }), { status: 400 });
      }
      if (body.session.delegation === null) {
        return new Response(JSON.stringify({ error: {
          message: "Invalid type for 'session.delegation': expected an unknown value, but got null instead.", code: 'invalid_type',
        } }), { status: 400 });
      }
      expect(body.session.model).toBe('gpt-live-1');
      expect(body.session.instructions).toContain('Researcher');
      expect(body.transport).toEqual({ type: 'webrtc', sdp: request.body.sdp });
      expect(init.headers).toMatchObject({ Authorization: 'Bearer test-server-key' });
      return new Response(JSON.stringify({
        session: { id: 'live_test' }, transport: { sdp: 'answer-sdp' },
      }), { status: 201 });
    });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-123' }), { status: 200 });
      if (url.includes('/rpc/authorize_interview')) return new Response(JSON.stringify({ allowed: true, plan: 'free', used: 1, remaining: 2 }), { status: 200 });
      if (url.includes('/cost_events')) return new Response('', { status: 201 });
      return upstream(url, init ?? {});
    }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = responseDouble();
    await handler(request as any, res as any);
    expect(upstream).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ sessionId: 'live_test', sdp: 'answer-sdp' });
    expect(JSON.stringify(res.body)).not.toContain('test-server-key');
  });

  it('rejects an invalid offer without calling OpenAI', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-server-key');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubEnv('FREE_MONTHLY_INTERVIEWS', '3');
    vi.stubEnv('PRO_MONTHLY_INTERVIEWS', '30');
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = responseDouble();
    await handler({ ...request, body: { ...request.body, sdp: '' } } as any, res as any);
    expect(res.statusCode).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('logs upstream failures while returning a safe error to the browser', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-server-key');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubEnv('FREE_MONTHLY_INTERVIEWS', '3');
    vi.stubEnv('PRO_MONTHLY_INTERVIEWS', '30');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-123' }), { status: 200 });
      if (url.includes('/rpc/authorize_interview')) return new Response(JSON.stringify({ allowed: true, plan: 'free', used: 1, remaining: 2 }), { status: 200 });
      if (url.includes('/cost_events')) return new Response('', { status: 201 });
      return new Response(JSON.stringify({ error: { code: 'insufficient_quota' } }), { status: 429 });
    }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = responseDouble();
    await handler(request as any, res as any);
    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe('upstream_error');
    expect(log).toHaveBeenCalledWith('[gateway:upstream_error]', expect.stringContaining('429'));
  });
});
