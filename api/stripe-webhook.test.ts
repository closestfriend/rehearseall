import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from './stripe-webhook';

function responseDouble() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
  };
}

describe('Stripe webhook endpoint', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects requests without webhook configuration', async () => {
    const res = responseDouble();
    await handler({ method: 'POST', headers: {}, body: '{}' } as any, res as any);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'server_misconfigured' });
  });

  it('rejects an invalid Stripe signature', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_key');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = responseDouble();
    await handler({ method: 'POST', headers: { 'stripe-signature': 'invalid' }, body: '{}' } as any, res as any);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_webhook' });
  });
});
