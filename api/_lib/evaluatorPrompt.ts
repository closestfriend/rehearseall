import type { PracticeSetup } from '../../types';

/**
 * Assembles the user-prompt block sent to the evaluator model. Kept pure
 * (no SDK/network) so JD-in-scoring behavior is unit-testable. The JOB
 * DESCRIPTION line is included only when a non-empty JD is provided.
 */
export function buildEvaluatorPrompt(
  resume: PracticeSetup,
  chatTranscript: string
): string {
  if (resume.kind === 'conversation') {
    const concern = resume.concern?.trim()
      ? `\n      PRESSURE POINT: ${resume.concern.trim()}`
      : '';
    return `
      REHEARSAL: ${resume.title}
      COUNTERPART: ${resume.counterpart}
      DESIRED OUTCOME: ${resume.goal}
      CONTEXT: ${resume.context.trim() || 'none provided'}${concern}

      REHEARSAL TRANSCRIPT:
      ${chatTranscript}
    `;
  }
  if (resume.kind === 'rehearsal') {
    return `
      REHEARSAL: ${resume.title}
      DOMAIN: ${resume.domain}
      FORMAT: ${resume.format}
      PARTICIPANT CONTEXT: ${resume.participantContext.trim() || 'none provided'}
      COMPETENCIES: ${resume.competencies.join('; ')}
      EVALUATION CRITERIA: ${resume.evaluationCriteria.join('; ')}

      REHEARSAL TRANSCRIPT:
      ${chatTranscript}
    `;
  }
  const jd = resume.jobDescription?.trim();
  const jdLine = jd ? `\n      JOB DESCRIPTION: ${jd}` : '';
  const resumeLine = resume.text.trim()
    ? resume.text
    : 'none provided — the candidate interviewed without a resume. Score on the transcript alone; do not penalize the absence of resume corroboration.';
  return `
      RESUME: ${resumeLine}
      TARGET ROLE: ${resume.role}
      EXPERIENCE: ${resume.experienceLevel}${jdLine}

      INTERVIEW TRANSCRIPT:
      ${chatTranscript}
    `;
}
