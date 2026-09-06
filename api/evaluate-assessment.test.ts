import { afterEach, describe, expect, it } from 'vitest';
import handler from './evaluate-assessment';

function responseDouble() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { this.headers[name] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
    end() { return this; },
  };
}

describe('assessment evaluation endpoint boundary', () => {
  const priorKey = process.env.GEMINI_API_KEY;
  afterEach(() => {
    if (priorKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = priorKey;
  });

  it('rejects unsupported methods', async () => {
    const res = responseDouble();
    await handler({ method: 'GET', headers: {} } as any, res as any);
    expect(res.statusCode).toBe(405);
  });

  it('rejects a non-assessment setup before contacting the model', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const res = responseDouble();
    await handler({ method: 'POST', headers: {}, body: {
      setup: { text: '', role: 'Engineer', experienceLevel: 'mid' },
      deck: {}, answers: [],
    } } as any, res as any);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { code: 'bad_request', message: 'The request was malformed.' } });
  });
});
