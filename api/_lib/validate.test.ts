import { describe, it, expect } from 'vitest';
import { validateSetup, validateMessages, LIMITS } from './validate';

const SETUP = { text: 'resume text', role: 'Engineer', experienceLevel: 'mid' };
const CONVERSATION_SETUP = {
  kind: 'conversation',
  title: 'AI use and teenagers',
  counterpart: "A physician at Nationwide Children's Hospital",
  goal: 'Explain my research clearly and learn where medical context changes the problem.',
  context: 'I research AI harms and want a productive interdisciplinary exchange.',
  concern: 'I may use language that sounds naive in a clinical setting.',
};
const REHEARSAL_SETUP = {
  kind: 'rehearsal',
  presetId: 'ai-fluency-interview',
  title: 'AI Fluency Interview',
  format: 'interview',
  domain: 'AI and evaluation',
  description: 'Explain practical AI use.',
  instructions: 'Probe real workflows and verification.',
  competencies: ['AI workflows', 'verification'],
  guidance: ['ask for a concrete failure'],
  evaluationCriteria: ['specificity', 'calibration'],
  targetQuestionCount: 6,
  supportsScreenShare: false,
  participantContext: 'I evaluate AI systems.',
};

describe('validateSetup', () => {
  it('accepts a minimal valid setup', () => {
    const r = validateSetup(SETUP);
    expect(r.ok).toBe(true);
    if (r.ok) expect('role' in r.value && r.value.role).toBe('Engineer');
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

  it('accepts and normalizes an open conversation rehearsal', () => {
    const r = validateSetup(CONVERSATION_SETUP);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual(CONVERSATION_SETUP);
    }
  });

  it('requires a title, counterpart, and goal for an open rehearsal', () => {
    expect(validateSetup({ ...CONVERSATION_SETUP, title: '   ' }).ok).toBe(false);
    expect(validateSetup({ ...CONVERSATION_SETUP, counterpart: '' }).ok).toBe(false);
    expect(validateSetup({ ...CONVERSATION_SETUP, goal: undefined }).ok).toBe(false);
  });

  it('accepts and rebuilds a bounded custom rehearsal setup', () => {
    const r = validateSetup({ ...REHEARSAL_SETUP, unknown: 'drop me' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual(REHEARSAL_SETUP);
      expect('unknown' in r.value).toBe(false);
    }
  });

  it('rejects malformed custom rehearsal setup fields', () => {
    expect(validateSetup({ ...REHEARSAL_SETUP, format: 'quiz' }).ok).toBe(false);
    expect(validateSetup({ ...REHEARSAL_SETUP, competencies: ['x'.repeat(LIMITS.rehearsalItemChars + 1)] }).ok).toBe(false);
    expect(validateSetup({ ...REHEARSAL_SETUP, guidance: Array.from({ length: LIMITS.rehearsalArrayItems + 1 }, () => 'x') }).ok).toBe(false);
    expect(validateSetup({ ...REHEARSAL_SETUP, targetQuestionCount: 0 }).ok).toBe(false);
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

  it('accepts a raised cap for evaluation of long voice transcripts', () => {
    const msgs81 = Array.from({ length: LIMITS.maxTurns * 2 + 1 }, (_, i) =>
      msg(i % 2 ? 'user' : 'assistant'));
    const r = validateMessages(msgs81, LIMITS.maxTurns * 4);
    expect(r.ok).toBe(true);
  });

  it('still flags histories past a raised cap with reason turn_limit', () => {
    const msgs161 = Array.from({ length: LIMITS.maxTurns * 4 + 1 }, (_, i) =>
      msg(i % 2 ? 'user' : 'assistant'));
    const r = validateMessages(msgs161, LIMITS.maxTurns * 4);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toBe('turn_limit');
  });
});
