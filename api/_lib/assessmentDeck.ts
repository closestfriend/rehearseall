import type {
  AssessmentAnswer,
  AssessmentDeck,
  AssessmentQuestion,
  AssessmentQuestionType,
  RehearsalSetup,
} from '../../types';

export type AssessmentValidated<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

const LIMITS = {
  title: 240,
  instructions: 2_000,
  questionId: 80,
  prompt: 2_000,
  stimulus: 6_000,
  option: 500,
  options: 8,
  criteria: 8,
  criterion: 600,
  rationale: 2_000,
  answer: 8_000,
};

const QUESTION_TYPES = new Set<AssessmentQuestionType>([
  'single-choice',
  'multiple-choice',
  'short-text',
  'long-text',
]);

const isBoundedString = (value: unknown, max: number, allowEmpty = false): value is string =>
  typeof value === 'string' && value.length <= max && (allowEmpty || Boolean(value.trim()));

const isBoundedStringArray = (
  value: unknown,
  maxItems: number,
  maxChars: number,
  minItems = 1,
): value is string[] => Array.isArray(value)
  && value.length >= minItems
  && value.length <= maxItems
  && value.every(item => isBoundedString(item, maxChars));

export function buildAssessmentDeckPrompt(setup: RehearsalSetup): string {
  return `Create an original, independent approximation of a professional practice assessment.
Do not claim these are official an assessment provider questions and do not imitate or reconstruct confidential material.

ASSESSMENT: ${setup.title}
DOMAIN: ${setup.domain}
DESCRIPTION: ${setup.description}
CONSTRUCTION INSTRUCTIONS: ${setup.instructions}
COMPETENCIES:
${setup.competencies.map(item => `- ${item}`).join('\n')}
CONSTRUCTION GUIDANCE:
${setup.guidance.map(item => `- ${item}`).join('\n')}
PARTICIPANT CONTEXT: ${setup.participantContext.trim() || 'none provided'}

Return exactly ${setup.targetQuestionCount} questions. Use only single-choice,
multiple-choice, short-text, and long-text item types. Make every question
self-contained and original. Always return options and answerKey arrays. Choice
items need 2-8 unique options and a non-empty answer key drawn from those options;
for text items, return empty options and answerKey arrays. Every item needs
evaluation criteria and a private rationale. If an item represents visual, video,
or audio source material, put a textual representation in stimulus and begin it
with "SIMULATED" so the interface cannot imply real media was presented. Do not
reveal answer keys or rationales in the prompt or stimulus.`;
}

function validateQuestion(raw: unknown): AssessmentValidated<AssessmentQuestion> {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'question shape' };
  const q = raw as Record<string, unknown>;
  if (!isBoundedString(q.id, LIMITS.questionId)) return { ok: false, reason: 'question.id' };
  if (typeof q.type !== 'string' || !QUESTION_TYPES.has(q.type as AssessmentQuestionType))
    return { ok: false, reason: 'question.type' };
  if (!isBoundedString(q.prompt, LIMITS.prompt)) return { ok: false, reason: 'question.prompt' };
  if (q.stimulus !== undefined && !isBoundedString(q.stimulus, LIMITS.stimulus))
    return { ok: false, reason: 'question.stimulus' };
  if (!isBoundedStringArray(q.evaluationCriteria, LIMITS.criteria, LIMITS.criterion))
    return { ok: false, reason: 'question.evaluationCriteria' };
  if (!isBoundedString(q.rationale, LIMITS.rationale)) return { ok: false, reason: 'question.rationale' };

  const choice = q.type === 'single-choice' || q.type === 'multiple-choice';
  if (choice) {
    if (!isBoundedStringArray(q.options, LIMITS.options, LIMITS.option, 2))
      return { ok: false, reason: 'question.options' };
    if (new Set(q.options).size !== q.options.length) return { ok: false, reason: 'question.options duplicate' };
    if (!isBoundedStringArray(q.answerKey, q.type === 'single-choice' ? 1 : LIMITS.options, LIMITS.option))
      return { ok: false, reason: 'question.answerKey' };
    if (q.type === 'single-choice' && q.answerKey.length !== 1)
      return { ok: false, reason: 'question.answerKey single' };
    if (q.answerKey.some(answer => !(q.options as string[]).includes(answer)))
      return { ok: false, reason: 'question.answerKey option' };
  } else {
    if (q.options !== undefined && (!Array.isArray(q.options) || q.options.length !== 0))
      return { ok: false, reason: 'question.options text' };
    if (q.answerKey !== undefined && (!Array.isArray(q.answerKey) || q.answerKey.length !== 0))
      return { ok: false, reason: 'question.answerKey text' };
  }

  return {
    ok: true,
    value: {
      id: q.id,
      type: q.type as AssessmentQuestionType,
      prompt: q.prompt,
      ...(q.stimulus === undefined ? {} : { stimulus: q.stimulus as string }),
      ...(!Array.isArray(q.options) || q.options.length === 0 ? {} : { options: [...q.options as string[]] }),
      ...(!Array.isArray(q.answerKey) || q.answerKey.length === 0 ? {} : { answerKey: [...q.answerKey as string[]] }),
      evaluationCriteria: [...q.evaluationCriteria as string[]],
      rationale: q.rationale,
    },
  };
}

