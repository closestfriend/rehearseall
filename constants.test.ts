import { describe, it, expect } from 'vitest';
import { INTERVIEWER_PERSONAS, LAST_PERSONA_STORAGE_KEY } from './constants';

describe('INTERVIEWER_PERSONAS (public roster)', () => {
  it('has six personas with unique ids and non-empty names', () => {
    expect(INTERVIEWER_PERSONAS).toHaveLength(6);
    expect(new Set(INTERVIEWER_PERSONAS.map(p => p.id)).size).toBe(6);
    for (const p of INTERVIEWER_PERSONAS) expect(p.name.length).toBeGreaterThan(0);
  });

  it('exposes a stable localStorage key', () => {
    expect(LAST_PERSONA_STORAGE_KEY).toBe('hireprep_last_persona_v1');
  });
});
