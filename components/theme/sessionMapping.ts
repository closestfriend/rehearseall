import type { HistoryEntry } from '../../types';

export interface SessionRow {
  entry: HistoryEntry;
  role: string;
  level: string;
  persona: string;
  score: number;
  dateDot: string;   // "07.03" — Personal Best
  dateSlash: string; // "07/03" — Transcript
}

export function toSessionRow(entry: HistoryEntry): SessionRow {
  const d = new Date(entry.date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return {
    entry,
    role: entry.resume.role,
    level: entry.resume.experienceLevel.toUpperCase(),
    persona: entry.personaName,
    score: entry.feedback.score,
    dateDot: `${mm}.${dd}`,
    dateSlash: `${mm}/${dd}`,
  };
}
