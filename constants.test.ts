import { describe, it, expect } from 'vitest';
import { INTERVIEWER_PERSONAS, INTERVIEWER_VOICES } from './constants';

describe('INTERVIEWER_PERSONAS', () => {
  it('has six personas with unique ids', () => {
    expect(INTERVIEWER_PERSONAS).toHaveLength(6);
    const ids = INTERVIEWER_PERSONAS.map(p => p.id);
    expect(new Set(ids).size).toBe(6);
  });

  it('maps every persona to a real voice id', () => {
    const voiceIds = new Set(INTERVIEWER_VOICES.map(v => v.id));
    for (const p of INTERVIEWER_PERSONAS) {
      expect(voiceIds.has(p.voiceId)).toBe(true);
    }
  });

  it('gives every persona a non-empty name and fragment', () => {
    for (const p of INTERVIEWER_PERSONAS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.fragment.trim().length).toBeGreaterThan(0);
    }
  });
});
