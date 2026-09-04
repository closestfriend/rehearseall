import { describe, it, expect } from 'vitest';
import { buildEvaluatorPrompt } from './evaluatorPrompt';
import type { ConversationSetup, ResumeData } from '../../types';

const RESUME: ResumeData = {
  text: 'Ten years in ML research.',
  role: 'Research Scientist',
  experienceLevel: 'senior',
};
const TRANSCRIPT = 'INTERVIEWER: Hi.\nUSER REPLY #1: Hello.';
const CONVERSATION: ConversationSetup = {
  kind: 'conversation',
  title: 'AI use and teenagers',
  counterpart: "A physician at Nationwide Children's Hospital",
  goal: 'Explain my research clearly and learn where medical context changes the problem.',
  context: 'I research AI harms but feel out of depth in the medical world.',
  concern: 'Missing the opportunity by sounding underprepared.',
};

describe('buildEvaluatorPrompt', () => {
  it('includes resume, role, experience, and the transcript', () => {
    const out = buildEvaluatorPrompt(RESUME, TRANSCRIPT);
    expect(out).toContain(RESUME.text);
    expect(out).toContain(RESUME.role);
    expect(out).toContain(RESUME.experienceLevel);
    expect(out).toContain(TRANSCRIPT);
  });

  it('omits the JOB DESCRIPTION line when none is provided', () => {
    const out = buildEvaluatorPrompt(RESUME, TRANSCRIPT);
    expect(out).not.toContain('JOB DESCRIPTION');
  });

  it('includes a trimmed JOB DESCRIPTION line when one is provided', () => {
    const out = buildEvaluatorPrompt(
      { ...RESUME, jobDescription: '  Own the data pipeline.  ' },
      TRANSCRIPT
    );
    expect(out).toContain('JOB DESCRIPTION: Own the data pipeline.');
  });

  it('substitutes a no-resume note when the resume text is empty', () => {
    const out = buildEvaluatorPrompt({ ...RESUME, text: '  ' }, TRANSCRIPT);
    expect(out).toContain('none provided');
    expect(out).toContain('do not penalize');
    expect(out).toContain(TRANSCRIPT);
  });

  it('builds an open-rehearsal brief from the conversation setup', () => {
    const out = buildEvaluatorPrompt(CONVERSATION, TRANSCRIPT);
    expect(out).toContain(`REHEARSAL: ${CONVERSATION.title}`);
    expect(out).toContain(`COUNTERPART: ${CONVERSATION.counterpart}`);
    expect(out).toContain(`DESIRED OUTCOME: ${CONVERSATION.goal}`);
    expect(out).toContain(CONVERSATION.context);
    expect(out).toContain(CONVERSATION.concern);
    expect(out).toContain(TRANSCRIPT);
    expect(out).not.toContain('RESUME:');
  });
});
