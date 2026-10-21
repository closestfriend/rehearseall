import { describe, expect, it } from 'vitest';
import { computeProgress, type RehearsalSession } from './store';
import type { Competency } from './scenarios';

function finished(scenarioId: string, at: number, scores: Partial<Record<Competency, number>>): RehearsalSession {
  return {
    id: `${scenarioId}-${at}`, userId: 'demo', scenarioId, title: scenarioId, counterpart: 'x', goal: 'y', context: '',
    competencies: Object.keys(scores) as Competency[], personaId: 'examiner', messages: [], startedAt: at, finishedAt: at,
    scorecard: {
      overallScore: 60, headline: '', strengths: [], improvements: [], tryNextTime: '',
      competencyScores: Object.entries(scores).map(([competency, score]) => ({ competency: competency as Competency, score: score!, evidence: '' })),
    },
  };
}

describe('computeProgress', () => {
  it('is empty with no history', () => {
    const p = computeProgress([]);
    expect(p.sessionsCompleted).toBe(0);
    expect(p.weakest).toBeNull();
    expect(p.recommendedScenarioId).toBeNull();
  });

  it('averages each skill across sessions and tracks first vs latest', () => {
    const p = computeProgress([
      finished('ask-for-a-raise', 1, { Evidence: 50, Composure: 80 }),
      finished('negotiate-an-offer', 2, { Evidence: 70 }),
    ]);
    const evidence = p.competencies.find(c => c.competency === 'Evidence')!;
    expect(evidence).toMatchObject({ average: 60, first: 50, latest: 70, sessions: 2 });
    expect(p.weakest!.competency).toBe('Evidence');
    expect(p.strongest!.competency).toBe('Composure');
  });

  it('recommends the least recently practiced scenario that trains the weakest skill', () => {
    const p = computeProgress([finished('ask-for-a-raise', 1, { 'Handling pushback': 30, Composure: 90 })]);
    expect(p.weakest!.competency).toBe('Handling pushback');
    expect(p.recommendedScenarioId).not.toBe('ask-for-a-raise');
  });
});
