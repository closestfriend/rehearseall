import { describe, it, expect } from 'vitest';
import { formatTranscriptForEvaluator } from './transcriptFormat';
import type { InterviewMessage } from '../../types';

const msg = (role: 'user' | 'assistant', content: string): InterviewMessage => ({ role, content, timestamp: 0 });

describe('formatTranscriptForEvaluator', () => {
  it('numbers user replies 0-based and labels interviewer turns', () => {
    const out = formatTranscriptForEvaluator([
      msg('assistant', 'Q1'),
      msg('user', 'A1'),
      msg('assistant', 'Q2'),
      msg('user', 'A2'),
    ]);
    expect(out).toBe('INTERVIEWER: Q1\nUSER REPLY #0: A1\nINTERVIEWER: Q2\nUSER REPLY #1: A2');
  });

  it('counts only user turns for the index', () => {
    const out = formatTranscriptForEvaluator([
      msg('user', 'First'),
      msg('user', 'Second'),
    ]);
    expect(out).toBe('USER REPLY #0: First\nUSER REPLY #1: Second');
  });
});
