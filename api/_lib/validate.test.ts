import { describe, it, expect } from 'vitest';
import { validateSetup, validateMessages, LIMITS } from './validate';

const SETUP = { text: 'resume text', role: 'Engineer', experienceLevel: 'mid' };

describe('validateSetup', () => {
  it('accepts a minimal valid setup', () => {
    const r = validateSetup(SETUP);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.role).toBe('Engineer');
  });

  it('accepts an empty resume text (no-resume flow) and optional JD', () => {
    expect(validateSetup({ ...SETUP, text: '' }).ok).toBe(true);
    expect(validateSetup({ ...SETUP, jobDescription: 'Own the pipeline.' }).ok).toBe(true);
  });

  it('rejects a missing or blank role', () => {
    expect(validateSetup({ ...SETUP, role: '  ' }).ok).toBe(false);
    expect(validateSetup({ ...SETUP, role: undefined }).ok).toBe(false);
  });

  it('rejects non-object bodies and oversized fields', () => {
    expect(validateSetup(null).ok).toBe(false);
    expect(validateSetup({ ...SETUP, text: 'x'.repeat(LIMITS.resumeChars + 1) }).ok).toBe(false);
    expect(validateSetup({ ...SETUP, jobDescription: 'x'.repeat(LIMITS.jdChars + 1) }).ok).toBe(false);
  });

  it('drops unknown extra fields instead of passing them through', () => {
    const r = validateSetup({ ...SETUP, sneaky: 'payload' });
    expect(r.ok).toBe(true);
    if (r.ok) expect('sneaky' in r.value).toBe(false);
  });
});

describe('validateMessages', () => {
  const msg = (role: 'user' | 'assistant', content = 'hi') => ({ role, content, timestamp: 1 });

  it('accepts an alternating history and an empty first-turn history', () => {
    expect(validateMessages([]).ok).toBe(true);
    expect(validateMessages([msg('assistant'), msg('user')]).ok).toBe(true);
  });

  it('rejects bad roles, non-string content, and oversized content', () => {
    expect(validateMessages([{ role: 'system', content: 'x', timestamp: 1 }]).ok).toBe(false);
    expect(validateMessages([{ role: 'user', content: 5, timestamp: 1 }]).ok).toBe(false);
    expect(validateMessages([msg('user', 'x'.repeat(LIMITS.messageChars + 1))]).ok).toBe(false);
  });

  it('flags histories past the turn ceiling with reason turn_limit', () => {
    const tooLong = Array.from({ length: LIMITS.maxTurns * 2 + 1 }, (_, i) =>
      msg(i % 2 ? 'user' : 'assistant'));
    const r = validateMessages(tooLong);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toBe('turn_limit');
  });
});
