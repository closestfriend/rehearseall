import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseConfig } from './authConfig';

describe('getSupabaseConfig', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns null when browser auth is not configured', () => {
    expect(getSupabaseConfig()).toBeNull();
  });

  it('returns the public browser configuration when configured', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    expect(getSupabaseConfig()).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });
  });
});
