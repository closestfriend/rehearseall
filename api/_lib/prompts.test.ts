import { describe, it, expect } from 'vitest';
import {
  SERVER_PERSONAS, PREBUILT_VOICE_IDS, getPersona, pickPersona,
  buildInterviewerSystemInstruction, INTERVIEWER_CORE,
  SYSTEM_INSTRUCTION_FEEDBACK, MODELS,
} from './prompts';
import type { ResumeData } from '../../types';

const RESUME: ResumeData = { text: 'Ten years in ML research.', role: 'Research Scientist', experienceLevel: 'senior' };

describe('SERVER_PERSONAS', () => {
  it('has six personas with unique ids', () => {
    expect(SERVER_PERSONAS).toHaveLength(6);
    expect(new Set(SERVER_PERSONAS.map(p => p.id)).size).toBe(6);
  });

  it('maps every persona to a real prebuilt voice id', () => {
    const voices = new Set(PREBUILT_VOICE_IDS);
    for (const p of SERVER_PERSONAS) expect(voices.has(p.voiceId)).toBe(true);
  });

  it('gives every persona a non-empty name and fragment', () => {
    for (const p of SERVER_PERSONAS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.fragment.trim().length).toBeGreaterThan(0);
    }
  });

  it('getPersona resolves known ids and rejects unknown ones', () => {
    expect(getPersona('skeptic')?.name).toBe('The Skeptic');
    expect(getPersona('nope')).toBeUndefined();
  });
});

describe('pickPersona', () => {
  it('returns a persona from the roster', () => {
    const ids = new Set(SERVER_PERSONAS.map(p => p.id));
    expect(ids.has(pickPersona().id)).toBe(true);
  });

  it('never returns the excluded persona', () => {
    const exclude = SERVER_PERSONAS[0].id;
    for (let i = 0; i < 200; i++) expect(pickPersona(exclude).id).not.toBe(exclude);
  });
});

describe('buildInterviewerSystemInstruction', () => {
  const skeptic = getPersona('skeptic')!;
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

  it('omits the job-description block when none is provided', () => {
    expect(out).not.toContain('Job Description');
  });

  it('falls back to a no-resume instruction when the resume text is empty', () => {
    const noResume = buildInterviewerSystemInstruction({ ...RESUME, text: '   ' }, skeptic);
    expect(noResume).toContain('none provided');
    expect(noResume).toContain(RESUME.role);
    expect(noResume.toLowerCase()).toContain("don't reference or ask about a resume");
  });

  it('includes the job description block when one is provided', () => {
    const withJd = buildInterviewerSystemInstruction(
      { ...RESUME, jobDescription: '  Build React dashboards in TypeScript.  ' }, skeptic
    );
    expect(withJd).toContain('Job Description (tailor your questions to this):');
    expect(withJd).toContain('Build React dashboards in TypeScript.');
  });

  it('does not hardcode STAR in the core (only personas may use it)', () => {
    expect(out.split('PERSONA —')[0]).not.toContain('STAR');
    expect(INTERVIEWER_CORE).not.toContain('STAR');
  });
});

describe('SYSTEM_INSTRUCTION_FEEDBACK', () => {
  it('gates inline suggestions on a sub-70 score', () => {
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('below 70');
  });
  it('references replies by their printed USER REPLY index', () => {
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('replyIndex');
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('USER REPLY');
  });
  it('weights role-fit to the job description when one is provided', () => {
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('JOB DESCRIPTION');
    expect(SYSTEM_INSTRUCTION_FEEDBACK.toLowerCase()).toContain('requirements');
  });
});

describe('MODELS', () => {
  it('defines fallback chains with the current primaries', () => {
    expect(MODELS.TEXT_CHEF_CHAIN[0]).toBe('gemini-3.5-flash');
    expect(MODELS.EVALUATOR_CHAIN[0]).toBe('gemini-3.5-flash');
    expect(MODELS.TEXT_CHEF_CHAIN.length).toBeGreaterThan(1);
    expect(MODELS.VOICE_INTERVIEWER).toBe('gemini-3.1-flash-live-preview');
  });
});
