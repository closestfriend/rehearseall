# Randomized Interviewer Personas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each interview session use a randomly-assigned, hidden interviewer persona (driving both behavior and voice), revealed only on the feedback screen, without weakening any load-bearing functional rule.

**Architecture:** Split the interviewer system prompt into a frozen functional core + a per-session persona "flavor" fragment, assembled by one builder used by both interview components. `App.tsx` picks a persona at interview start (anti-repeat via localStorage), threads it to the active component and into history, and reveals it on feedback. The evaluator is never told the persona.

**Tech Stack:** React 19, Vite 6, TypeScript 5.8, `@google/genai`. Tests via Vitest (added in Task 1; node environment, pure-logic units only).

**Spec:** `docs/superpowers/specs/2026-06-02-randomized-interviewer-personas-design.md`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `vitest.config.ts` | Test runner config (node env) | Create |
| `package.json` | Add `vitest` devDep + `test` scripts | Modify |
| `constants.ts` | Persona type/roster, `pickPersona()`, frozen core, `buildInterviewerSystemInstruction()` | Modify |
| `constants.test.ts` | Unit tests for the above | Create |
| `types.ts` | `personaName` on `HistoryEntry` | Modify (`HistoryEntry`, lines 21-27) |
| `components/InterviewChat.tsx` | Use persona + builder | Modify (lines 4, 7-11, 26-32) |
| `components/VoiceInterview.tsx` | Use persona for voice + builder | Modify (lines 4, 11-15, 104, 106-115, 195) |
| `App.tsx` | Persona selection/threading, remove voice picker, reveal | Modify (lines 8, 24, 73-79, 95-100, 102-135, 311-325, 329, 345, 390-396, 505-516) |

---

## Task 1: Add Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Test: `smoke.test.ts` (temporary, deleted in Step 6)

- [ ] **Step 1: Add the dependency and scripts**

Run:
```bash
npm install -D vitest@^3
```

