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

import { pickPersona, LAST_PERSONA_STORAGE_KEY, INTERVIEWER_PERSONAS as PERSONAS } from './constants';

describe('pickPersona', () => {
  it('returns a persona from the roster', () => {
    const ids = new Set(PERSONAS.map(p => p.id));
    expect(ids.has(pickPersona().id)).toBe(true);
  });

  it('never returns the excluded persona', () => {
    const exclude = PERSONAS[0].id;
    for (let i = 0; i < 200; i++) {
      expect(pickPersona(exclude).id).not.toBe(exclude);
    }
  });

  it('exposes a stable localStorage key', () => {
    expect(LAST_PERSONA_STORAGE_KEY).toBe('hireprep_last_persona_v1');
  });
});
