import type { AssessmentAnswer, AssessmentDeck, RehearsalSetup } from '../../types';

export const ASSESSMENT_EVALUATOR_SYSTEM = `
You evaluate a structured professional practice assessment.

Write the report in ENGLISH. Score the submitted work against the answer guide
and item-specific criteria. Weight domain accuracy, reasoning quality,
instruction following, guideline consistency, and appropriate uncertainty.
Distinguish substantive errors from harmless differences in wording. Do not
claim the assessment or score is official, affiliated with, or endorsed by
any assessment provider.

Return valid JSON with:
- score: number from 0 to 100
- strengths: concise evidence-backed strings
- improvements: specific actionable strings
- detailedAnalysis: a clear account of performance across the deck
- suggestions: always an empty array for structured assessments
`;

const renderValue = (value: string | string[] | undefined) => {
  if (value === undefined) return '[UNANSWERED]';
  if (Array.isArray(value)) return value.length ? value.join(' | ') : '[UNANSWERED]';
  return value.trim() || '[UNANSWERED]';
};

export function buildAssessmentEvaluationPrompt(
  setup: RehearsalSetup,
  deck: AssessmentDeck,
  answers: AssessmentAnswer[],
): string {
  const byQuestion = new Map(answers.map(answer => [answer.questionId, answer.value]));
  const items = deck.questions.map((question, index) => `
ITEM ${index + 1} (${question.id})
QUESTION: ${question.prompt}
${question.stimulus ? `STIMULUS: ${question.stimulus}\n` : ''}ANSWER GUIDE: ${question.answerKey?.join(' | ') || 'Use the criteria and rationale for qualitative scoring.'}
EVALUATION CRITERIA: ${question.evaluationCriteria.join('; ')}
PRIVATE RATIONALE: ${question.rationale}
USER RESPONSE: ${renderValue(byQuestion.get(question.id))}`).join('\n');

  return `ASSESSMENT: ${setup.title}
DOMAIN: ${setup.domain}
PARTICIPANT CONTEXT: ${setup.participantContext.trim() || 'none provided'}
DECK INSTRUCTIONS: ${deck.instructions}

Evaluate every item, including unanswered items. Use the supplied guides as
grading context, not text to repeat back mechanically.
${items}`;
}
