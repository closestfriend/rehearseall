import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { InterviewMessage } from '../types';
import { COMPETENCIES, SCENARIOS, type Competency } from './scenarios';

export interface CompetencyScore {
  competency: Competency;
  score: number;
  evidence: string;
}

export interface Scorecard {
  overallScore: number;
  headline: string;
  competencyScores: CompetencyScore[];
  strengths: string[];
  improvements: string[];
  tryNextTime: string;
}

export interface RehearsalSession {
  id: string;
  userId: string;
  scenarioId: string;
  title: string;
  counterpart: string;
  goal: string;
  context: string;
  concern?: string;
  competencies: Competency[];
  personaId: string;
  messages: InterviewMessage[];
  startedAt: number;
  finishedAt?: number;
  scorecard?: Scorecard;
}

interface StoreData {
  sessions: RehearsalSession[];
}

export interface RehearsalStore {
  get(sessionId: string): RehearsalSession | undefined;
  save(session: RehearsalSession): void;
  finishedFor(userId: string): RehearsalSession[];
}

export class MemoryStore implements RehearsalStore {
  protected data: StoreData = { sessions: [] };

  get(sessionId: string) {
    return this.data.sessions.find(s => s.id === sessionId);
  }

  save(session: RehearsalSession) {
    const i = this.data.sessions.findIndex(s => s.id === session.id);
    if (i >= 0) this.data.sessions[i] = session;
    else this.data.sessions.push(session);
  }

  finishedFor(userId: string) {
    return this.data.sessions
      .filter(s => s.userId === userId && s.scorecard)
      .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
  }
}

/** Persists to a JSON file so progress survives a server restart (the cross-session memory). */
export class FileStore extends MemoryStore {
  constructor(private readonly path: string) {
    super();
    try {
      this.data = JSON.parse(readFileSync(path, 'utf8')) as StoreData;
    } catch {
      this.data = { sessions: [] };
    }
  }

  save(session: RehearsalSession) {
    super.save(session);
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    renameSync(tmp, this.path);
  }
}

export interface CompetencyProgress {
  competency: Competency;
  average: number;
  latest: number;
  first: number;
  sessions: number;
}

export interface Progress {
  sessionsCompleted: number;
  competencies: CompetencyProgress[];
  weakest: CompetencyProgress | null;
  strongest: CompetencyProgress | null;
  recommendedScenarioId: string | null;
  recent: { title: string; overallScore: number; finishedAt: number }[];
}

/** Pure aggregation over finished sessions, oldest first. */
export function computeProgress(finished: RehearsalSession[]): Progress {
  const byCompetency = new Map<Competency, number[]>();
  for (const s of finished) {
    for (const c of s.scorecard?.competencyScores ?? []) {
      if (!COMPETENCIES.includes(c.competency)) continue;
      const list = byCompetency.get(c.competency) ?? [];
      list.push(c.score);
      byCompetency.set(c.competency, list);
    }
  }

  const competencies: CompetencyProgress[] = [...byCompetency.entries()]
    .map(([competency, scores]) => ({
      competency,
      average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      latest: scores[scores.length - 1],
      first: scores[0],
      sessions: scores.length,
    }))
    .sort((a, b) => a.average - b.average);

  const weakest = competencies[0] ?? null;
  const strongest = competencies.length > 1 ? competencies[competencies.length - 1] : null;

  return {
    sessionsCompleted: finished.length,
    competencies,
    weakest,
    strongest,
    recommendedScenarioId: weakest ? recommendScenario(weakest.competency, finished) : null,
    recent: finished.slice(-5).reverse().map(s => ({
      title: s.title,
      overallScore: s.scorecard!.overallScore,
      finishedAt: s.finishedAt ?? s.startedAt,
    })),
  };
}

/** The least-recently practiced preset that trains the given competency. */
function recommendScenario(competency: Competency, finished: RehearsalSession[]): string | null {
  const candidates = SCENARIOS.filter(s => s.competencies.includes(competency));
  if (candidates.length === 0) return null;
  const lastPracticed = (id: string) =>
    Math.max(-1, ...finished.filter(s => s.scenarioId === id).map(s => s.finishedAt ?? 0));
  return [...candidates].sort((a, b) => lastPracticed(a.id) - lastPracticed(b.id))[0].id;
}