Then edit `package.json` `scripts` to add two lines (after `"preview": "vite preview"`):
```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 2: Create `vitest.config.ts`**

A standalone config (so the dev-only console-forward plugin in `vite.config.ts` is not loaded during tests):
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Write a smoke test**

Create `smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('vitest wiring', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run it**

Run: `npm test`
Expected: PASS — 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts smoke.test.ts
git commit -m "test: add Vitest with node environment"
```

- [ ] **Step 6: Delete the smoke test**

```bash
rm smoke.test.ts
git add -A && git commit -m "test: remove vitest smoke test"
```

---

## Task 2: Persona type and roster

**Files:**
- Modify: `constants.ts` (append after `INTERVIEWER_VOICES`, line 74)
- Test: `constants.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `constants.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { INTERVIEWER_PERSONAS, INTERVIEWER_VOICES } from './constants';

describe('INTERVIEWER_PERSONAS', () => {
  it('has six personas with unique ids', () => {
    expect(INTERVIEWER_PERSONAS).toHaveLength(6);
    const ids = INTERVIEWER_PERSONAS.map(p => p.id);
    expect(new Set(ids).size).toBe(6);
  });

  it('maps every persona to a real voice id', () => {
    const voiceIds = new Set(INTERVIEWER_VOICES.map(v => v.id));
    for (const p of INTERVIEWER_PERSONAS) {
      expect(voiceIds.has(p.voiceId)).toBe(true);
    }
  });

  it('gives every persona a non-empty name and fragment', () => {
    for (const p of INTERVIEWER_PERSONAS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.fragment.trim().length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run constants.test.ts`
Expected: FAIL — `INTERVIEWER_PERSONAS` is not exported.

- [ ] **Step 3: Implement the type and roster**

Append to `constants.ts`:
```ts
export interface InterviewerPersona {
  id: string;
  name: string;
  voiceId: string;   // must match an INTERVIEWER_VOICES id
  fragment: string;  // flavor layer — carries no functional rules
}

export const INTERVIEWER_PERSONAS: InterviewerPersona[] = [
  {
    id: 'skeptic',
    name: 'The Skeptic',
    voiceId: 'Kore',
    fragment: `You are a sharp, evidence-driven interviewer. You don't take claims at face value: when the candidate asserts an achievement, press for the "how do you know," the metric, the counterfactual. Cordial but exacting. Open with a brief, no-nonsense introduction.`,
  },
  {
    id: 'warm-mentor',
    name: 'The Warm Mentor',
    voiceId: 'Sulafat',
    fragment: `You are an encouraging interviewer who puts the candidate at ease while still digging into substance. Acknowledge good answers warmly, then go a level deeper. Invite the candidate to walk you through real experiences in their own words. Open with a friendly, welcoming introduction.`,
  },
  {
    id: 'rapid-fire',
    name: 'The Rapid-Fire Screener',
    voiceId: 'Puck',
    fragment: `You are a brisk, time-pressured screener. Keep your own turns short and move quickly through quick successive follow-ups. Favor crisp, pointed questions over long preambles. Open with a quick, energetic introduction and get straight into it.`,
  },
  {
    id: 'socratic',
    name: 'The Socratic Probe',
    voiceId: 'Iapetus',
    fragment: `You are a Socratic interviewer who makes the candidate reason aloud. Rather than asserting, you ask questions that expose how they think — "what would happen if...", "why that approach over the alternative?". Patient and curious. Open with a measured, thoughtful introduction.`,
  },
  {
    id: 'director',
    name: 'The Seasoned Director',
    voiceId: 'Gacrux',
    fragment: `You are a seasoned director focused on judgment and the big picture. You favor scenario and tradeoff questions — how the candidate prioritizes, handles ambiguity, and weighs competing concerns. Calm and authoritative. Open with a composed, senior introduction.`,
  },
  {
    id: 'examiner',
    name: 'The Neutral Examiner',
    voiceId: 'Schedar',
    fragment: `You are an even, by-the-book examiner. You run a structured interview with a steady, neutral tone. Where it fits the role, you may organize behavioral questions around the situation, the action taken, and the result. Open with a plain, professional introduction.`,
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run constants.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add constants.ts constants.test.ts
git commit -m "feat: add interviewer persona roster with voice mappings"
```

---

## Task 3: `pickPersona()` with anti-repeat

**Files:**
- Modify: `constants.ts` (append)
- Test: `constants.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `constants.test.ts`:
```ts
import { pickPersona, LAST_PERSONA_STORAGE_KEY, INTERVIEWER_PERSONAS as PERSONAS } from './constants';

describe('pickPersona', () => {
  it('returns a persona from the roster', () => {
    const ids = new Set(PERSONAS.map(p => p.id));
    expect(ids.has(pickPersona().id)).toBe(true);
  });

  it('never returns the excluded persona', () => {
    const exclude = PERSONAS[0].id;
    for (let i = 0; i < 200; i++) {
      expect(pickPersona(exclude).id).not.toBe(exclude);
    }
  });

  it('exposes a stable localStorage key', () => {
    expect(LAST_PERSONA_STORAGE_KEY).toBe('hireprep_last_persona_v1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run constants.test.ts`
Expected: FAIL — `pickPersona` / `LAST_PERSONA_STORAGE_KEY` not exported.

- [ ] **Step 3: Implement**

Append to `constants.ts`:
```ts
export const LAST_PERSONA_STORAGE_KEY = 'hireprep_last_persona_v1';

export function pickPersona(excludeId?: string): InterviewerPersona {
  const pool = INTERVIEWER_PERSONAS.filter(p => p.id !== excludeId);
  const choices = pool.length > 0 ? pool : INTERVIEWER_PERSONAS;
  const idx = Math.floor(Math.random() * choices.length);
  return choices[idx];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run constants.test.ts`
Expected: PASS — all tests.

- [ ] **Step 5: Commit**

```bash
git add constants.ts constants.test.ts
git commit -m "feat: add anti-repeat pickPersona selector"
```

---

## Task 4: Frozen core + `buildInterviewerSystemInstruction()`

**Files:**
- Modify: `constants.ts` (replace `SYSTEM_INSTRUCTION_INTERVIEWER`, lines 2-16; add import)
- Test: `constants.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `constants.test.ts`:
```ts
import { buildInterviewerSystemInstruction } from './constants';
import type { ResumeData } from './types';

const RESUME: ResumeData = { text: 'Ten years in ML research.', role: 'Research Scientist', experienceLevel: 'senior' };

describe('buildInterviewerSystemInstruction', () => {
  const skeptic = PERSONAS.find(p => p.id === 'skeptic')!;
  const out = buildInterviewerSystemInstruction(RESUME, skeptic);

  it('preserves the exact text-mode closing trigger substring', () => {
    expect(out.toLowerCase()).toContain('concludes our interview');
  });

  it('keeps the English-persistence rule', () => {
    expect(out).toContain('ENGLISH');
  });

  it('includes the persona fragment and name', () => {
    expect(out).toContain(skeptic.name);
    expect(out).toContain('evidence-driven');
  });

  it('injects the resume context', () => {
    expect(out).toContain(RESUME.text);
    expect(out).toContain(RESUME.role);
    expect(out).toContain(RESUME.experienceLevel);
  });

  it('does not hardcode STAR in the core (only personas may use it)', () => {
    // The frozen core is everything before the PERSONA marker.
    const core = out.split('PERSONA —')[0];
    expect(core).not.toContain('STAR');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run constants.test.ts`
Expected: FAIL — `buildInterviewerSystemInstruction` not exported.

- [ ] **Step 3: Implement**

In `constants.ts`, add the type import at the very top of the file (line 1):
```ts
import type { ResumeData } from './types';
```

Replace the existing `SYSTEM_INSTRUCTION_INTERVIEWER` export (lines 2-16) with the frozen core + builder:
```ts
export const INTERVIEWER_CORE = `
You are conducting a job interview.

CRITICAL — LANGUAGE: Conduct the entire interview in ENGLISH. Even if the
candidate responds in another language, persist in English.

RULES (these always hold, regardless of the persona below):
- Begin by introducing yourself and asking your first question.
- Ask one question at a time. Never stack multiple questions in one turn.
- Ask a substantive mix of experience-based and technical questions
  calibrated to the target role. Surface concrete, specific examples of
  real work and genuine reasoning under follow-up — not a generic
  interview script.
- Keep your turns reasonably concise. Your assigned persona may make you
  more or less terse, but never long-winded.
- The interview runs about 5-7 questions.
- When the interview is complete, close by saying, verbatim:
  "Thank you for your time. This concludes our interview."

The persona below shapes your tone, style, and how you probe — it never
overrides the rules above.
`;

export function buildInterviewerSystemInstruction(
  resume: ResumeData,
  persona: InterviewerPersona
): string {
  return `${INTERVIEWER_CORE}

PERSONA — ${persona.name}:
${persona.fragment}

Candidate Resume: ${resume.text}
Target Role: ${resume.role}
Level: ${resume.experienceLevel}`;
}
```

Note: `InterviewerPersona` is defined later in the file (Task 2). TypeScript hoists type references within a module, so the forward reference in the function signature is fine. If you prefer, move the `InterviewerPersona` interface above this function — either works.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run constants.test.ts`
Expected: PASS — all tests.

- [ ] **Step 5: Commit**

```bash
git add constants.ts constants.test.ts
git commit -m "feat: frozen interviewer core + persona-aware system-instruction builder

Decouples STAR from the core; closing trigger and English gating preserved."
```

---

## Task 5: Add `personaName` to `HistoryEntry`

**Files:**
- Modify: `types.ts` (lines 21-27)

- [ ] **Step 1: Edit the interface**

In `types.ts`, change `HistoryEntry` to add the field:
```ts
export interface HistoryEntry {
  id: string;
  date: number;
  resume: ResumeData;
  transcript: InterviewMessage[];
  feedback: InterviewFeedback;
  personaName: string;
}
```

- [ ] **Step 2: Verify type-checks against build**

Run: `npm run build`
Expected: FAIL — `App.tsx` constructs a `HistoryEntry` without `personaName` (fixed in Task 8). This confirms the field is now required; proceed.

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: record persona name on history entries"
```

---

## Task 6: `InterviewChat` uses the persona + builder

**Files:**
- Modify: `components/InterviewChat.tsx` (lines 4, 7-11, 26-32)

- [ ] **Step 1: Update imports**

Change line 4 from:
```ts
import { MODELS, SYSTEM_INSTRUCTION_INTERVIEWER } from '../constants';
```
to:
```ts
import { MODELS, buildInterviewerSystemInstruction, InterviewerPersona } from '../constants';
```

- [ ] **Step 2: Add `persona` to props**

Change the props interface (lines 7-11) to:
```ts
interface InterviewChatProps {
  resume: ResumeData;
  persona: InterviewerPersona;
  onFinish: (transcript: InterviewMessage[]) => void;
  onCancel: () => void;
}
```

And the component signature (line 13) to destructure it:
```ts
const InterviewChat: React.FC<InterviewChatProps> = ({ resume, persona, onFinish, onCancel }) => {
```

- [ ] **Step 3: Use the builder**

Replace the `systemInstruction` block (lines 26-32) with:
```ts
        config: {
          systemInstruction: buildInterviewerSystemInstruction(resume, persona),
        }
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: FAIL only in `App.tsx` (does not yet pass `persona` to `InterviewChat`). `InterviewChat.tsx` itself must produce no new errors. Fixed in Task 8.

- [ ] **Step 5: Commit**

```bash
git add components/InterviewChat.tsx
git commit -m "feat: text interview uses persona-aware prompt builder"
```

---

## Task 7: `VoiceInterview` uses the persona for voice + builder

**Files:**
- Modify: `components/VoiceInterview.tsx` (lines 4, 11-15, 104, 106-115, 195)

- [ ] **Step 1: Update imports**

Change line 4 from:
```ts
import { MODELS, SYSTEM_INSTRUCTION_INTERVIEWER } from '../constants';
```
to:
```ts
import { MODELS, buildInterviewerSystemInstruction, InterviewerPersona } from '../constants';
```

- [ ] **Step 2: Swap the `voice` prop for `persona`**

Change the props interface (lines 11-15 region) so `voice: string` becomes `persona: InterviewerPersona`:
```ts
interface VoiceInterviewProps {
  resume: ResumeData;
  persona: InterviewerPersona;
  onFinish: (transcript: string[]) => void;
  onCancel: () => void;
}
```

And the component signature (line 15):
```ts
const VoiceInterview: React.FC<VoiceInterviewProps> = ({ resume, persona, onFinish, onCancel }) => {
```

- [ ] **Step 3: Drive the voice from the persona**

Change line 104 from:
```ts
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }
```
to:
```ts
            voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.voiceId } }
```

- [ ] **Step 4: Use the builder and drop the inline ADVICE block**

Replace the `systemInstruction` block (lines 106-115) with:
```ts
          systemInstruction: buildInterviewerSystemInstruction(resume, persona),
```

- [ ] **Step 5: Fix the `useCallback`/`useEffect` dependency**

The `startSession` callback closes over the old `voice`. Find its dependency array (line 195, `}, [resume, voice, flushBuffers]);`) and change it to:
```ts
  }, [resume, persona, flushBuffers]);
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: FAIL only in `App.tsx` (still passes `voice={selectedVoice}`). `VoiceInterview.tsx` itself must produce no new errors. Fixed in Task 8.

- [ ] **Step 7: Commit**

```bash
git add components/VoiceInterview.tsx
git commit -m "feat: voice interview derives voice from persona + uses prompt builder"
```

---

## Task 8: Wire persona selection into `App.tsx`

**Files:**
- Modify: `App.tsx` (lines 8, 24, 73-79, 95-100, 311-325, 329, 345, 505-516)

- [ ] **Step 1: Update imports**

Change line 8 from:
```ts
import { INTERVIEWER_VOICES } from './constants';
```
to:
```ts
import { pickPersona, LAST_PERSONA_STORAGE_KEY, InterviewerPersona } from './constants';
```

- [ ] **Step 2: Replace voice state with persona state**

Remove line 24 (`const [selectedVoice, setSelectedVoice] = ...`) and add in its place:
```ts
  const [currentPersona, setCurrentPersona] = useState<InterviewerPersona | null>(null);
  const [displayPersonaName, setDisplayPersonaName] = useState<string | null>(null);
```

- [ ] **Step 3: Add a `startInterview` helper**

Add this function just above `handleResumeSubmit` (before line 57):
```ts
  const startInterview = (mode: AppStage.INTERVIEWING_VOICE | AppStage.INTERVIEWING_TEXT) => {
    const lastId = localStorage.getItem(LAST_PERSONA_STORAGE_KEY) ?? undefined;
    const persona = pickPersona(lastId);
    setCurrentPersona(persona);
    localStorage.setItem(LAST_PERSONA_STORAGE_KEY, persona.id);
    setStage(mode);
  };
```

- [ ] **Step 4: Record persona on the history entry + reveal name**

In `processInterviewResults`, change the entry construction (lines 73-79) to include the name, and set the display name:
```ts
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        date: Date.now(),
        resume: { ...resumeData },
        transcript: messages,
        feedback: result,
        personaName: currentPersona?.name ?? 'Unknown',
      };
      saveToHistory(entry);
      setDisplayPersonaName(currentPersona?.name ?? null);
```

- [ ] **Step 5: Reveal the right name when viewing history**

In `viewHistoryItem` (lines 95-100), add a line so past interviews reveal their stored persona:
```ts
  const viewHistoryItem = (entry: HistoryEntry) => {
    setResumeData(entry.resume);
    setFeedback(entry.feedback);
    setCurrentTranscript(entry.transcript);
    setDisplayPersonaName(entry.personaName ?? null);
    setStage(AppStage.FEEDBACK);
  };
```

- [ ] **Step 6: Remove the voice-picker UI**

Delete the entire picker block in `renderInterviewMode` (lines 311-325, the `<div className="max-w-md mx-auto mb-12 text-left"> ... </div>` containing the `voice-select` label and `<select>`).

- [ ] **Step 7: Point the start buttons at `startInterview`**

Change line 329 from:
```ts
          onClick={() => setStage(AppStage.INTERVIEWING_VOICE)}
```
to:
```ts
          onClick={() => startInterview(AppStage.INTERVIEWING_VOICE)}
```

Change line 345 from:
```ts
          onClick={() => setStage(AppStage.INTERVIEWING_TEXT)}
```
to:
```ts
          onClick={() => startInterview(AppStage.INTERVIEWING_TEXT)}
```

- [ ] **Step 8: Pass the persona to both interview components**

In the render switch, guard on a selected persona and pass it. Change the `INTERVIEWING_TEXT` case (lines 498-504) to:
```ts
      case AppStage.INTERVIEWING_TEXT: return currentPersona ? (
        <InterviewChat
          resume={resumeData}
          persona={currentPersona}
          onFinish={processInterviewResults}
          onCancel={() => setStage(AppStage.INTERVIEW_MODE)}
        />
      ) : renderInterviewMode();
```

Change the `INTERVIEWING_VOICE` case (lines 505-516) to:
```ts
      case AppStage.INTERVIEWING_VOICE: return currentPersona ? (
        <VoiceInterview
          resume={resumeData}
          persona={currentPersona}
          onFinish={(transcript) => processInterviewResults(transcript.map(t => ({
            role: t.startsWith('Candidate') ? 'user' : 'assistant',
            content: t.split(': ')[1] || '',
            timestamp: Date.now()
          })))}
          onCancel={() => setStage(AppStage.INTERVIEW_MODE)}
        />
      ) : renderInterviewMode();
```

- [ ] **Step 9: Verify build**

Run: `npm run build`
Expected: PASS — no type errors. (`INTERVIEWER_VOICES` and `selectedVoice` are fully removed; `personaName` is now supplied.)

- [ ] **Step 10: Commit**

```bash
git add App.tsx
git commit -m "feat: select hidden persona per interview, remove manual voice picker"
```

---

## Task 9: Reveal the persona on the feedback screen + export

**Files:**
- Modify: `App.tsx` (feedback header ~line 393; export `md` template ~line 115-116)

- [ ] **Step 1: Show the persona in the feedback header**

In `renderFeedback`, immediately after the role/level paragraph (the `<p>` ending at line 394, `Interview report for <strong>{resumeData.role}</strong> ({resumeData.experienceLevel}).</p>`), add:
```tsx
              {displayPersonaName && (
                <p className="text-sm text-gray-500 mt-1">
                  Interviewed by <strong>{displayPersonaName}</strong>
                </p>
              )}
```

- [ ] **Step 2: Add the persona to the Markdown export**

In `exportFeedbackAsMarkdown`, change the date/score line of the `md` template (line 116) from:
```ts
**Date:** ${isoDate} · **Score:** ${feedback.score}/100
```
to:
```ts
**Date:** ${isoDate} · **Score:** ${feedback.score}/100${displayPersonaName ? ` · **Interviewer:** ${displayPersonaName}` : ''}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: reveal interviewer persona on feedback screen and export"
```

---

## Task 10: Confirm evaluator isolation (verification only)

**Files:**
- Read-only: `services/geminiService.ts`, `App.tsx:70`

> **Note:** During Task 4's code review, `services/geminiService.ts` was found to import the (now-removed) `SYSTEM_INSTRUCTION_INTERVIEWER` without using it. That dangling import was removed in a dedicated commit. This task is now a pure confirmation that the evaluator references neither the interviewer prompt nor any persona.

- [ ] **Step 1: Verify the persona never reaches the evaluator**

Run:
```bash
grep -n "generateFeedback" services/geminiService.ts App.tsx
grep -n "persona\|Persona" services/geminiService.ts || echo "GOOD: no persona reference in evaluator"
```
Expected: `generateFeedback(resumeData, messages)` signature unchanged; **no** persona reference in `services/geminiService.ts`. The reveal is cosmetic only.

- [ ] **Step 2: No commit** (nothing changed).

---

## Task 11: Full verification + manual smoke

- [ ] **Step 1: Run the unit suite**

Run: `npm test`
Expected: PASS — all `constants.test.ts` tests.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: PASS — no type errors.

- [ ] **Step 3: Manual smoke (dev server)**

Run: `npm run dev`, then in the browser:
1. Start a **text** interview → confirm the interviewer introduces itself and asks one question at a time, and that finishing yields a feedback screen showing "Interviewed by <persona>".
2. Start a **second** text interview → confirm the revealed persona differs from the first (anti-repeat).
3. Start a **voice** interview → confirm there is no voice picker on the format screen and audio plays in the persona's mapped voice.
4. Open a past interview from history → confirm its stored persona name is revealed.
5. Export Markdown → confirm the `**Interviewer:**` field is present.

- [ ] **Step 4: Final commit (if any manual fixes were needed)**

```bash
git add -A && git commit -m "chore: persona feature manual-smoke fixes"
```

---

## Notes for the implementer

- **Do not touch** `SYSTEM_INSTRUCTION_FEEDBACK` in `constants.ts` or anything in `services/geminiService.ts` beyond reading it — the evaluator stays persona-blind by design.
- **The closing substring `concludes our interview` is load-bearing** (`InterviewChat.tsx:79` string-matches it to auto-end text interviews). Task 4's test guards it; never let a persona override it.
- `.env.local` holds the API key and is gitignored — never stage it.
- Voice mode ends via a manual button (`VoiceInterview.tsx:211 handleFinish`), not the closing string — that's expected.
