import { describe, expect, it } from 'vitest';
import type { AssessmentAnswer, AssessmentDeck } from '../types';
import {
  assessmentAnswersToTranscript,
  assessmentProgress,
  isAssessmentAnswered,
} from './assessmentSession';

const deck: AssessmentDeck = {
  title: 'Practice', instructions: 'Answer.', questions: [
    { id: 'q1', type: 'single-choice', prompt: 'Choose one.', options: ['A', 'B'], answerKey: ['A'], evaluationCriteria: ['correct'], rationale: 'A is correct.' },
    { id: 'q2', type: 'multiple-choice', prompt: 'Choose all.', options: ['A', 'B'], answerKey: ['A', 'B'], evaluationCriteria: ['complete'], rationale: 'Both.' },
    { id: 'q3', type: 'short-text', prompt: 'Explain.', stimulus: 'SIMULATED scene', evaluationCriteria: ['clear'], rationale: 'Explain clearly.' },
  ],
};

describe('assessment session helpers', () => {
  it('treats blank text and empty selections as unanswered', () => {
    expect(isAssessmentAnswered(deck.questions[0], undefined)).toBe(false);
    expect(isAssessmentAnswered(deck.questions[1], { questionId: 'q2', value: [] })).toBe(false);
    expect(isAssessmentAnswered(deck.questions[2], { questionId: 'q3', value: '   ' })).toBe(false);
  });

  it('counts only substantive responses in progress', () => {
    const answers: AssessmentAnswer[] = [
      { questionId: 'q1', value: 'A' },
      { questionId: 'q2', value: [] },
      { questionId: 'q3', value: 'Because the evidence supports it.' },
    ];
    expect(assessmentProgress(deck, answers)).toEqual({ answered: 2, total: 3, percent: 67 });
  });

  it('projects questions and answers in deck order and preserves blanks', () => {
    const transcript = assessmentAnswersToTranscript(deck, [
      { questionId: 'q3', value: 'My explanation' },
      { questionId: 'q1', value: 'A' },
    ], 1000);
    expect(transcript.map(message => message.role)).toEqual(['assistant', 'user', 'assistant', 'user', 'assistant', 'user']);
    expect(transcript[0].content).toBe('Choose one.');
    expect(transcript[1].content).toBe('A');
    expect(transcript[3].content).toBe('[Unanswered]');
    expect(transcript[4].content).toBe('SIMULATED scene\n\nExplain.');
    expect(transcript[5].content).toBe('My explanation');
    expect(transcript[0].timestamp).toBe(1000);
    expect(transcript[5].timestamp).toBe(1005);
  });
});
