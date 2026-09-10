import { describe, expect, it } from 'vitest';
import {
  buildAssessmentDeckPrompt,
  validateAssessmentAnswers,
  validateAssessmentDeck,
} from './assessmentDeck';
import type { RehearsalSetup } from '../../types';

const SETUP: RehearsalSetup = {
  kind: 'rehearsal', presetId: 'model-response-evaluation', title: 'Model Response Evaluation',
  format: 'assessment', domain: 'AI and evaluation', description: 'Judge model outputs.',
  instructions: 'Create response-comparison tasks.', competencies: ['error detection', 'ranking'],
  guidance: ['include subtle errors', 'distinguish style from substance'],
  evaluationCriteria: ['issue detection', 'consistent rubric'], targetQuestionCount: 2,
  supportsScreenShare: false, participantContext: 'I study AI harms.',
};

const VALID_DECK = {
  title: 'Model Response Evaluation practice cut',
  instructions: 'Answer both questions without outside tools.',
  questions: [
    {
      id: 'q1',
      type: 'single-choice',
      prompt: 'Which response better follows the instruction?',
      stimulus: 'User asks for a two-sentence neutral summary. Response A has two neutral sentences; Response B has four opinionated sentences.',
      options: ['Response A', 'Response B'],
      answerKey: ['Response A'],
      evaluationCriteria: ['Select the response that follows length and tone constraints.'],
      rationale: 'Response A follows both explicit constraints.',
    },
    {
      id: 'q2',
      type: 'short-text',
      prompt: 'Name the most consequential defect in the response.',
      stimulus: 'The response invents a study result that was not provided.',
      evaluationCriteria: ['Identify unsupported factual invention.'],
      rationale: 'The central problem is fabrication rather than writing style.',
    },
  ],
};

describe('assessment deck construction', () => {
  it('grounds generation in the preset and marks simulations and originality boundaries', () => {
    const prompt = buildAssessmentDeckPrompt(SETUP);
    expect(prompt).toContain(SETUP.title);
    expect(prompt).toContain(SETUP.competencies[0]);
    expect(prompt).toContain(SETUP.guidance[0]);
    expect(prompt).toContain(SETUP.participantContext);
    expect(prompt).toContain('exactly 2 questions');
    expect(prompt).toContain('independent approximation');
    expect(prompt).toContain('SIMULATED');
  });

  it('accepts and rebuilds a complete deck', () => {
    const result = validateAssessmentDeck({ ...VALID_DECK, unknown: 'drop' }, 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(VALID_DECK);
      expect('unknown' in result.value).toBe(false);
    }
  });

  it('accepts schema-required empty choice fields on text questions and strips them', () => {
    const generatedDeck = {
      ...VALID_DECK,
      questions: [
        VALID_DECK.questions[0],
        { ...VALID_DECK.questions[1], options: [], answerKey: [] },
      ],
    };

    const result = validateAssessmentDeck(generatedDeck, 2);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(VALID_DECK);
  });

  it('rejects wrong counts, duplicate ids, and unsupported item types', () => {
    expect(validateAssessmentDeck({ ...VALID_DECK, questions: [VALID_DECK.questions[0]] }, 2).ok).toBe(false);
    expect(validateAssessmentDeck({ ...VALID_DECK, questions: [VALID_DECK.questions[0], { ...VALID_DECK.questions[1], id: 'q1' }] }, 2).ok).toBe(false);
    expect(validateAssessmentDeck({ ...VALID_DECK, questions: [{ ...VALID_DECK.questions[0], type: 'rating' }, VALID_DECK.questions[1]] }, 2).ok).toBe(false);
  });

  it('rejects malformed choice options and answer keys', () => {
    expect(validateAssessmentDeck({ ...VALID_DECK, questions: [{ ...VALID_DECK.questions[0], options: ['Only'] }, VALID_DECK.questions[1]] }, 2).ok).toBe(false);
    expect(validateAssessmentDeck({ ...VALID_DECK, questions: [{ ...VALID_DECK.questions[0], answerKey: ['Missing'] }, VALID_DECK.questions[1]] }, 2).ok).toBe(false);
    expect(validateAssessmentDeck({ ...VALID_DECK, questions: [{ ...VALID_DECK.questions[0], options: ['Same', 'Same'], answerKey: ['Same'] }, VALID_DECK.questions[1]] }, 2).ok).toBe(false);
  });
});

describe('assessment answer validation', () => {
  it('accepts one response per known question with the correct value shape', () => {
    const deck = validateAssessmentDeck(VALID_DECK, 2);
    expect(deck.ok).toBe(true);
    if (!deck.ok) return;
    const result = validateAssessmentAnswers([
      { questionId: 'q1', value: 'Response A' },
      { questionId: 'q2', value: 'Fabricated evidence' },
    ], deck.value);
    expect(result.ok).toBe(true);
  });

  it('rejects duplicates, unknown questions, and incompatible answer shapes', () => {
    const deck = validateAssessmentDeck(VALID_DECK, 2);
    expect(deck.ok).toBe(true);
    if (!deck.ok) return;
    expect(validateAssessmentAnswers([{ questionId: 'q1', value: 'Response A' }, { questionId: 'q1', value: 'Response B' }], deck.value).ok).toBe(false);
    expect(validateAssessmentAnswers([{ questionId: 'q9', value: 'x' }], deck.value).ok).toBe(false);
    expect(validateAssessmentAnswers([{ questionId: 'q1', value: ['Response A'] }], deck.value).ok).toBe(false);
    expect(validateAssessmentAnswers([{ questionId: 'q2', value: ['text'] }], deck.value).ok).toBe(false);
  });
});
