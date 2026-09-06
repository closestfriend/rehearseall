import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_EVALUATOR_SYSTEM,
  buildAssessmentEvaluationPrompt,
} from './assessmentEvaluator';
import type { AssessmentDeck, RehearsalSetup } from '../../types';

const SETUP: RehearsalSetup = {
  kind: 'rehearsal', presetId: 'data-annotation-test', title: 'Data Annotation Test',
  format: 'assessment', domain: 'Data, math, and reasoning', description: 'Apply a rubric.',
  instructions: 'Test edge cases.', competencies: ['consistency'], guidance: ['include ambiguity'],
  evaluationCriteria: ['label accuracy'], targetQuestionCount: 2, supportsScreenShare: false,
  participantContext: 'I work on model evaluation.',
};

const DECK: AssessmentDeck = {
  title: 'Annotation practice', instructions: 'Apply the supplied rule.', questions: [
    {
      id: 'q1', type: 'single-choice', prompt: 'Choose the label.', options: ['Allow', 'Escalate'],
      answerKey: ['Escalate'], evaluationCriteria: ['Escalate when evidence is incomplete.'],
      rationale: 'The rule requires escalation under uncertainty.',
    },
    {
      id: 'q2', type: 'short-text', prompt: 'Explain the boundary.',
      evaluationCriteria: ['Name the missing evidence.'], rationale: 'A strong answer identifies the unresolved fact.',
    },
  ],
};

describe('assessment evaluation prompt', () => {
  it('preserves the guide, criteria, rationale, response, and unanswered state', () => {
    const out = buildAssessmentEvaluationPrompt(SETUP, DECK, [{ questionId: 'q1', value: 'Escalate' }]);
    expect(out).toContain(SETUP.title);
    expect(out).toContain('Choose the label.');
    expect(out).toContain('ANSWER GUIDE: Escalate');
    expect(out).toContain('Escalate when evidence is incomplete.');
    expect(out).toContain('The rule requires escalation under uncertainty.');
    expect(out).toContain('USER RESPONSE: Escalate');
    expect(out).toContain('USER RESPONSE: [UNANSWERED]');
  });

  it('uses an assessment-specific scoring rubric', () => {
    expect(ASSESSMENT_EVALUATOR_SYSTEM).toContain('domain accuracy');
    expect(ASSESSMENT_EVALUATOR_SYSTEM).toContain('reasoning quality');
    expect(ASSESSMENT_EVALUATOR_SYSTEM).toContain('guideline consistency');
    expect(ASSESSMENT_EVALUATOR_SYSTEM).toContain('uncertainty');
    expect(ASSESSMENT_EVALUATOR_SYSTEM).not.toContain('interview charisma');
  });
});
