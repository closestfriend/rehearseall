// Client-safe constants only. Prompt text, persona fragments, voice mappings,
// and model ids live server-side in api/_lib/prompts.ts — nothing here may
// reveal how the interviewer is prompted.

export interface PersonaPublic {
  id: string;
  name: string;
}

// Public roster (names appear in Home marketing copy and the Debrief reveal).
// api/_lib/prompts.ts composes these with the private fragments — ids must
// stay in sync with PERSONA_PRIVATE there (prompts.test.ts enforces it).
export const INTERVIEWER_PERSONAS: PersonaPublic[] = [
  { id: 'skeptic', name: 'The Skeptic' },
  { id: 'warm-mentor', name: 'The Warm Mentor' },
  { id: 'rapid-fire', name: 'The Rapid-Fire Screener' },
  { id: 'socratic', name: 'The Socratic Probe' },
  { id: 'director', name: 'The Seasoned Director' },
  { id: 'examiner', name: 'The Neutral Examiner' },
];

export const LAST_PERSONA_STORAGE_KEY = 'hireprep_last_persona_v1';
