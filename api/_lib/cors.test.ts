import { describe, it, expect, afterEach } from 'vitest';
import { resolveCorsOrigin, allowedOrigins } from './cors';

const ALLOW = ['http://localhost:3000', 'https://hireprep-ai-nine.vercel.app'];

describe('resolveCorsOrigin', () => {
  it('passes requests with no Origin header (curl, server-to-server)', () => {
    expect(resolveCorsOrigin(undefined, 'x.vercel.app', ALLOW)).toBe('no-origin');
  });

  it('allows same-origin requests regardless of allowlist (preview deployments)', () => {
    expect(
      resolveCorsOrigin('https://hireprep-abc123.vercel.app', 'hireprep-abc123.vercel.app', ALLOW)
    ).toBe('same-origin');
  });

  it('allows allowlisted cross-origin callers', () => {
    expect(resolveCorsOrigin('http://localhost:3000', 'x.vercel.app', ALLOW)).toBe('allowed');
  });

  it('forbids unknown origins', () => {
    expect(resolveCorsOrigin('https://evil.example', 'x.vercel.app', ALLOW)).toBe('forbidden');
  });

  it('forbids malformed origins', () => {
    expect(resolveCorsOrigin('not a url', 'x.vercel.app', ALLOW)).toBe('forbidden');
  });
});

describe('allowedOrigins', () => {
  afterEach(() => { delete process.env.ALLOWED_ORIGINS; });

  it('parses the ALLOWED_ORIGINS env var as a comma-separated list', () => {
    process.env.ALLOWED_ORIGINS = 'https://a.example, https://b.example';
    expect(allowedOrigins()).toEqual(['https://a.example', 'https://b.example']);
  });

  it('falls back to the built-in defaults when unset', () => {
    expect(allowedOrigins()).toContain('http://localhost:3000');
    expect(allowedOrigins()).toContain('https://hireprep-ai-nine.vercel.app');
  });
});
