import type { ResumeData } from '../types';

/**
 * Assembles the user-prompt block sent to the evaluator model. Kept pure
 * (no SDK/network) so JD-in-scoring behavior is unit-testable. The JOB
 * DESCRIPTION line is included only when a non-empty JD is provided.
 */
export function buildEvaluatorPrompt(
  resume: ResumeData,
  chatTranscript: string
): string {
  const jd = resume.jobDescription?.trim();
  const jdLine = jd ? `\n      JOB DESCRIPTION: ${jd}` : '';
  return `
      RESUME: ${resume.text}
      TARGET ROLE: ${resume.role}
      EXPERIENCE: ${resume.experienceLevel}${jdLine}

      INTERVIEW TRANSCRIPT:
      ${chatTranscript}
    `;
}
