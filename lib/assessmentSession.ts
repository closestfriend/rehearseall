import type { AssessmentAnswer, AssessmentDeck, AssessmentQuestion, InterviewMessage } from '../types';

export function isAssessmentAnswered(
  _question: AssessmentQuestion,
  answer?: AssessmentAnswer,
): boolean {
  if (!answer) return false;
  return Array.isArray(answer.value)
    ? answer.value.length > 0
    : Boolean(answer.value.trim());
}

export function assessmentProgress(
  deck: AssessmentDeck,
  answers: AssessmentAnswer[],
): { answered: number; total: number; percent: number } {
  const byQuestion = new Map(answers.map(answer => [answer.questionId, answer]));
  const answered = deck.questions.filter(question =>
    isAssessmentAnswered(question, byQuestion.get(question.id))).length;
  const total = deck.questions.length;
  return { answered, total, percent: total ? Math.round((answered / total) * 100) : 0 };
}

export function assessmentAnswersToTranscript(
  deck: AssessmentDeck,
  answers: AssessmentAnswer[],
  baseTimestamp = Date.now(),
): InterviewMessage[] {
  const byQuestion = new Map(answers.map(answer => [answer.questionId, answer.value]));
  return deck.questions.flatMap((question, index) => {
    const value = byQuestion.get(question.id);
    const questionContent = question.stimulus
      ? `${question.stimulus}\n\n${question.prompt}`
      : question.prompt;
    const answerContent = Array.isArray(value)
      ? value.length ? value.join('; ') : '[Unanswered]'
      : value?.trim() || '[Unanswered]';
    return [
      { role: 'assistant' as const, content: questionContent, timestamp: baseTimestamp + index * 2 },
      { role: 'user' as const, content: answerContent, timestamp: baseTimestamp + index * 2 + 1 },
    ];
  });
}
