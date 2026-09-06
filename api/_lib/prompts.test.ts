import { describe, it, expect } from 'vitest';
import {
  SERVER_PERSONAS, PREBUILT_VOICE_IDS, getPersona, pickPersona,
  buildInterviewerSystemInstruction, INTERVIEWER_CORE,
  buildPracticeSystemInstruction, getFeedbackSystemInstruction,
  SYSTEM_INSTRUCTION_FEEDBACK,
} from './prompts';
import type { ConversationSetup, RehearsalSetup, ResumeData } from '../../types';

const RESUME: ResumeData = { text: 'Ten years in ML research.', role: 'Research Scientist', experienceLevel: 'senior' };
const CONVERSATION: ConversationSetup = {
  kind: 'conversation',
  title: 'AI use and teenagers',
  counterpart: "A physician at Nationwide Children's Hospital",
  goal: 'Explain my research clearly and learn where medical context changes the problem.',
  context: 'I research AI harms but feel out of depth in the medical world.',
  concern: 'Missing the opportunity by sounding underprepared.',
};
const REHEARSAL: RehearsalSetup = {
  kind: 'rehearsal',
  presetId: 'ai-fluency-interview',
  title: 'AI Fluency Interview',
  format: 'interview',
  domain: 'AI and evaluation',
  description: 'Explain practical AI use.',
  instructions: 'Probe real workflows and verification.',
  competencies: ['AI workflows', 'verification discipline'],
  guidance: ['ask for a concrete failure', 'ask when AI should not be used'],
  evaluationCriteria: ['practical specificity', 'calibrated claims'],
  targetQuestionCount: 6,
  supportsScreenShare: false,
  participantContext: 'I study AI harms and evaluate model behavior.',
};

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

describe('open rehearsal prompts', () => {
  const skeptic = getPersona('skeptic')!;

  it('frames a conversation counterpart around the user-defined context and goal', () => {
    const out = buildPracticeSystemInstruction(CONVERSATION, skeptic);
    expect(out).toContain(CONVERSATION.counterpart);
    expect(out).toContain(CONVERSATION.goal);
    expect(out).toContain(CONVERSATION.context);
    expect(out).toContain(CONVERSATION.concern);
    expect(out).toContain('rehearsal');
    expect(out).not.toContain('conducting a job interview');
  });

  it('selects a conversation debrief rubric without interview scoring language', () => {
    const out = getFeedbackSystemInstruction(CONVERSATION);
    expect(out).toContain('goal advancement');
    expect(out).toContain('interdisciplinary');
    expect(out).not.toContain('hiring manager');
  });
});

describe('custom rehearsal prompts', () => {
  const examiner = getPersona('examiner')!;

  it('builds an adaptive preset interview from the complete setup', () => {
    const out = buildPracticeSystemInstruction(REHEARSAL, examiner);
    expect(out).toContain(REHEARSAL.title);
    expect(out).toContain(REHEARSAL.competencies[0]);
    expect(out).toContain(REHEARSAL.guidance[0]);
    expect(out).toContain(REHEARSAL.participantContext);
    expect(out).toContain('6 substantive questions');
    expect(out).toContain('one question at a time');
    expect(out).toContain('independent practice approximation');
    expect(out.toLowerCase()).toContain('concludes our interview');
  });

  it('selects the preset evaluation criteria for the debrief', () => {
    const out = getFeedbackSystemInstruction(REHEARSAL);
    expect(out).toContain(REHEARSAL.evaluationCriteria[0]);
    expect(out).toContain(REHEARSAL.evaluationCriteria[1]);
    expect(out).not.toContain('medical expertise');
  });

  it('tells screen-enabled evaluators how to use shared visual evidence', () => {
    const out = buildPracticeSystemInstruction({ ...REHEARSAL, supportsScreenShare: true }, examiner);
    expect(out).toContain('visual evidence');
    expect(out).toContain('screen');
  });
});

// Drift guard: the roster inside prompts.ts is a BY-VALUE mirror of the
// client's public list (a runtime import would crash the CJS-scoped function
// under Vercel's per-file transpile — see the comment in prompts.ts).
import { INTERVIEWER_PERSONAS } from '../../constants';

describe('roster parity with constants.ts', () => {
  it('matches the client roster id-for-id and name-for-name', () => {
    expect(SERVER_PERSONAS.map(({ id, name }) => ({ id, name }))).toEqual(
      INTERVIEWER_PERSONAS.map(({ id, name }) => ({ id, name }))
    );
  });
});
