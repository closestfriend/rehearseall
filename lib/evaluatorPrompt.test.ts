import { describe, it, expect } from 'vitest';
import { buildEvaluatorPrompt } from './evaluatorPrompt';
import type { ResumeData } from '../types';

const RESUME: ResumeData = {
  text: 'Ten years in ML research.',
  role: 'Research Scientist',
  experienceLevel: 'senior',
};
const TRANSCRIPT = 'INTERVIEWER: Hi.\nUSER REPLY #1: Hello.';

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
});
