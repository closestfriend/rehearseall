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

import { buildInterviewerSystemInstruction, INTERVIEWER_CORE } from './constants';
import type { ResumeData } from './types';

const RESUME: ResumeData = { text: 'Ten years in ML research.', role: 'Research Scientist', experienceLevel: 'senior' };

describe('buildInterviewerSystemInstruction', () => {
  const skeptic = PERSONAS.find(p => p.id === 'skeptic')!;
  const out = buildInterviewerSystemInstruction(RESUME, skeptic);

  it('preserves the exact text-mode closing trigger substring', () => {
    expect(out.toLowerCase()).toContain('concludes our interview');
  });

  it('keeps the English-persistence rule', () => {
    expect(out).toContain('ENGLISH');
  });

  it('includes the persona fragment and name', () => {
    expect(out).toContain(skeptic.name);
    expect(out).toContain('evidence-driven');
  });

  it('injects the resume context', () => {
    expect(out).toContain(RESUME.text);
    expect(out).toContain(RESUME.role);
    expect(out).toContain(RESUME.experienceLevel);
  });

  it('does not hardcode STAR in the core (only personas may use it)', () => {
    const core = out.split('PERSONA —')[0];
    expect(core).not.toContain('STAR');
    // Guard the frozen constant directly too, so STAR can't creep back into
    // the core regardless of which persona the builder is exercised with.
    expect(INTERVIEWER_CORE).not.toContain('STAR');
  });
});

import { SYSTEM_INSTRUCTION_FEEDBACK } from './constants';

describe('SYSTEM_INSTRUCTION_FEEDBACK', () => {
  it('gates inline suggestions on a sub-70 score', () => {
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('below 70');
  });

  it('references replies by their printed USER REPLY index', () => {
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('replyIndex');
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('USER REPLY');
  });
});
