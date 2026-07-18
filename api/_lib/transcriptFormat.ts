import type { InterviewMessage } from '../../types';

/**
 * Render the transcript for the evaluator with USER turns explicitly numbered
 * (0-based, counting only user replies) so the model can reference a reply by
 * its printed `USER REPLY #n` index. Interviewer turns are labeled, not numbered.
 */
export function formatTranscriptForEvaluator(transcript: InterviewMessage[]): string {
  let userTurn = -1;
  return transcript
    .map(m => {
      if (m.role === 'user') {
        userTurn += 1;
        return `USER REPLY #${userTurn}: ${m.content}`;
      }
      return `INTERVIEWER: ${m.content}`;
    })
    .join('\n');
}
