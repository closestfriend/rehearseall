import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '../../types';
import { toSessionRow } from './sessionMapping';

describe('toSessionRow', () => {
  it('maps an open rehearsal without assuming interview fields', () => {
    const entry: HistoryEntry = {
      id: 'doctor-call',
      date: new Date('2026-09-02T12:00:00Z').getTime(),
      resume: {
        kind: 'conversation',
        title: 'AI and teenagers research call',
        counterpart: "Doctor at Nationwide Children's Hospital",
        goal: 'Build shared language and identify a useful collaboration.',
        context: 'I study AI harms and want to understand the clinical frame.',
      },
      transcript: [],
      feedback: {
        score: 84,
        strengths: [],
        improvements: [],
        detailedAnalysis: '',
        suggestions: [],
      },
      personaName: 'Dr. Chen',
    };

    const row = toSessionRow(entry);

    expect(row.role).toBe('AI and teenagers research call');
    expect(row.level).toBe("DOCTOR AT NATIONWIDE CHILDREN'S HOSPITAL");
  });
});