export function validateAssessmentDeck(
  raw: unknown,
  expectedCount: number,
): AssessmentValidated<AssessmentDeck> {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'deck shape' };
  const deck = raw as Record<string, unknown>;
  if (!isBoundedString(deck.title, LIMITS.title)) return { ok: false, reason: 'deck.title' };
  if (!isBoundedString(deck.instructions, LIMITS.instructions)) return { ok: false, reason: 'deck.instructions' };
  if (!Array.isArray(deck.questions) || deck.questions.length !== expectedCount)
    return { ok: false, reason: 'deck.questions count' };

  const questions: AssessmentQuestion[] = [];
  const ids = new Set<string>();
  for (const rawQuestion of deck.questions) {
    const question = validateQuestion(rawQuestion);
    if (question.ok === false) return { ok: false, reason: question.reason };
    if (ids.has(question.value.id)) return { ok: false, reason: 'question.id duplicate' };
    ids.add(question.value.id);
    questions.push(question.value);
  }
  return { ok: true, value: { title: deck.title, instructions: deck.instructions, questions } };
}

export function validateAssessmentAnswers(
  raw: unknown,
  deck: AssessmentDeck,
): AssessmentValidated<AssessmentAnswer[]> {
  if (!Array.isArray(raw) || raw.length > deck.questions.length) return { ok: false, reason: 'answers shape' };
  const questions = new Map(deck.questions.map(question => [question.id, question]));
  const seen = new Set<string>();
  const answers: AssessmentAnswer[] = [];
  for (const rawAnswer of raw) {
    if (typeof rawAnswer !== 'object' || rawAnswer === null) return { ok: false, reason: 'answer shape' };
    const answer = rawAnswer as Record<string, unknown>;
    if (!isBoundedString(answer.questionId, LIMITS.questionId)) return { ok: false, reason: 'answer.questionId' };
    if (seen.has(answer.questionId)) return { ok: false, reason: 'answer duplicate' };
    const question = questions.get(answer.questionId);
    if (!question) return { ok: false, reason: 'answer unknown question' };
    seen.add(answer.questionId);

    if (question.type === 'multiple-choice') {
      if (!isBoundedStringArray(answer.value, question.options?.length ?? LIMITS.options, LIMITS.option))
        return { ok: false, reason: 'answer.value choices' };
      if (answer.value.some(value => !question.options?.includes(value)))
        return { ok: false, reason: 'answer.value option' };
      answers.push({ questionId: answer.questionId, value: [...answer.value] });
    } else {
      if (!isBoundedString(answer.value, LIMITS.answer, true)) return { ok: false, reason: 'answer.value text' };
      if (question.type === 'single-choice' && !question.options?.includes(answer.value))
        return { ok: false, reason: 'answer.value option' };
      answers.push({ questionId: answer.questionId, value: answer.value });
    }
  }
  return { ok: true, value: answers };
}
