# Sub-70 Inline Reply Suggestions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the evaluator scores an interview below 70, surface inline coaching (critique + model answer) on the weakest user replies in the feedback transcript and in the Markdown export.

**Architecture:** The existing single evaluator call gains an optional `suggestions` array (index-based references to user turns). Two pure helpers — one to number user turns for the prompt, one to map suggestions back onto messages — keep the index contract testable and shared between the UI and the export. The feedback UI renders collapsed amber pills under flagged user bubbles; the export interleaves the same suggestions as blockquotes.

**Tech Stack:** React 19 + TypeScript, Vite, `@google/genai` (Gemini structured output), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-04-sub70-inline-suggestions-design.md`

---

## File Structure

- **Create** `types.ts` additions — `ReplySuggestion` interface, optional `suggestions` on `InterviewFeedback`.
- **Create** `lib/transcriptFormat.ts` — `formatTranscriptForEvaluator(transcript)`: numbers user turns for the evaluator prompt.
- **Create** `lib/transcriptFormat.test.ts` — unit tests for the above.
- **Create** `lib/replySuggestions.ts` — `mapSuggestionsToMessages(transcript, suggestions)` and `buildTranscriptMarkdown(transcript, suggestions)`: shared by UI and export.
- **Create** `lib/replySuggestions.test.ts` — unit tests for both helpers.
- **Modify** `constants.ts` — append the conditional-suggestions instruction to `SYSTEM_INSTRUCTION_FEEDBACK`.
- **Modify** `constants.test.ts` — assert the new instruction's gate + index language.
- **Modify** `services/geminiService.ts` — use `formatTranscriptForEvaluator`; extend `responseSchema` with `suggestions`.
- **Modify** `App.tsx` — expand-state + reset, render pills in the transcript, wire `buildTranscriptMarkdown` into the export.

---

### Task 1: Data model

**Files:**
- Modify: `types.ts` (after `InterviewFeedback`, currently lines 14-19)

- [ ] **Step 1: Add the interface and optional field**

Replace this block in `types.ts`:

```ts
export interface InterviewFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
  detailedAnalysis: string;
}
```

with:

```ts
export interface ReplySuggestion {
  replyIndex: number;   // 0-based index over USER replies only, in order
  critique: string;     // what was weak — one or two sentences
  modelAnswer: string;  // a stronger version of the reply
}

export interface InterviewFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
  detailedAnalysis: string;
  suggestions?: ReplySuggestion[];   // present only when score < 70; may be empty
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: add ReplySuggestion type and optional feedback.suggestions"
```

---

### Task 2: Transcript-formatting helper (numbers user turns)

**Files:**
- Create: `lib/transcriptFormat.ts`
- Test: `lib/transcriptFormat.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/transcriptFormat.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatTranscriptForEvaluator } from './transcriptFormat';
import type { InterviewMessage } from '../types';

const msg = (role: 'user' | 'assistant', content: string): InterviewMessage => ({ role, content, timestamp: 0 });

describe('formatTranscriptForEvaluator', () => {
  it('numbers user replies 0-based and labels interviewer turns', () => {
    const out = formatTranscriptForEvaluator([
      msg('assistant', 'Q1'),
      msg('user', 'A1'),
      msg('assistant', 'Q2'),
      msg('user', 'A2'),
    ]);
    expect(out).toBe('INTERVIEWER: Q1\nUSER REPLY #0: A1\nINTERVIEWER: Q2\nUSER REPLY #1: A2');
  });

  it('counts only user turns for the index', () => {
    const out = formatTranscriptForEvaluator([
      msg('user', 'First'),
      msg('user', 'Second'),
    ]);
    expect(out).toBe('USER REPLY #0: First\nUSER REPLY #1: Second');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/transcriptFormat.test.ts`
Expected: FAIL — cannot resolve `./transcriptFormat` / `formatTranscriptForEvaluator` is not a function.

- [ ] **Step 3: Write minimal implementation**

Create `lib/transcriptFormat.ts`:

```ts
import type { InterviewMessage } from '../types';

/**
 * Render the transcript for the evaluator with USER turns explicitly numbered
 * (0-based, counting only user replies) so the model can reference a reply by
 * its printed `USER REPLY #n` index. Interviewer turns are labeled, not numbered.
 */
export function formatTranscriptForEvaluator(transcript: InterviewMessage[]): string {
  let userTurn = -1;
  return transcript
    .map(m => {
      if (m.role === 'user') {
        userTurn += 1;
        return `USER REPLY #${userTurn}: ${m.content}`;
      }
      return `INTERVIEWER: ${m.content}`;
    })
    .join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/transcriptFormat.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/transcriptFormat.ts lib/transcriptFormat.test.ts
git commit -m "feat: add formatTranscriptForEvaluator with numbered user turns"
```

---

### Task 3: Evaluator prompt instruction (conditional suggestions)

**Files:**
- Modify: `constants.ts` (`SYSTEM_INSTRUCTION_FEEDBACK`, ends around line 79)
- Test: `constants.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `constants.test.ts`:

```ts
import { SYSTEM_INSTRUCTION_FEEDBACK } from './constants';

describe('SYSTEM_INSTRUCTION_FEEDBACK', () => {
  it('gates inline suggestions on a sub-70 score', () => {
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('below 70');
  });

  it('references replies by their printed USER REPLY index', () => {
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('replyIndex');
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('USER REPLY');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run constants.test.ts`
Expected: FAIL — the two new `SYSTEM_INSTRUCTION_FEEDBACK` assertions fail (existing tests still pass).

- [ ] **Step 3: Add the instruction**

In `constants.ts`, replace the tail of `SYSTEM_INSTRUCTION_FEEDBACK`:

```ts
3. Specific areas for improvement — only those genuinely relevant to the job.
4. A detailed qualitative analysis weighing technical depth and role-relevant judgment.
`;
```

with:

```ts
3. Specific areas for improvement — only those genuinely relevant to the job.
4. A detailed qualitative analysis weighing technical depth and role-relevant judgment.
5. INLINE REPLY SUGGESTIONS (conditional):
   If, and ONLY if, the overall score is below 70, identify the 3-4 user replies
   that most hurt the result. For each, add an object to "suggestions" with:
   - "replyIndex": the integer N copied from the matching "USER REPLY #N" line,
   - "critique": one or two sentences on what was weak,
   - "modelAnswer": a stronger version of that reply, calibrated to the target role.
   If the score is 70 or above, return an empty "suggestions" array.
   Apply the same ASR-artifact awareness: never coach against suspected
   transcription noise.
`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run constants.test.ts`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add constants.ts constants.test.ts
git commit -m "feat: instruct evaluator to emit sub-70 reply suggestions"
```

---

### Task 4: Evaluator schema + prompt wiring

**Files:**
- Modify: `services/geminiService.ts`

- [ ] **Step 1: Import the helper**

In `services/geminiService.ts`, below the existing imports (after line 4), add (note the `../lib/` path — `geminiService.ts` lives in `services/`, the helper in `lib/`):

```ts
import { formatTranscriptForEvaluator } from "../lib/transcriptFormat";
```

- [ ] **Step 2: Use the helper for the transcript string**

Replace:

```ts
    const chatTranscript = transcript.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
```

with:

```ts
    const chatTranscript = formatTranscriptForEvaluator(transcript);
```

- [ ] **Step 3: Extend the response schema**

Replace:

```ts
            detailedAnalysis: { type: Type.STRING }
          },
          required: ["score", "strengths", "improvements", "detailedAnalysis"]
```

with:

```ts
            detailedAnalysis: { type: Type.STRING },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  replyIndex: { type: Type.NUMBER },
                  critique: { type: Type.STRING },
                  modelAnswer: { type: Type.STRING }
                },
                required: ["replyIndex", "critique", "modelAnswer"]
              }
            }
          },
          required: ["score", "strengths", "improvements", "detailedAnalysis"]
```

(`suggestions` is intentionally NOT added to `required`, so the model may omit it when score ≥ 70.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add services/geminiService.ts
git commit -m "feat: wire numbered transcript and suggestions schema into evaluator"
```

---

### Task 5: Suggestion-mapping + markdown helpers

**Files:**
- Create: `lib/replySuggestions.ts`
- Test: `lib/replySuggestions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/replySuggestions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapSuggestionsToMessages, buildTranscriptMarkdown } from './replySuggestions';
import type { InterviewMessage, ReplySuggestion } from '../types';

const msg = (role: 'user' | 'assistant', content: string): InterviewMessage => ({ role, content, timestamp: 0 });
const sug = (replyIndex: number): ReplySuggestion => ({ replyIndex, critique: `c${replyIndex}`, modelAnswer: `m${replyIndex}` });

describe('mapSuggestionsToMessages', () => {
  it('attaches a suggestion to the matching user turn, not message index', () => {
    const transcript = [msg('assistant', 'Q1'), msg('user', 'A1'), msg('assistant', 'Q2'), msg('user', 'A2')];
    const out = mapSuggestionsToMessages(transcript, [sug(1)]);
    expect(out[0]).toBeNull();      // interviewer
    expect(out[1]).toBeNull();      // user turn 0 — no suggestion
    expect(out[2]).toBeNull();      // interviewer
    expect(out[3]).toEqual(sug(1)); // user turn 1 — matched
  });

  it('returns all null when suggestions is undefined', () => {
    expect(mapSuggestionsToMessages([msg('user', 'A1')], undefined)).toEqual([null]);
  });

  it('drops out-of-range replyIndex without throwing', () => {
    expect(mapSuggestionsToMessages([msg('user', 'A1')], [sug(5)])).toEqual([null]);
  });
});

describe('buildTranscriptMarkdown', () => {
  it('interleaves a suggestion blockquote after the coached reply', () => {
    const transcript = [msg('assistant', 'Q1'), msg('user', 'A1')];
    const md = buildTranscriptMarkdown(transcript, [sug(0)]);
    expect(md).toBe(
      '**Interviewer:** Q1\n\n' +
      '**You:** A1\n\n' +
      '> **💡 Suggested improvement**\n' +
      '> **Why this fell short:** c0\n' +
      '> **Stronger answer:** m0'
    );
  });

  it('matches the plain format when there are no suggestions', () => {
    const transcript = [msg('assistant', 'Q1'), msg('user', 'A1')];
    expect(buildTranscriptMarkdown(transcript, undefined)).toBe('**Interviewer:** Q1\n\n**You:** A1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/replySuggestions.test.ts`
Expected: FAIL — cannot resolve `./replySuggestions`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/replySuggestions.ts`:

```ts
import type { InterviewMessage, ReplySuggestion } from '../types';

/**
 * Align suggestions to transcript messages. Returns an array the same length as
 * `transcript`; each entry is the ReplySuggestion whose `replyIndex` matches
 * that message's 0-based user-turn position, or null. Non-user messages and
 * out-of-range indices yield null (out-of-range suggestions are dropped).
 */
export function mapSuggestionsToMessages(
  transcript: InterviewMessage[],
  suggestions: ReplySuggestion[] | undefined,
): (ReplySuggestion | null)[] {
  const byIndex = new Map<number, ReplySuggestion>();
  (suggestions ?? []).forEach(s => byIndex.set(s.replyIndex, s));
  let userTurn = -1;
  return transcript.map(m => {
    if (m.role !== 'user') return null;
    userTurn += 1;
    return byIndex.get(userTurn) ?? null;
  });
}

/**
 * Build the Markdown transcript section, interleaving each suggestion as a
 * blockquote after the reply it coaches.
 */
export function buildTranscriptMarkdown(
  transcript: InterviewMessage[],
  suggestions: ReplySuggestion[] | undefined,
): string {
  const matched = mapSuggestionsToMessages(transcript, suggestions);
  return transcript
    .map((m, i) => {
      const speaker = m.role === 'user' ? '**You:**' : '**Interviewer:**';
      let block = `${speaker} ${m.content}`;
      const s = matched[i];
      if (s) {
        block +=
          `\n\n> **💡 Suggested improvement**\n` +
          `> **Why this fell short:** ${s.critique}\n` +
          `> **Stronger answer:** ${s.modelAnswer}`;
      }
      return block;
    })
    .join('\n\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/replySuggestions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/replySuggestions.ts lib/replySuggestions.test.ts
git commit -m "feat: add suggestion-to-message mapping and markdown helpers"
```

---

### Task 6: Feedback UI — expandable pills

**Files:**
- Modify: `App.tsx` (imports, state at line 27, `handleStartResume`, `processInterviewResults`, `viewHistoryItem`, `renderFeedback` head at line 456, transcript map)

- [ ] **Step 1: Import the mapping helper**

In `App.tsx`, add to the imports near the top (after the `geminiService` import on line 7):

```ts
import { mapSuggestionsToMessages, buildTranscriptMarkdown } from './lib/replySuggestions';
```

- [ ] **Step 2: Add expand state**

After line 27 (`const [displayPersonaName, setDisplayPersonaName] = useState<string | null>(null);`) add:

```ts
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<number>>(new Set());

  const toggleSuggestion = (idx: number) => {
    setExpandedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };
```

- [ ] **Step 3: Reset expand state on the three entry points**

In `handleStartResume`, replace:

```ts
    setResumeParseState('idle');
    setStage(AppStage.RESUME_UPLOAD);
```

with:

```ts
    setResumeParseState('idle');
    setExpandedSuggestions(new Set());
    setStage(AppStage.RESUME_UPLOAD);
```

In `processInterviewResults`, replace:

```ts
    setStage(AppStage.FEEDBACK);
    setCurrentTranscript(messages);
```

with:

```ts
    setStage(AppStage.FEEDBACK);
    setCurrentTranscript(messages);
    setExpandedSuggestions(new Set());
```

In `viewHistoryItem`, replace:

```ts
    setDisplayPersonaName(entry.personaName ?? null);
    setStage(AppStage.FEEDBACK);
```

with:

```ts
    setDisplayPersonaName(entry.personaName ?? null);
    setExpandedSuggestions(new Set());
    setStage(AppStage.FEEDBACK);
```

- [ ] **Step 4: Convert `renderFeedback` to a block body that precomputes the mapping**

Replace line 456:

```ts
  const renderFeedback = () => (
```

with:

```ts
  const renderFeedback = () => {
    const suggestionByMessage = mapSuggestionsToMessages(currentTranscript, feedback?.suggestions);
    return (
```

Then replace the closing of `renderFeedback` (line 614):

```ts
    </div>
  );

  const getStageContent = () => {
```

with:

```ts
    </div>
    );
  };

  const getStageContent = () => {
```

- [ ] **Step 5: Render the pill under flagged user bubbles**

In the transcript map, replace the message column block:

```tsx
                      <div className={`flex flex-col max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
                        <span className="text-[11px] font-semibold text-gray-400 mb-1 px-1">{speakerName}</span>
                        <div className={`px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          isUser
                            ? 'bg-blue-600 text-white rounded-2xl rounded-br-md shadow-blue-600/15'
                            : 'bg-white text-gray-700 border border-gray-100 rounded-2xl rounded-bl-md'
                        }`}>
                          {m.content}
                        </div>
                      </div>
```

with:

```tsx
                      <div className={`flex flex-col max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
                        <span className="text-[11px] font-semibold text-gray-400 mb-1 px-1">{speakerName}</span>
                        <div className={`px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          isUser
                            ? 'bg-blue-600 text-white rounded-2xl rounded-br-md shadow-blue-600/15'
                            : 'bg-white text-gray-700 border border-gray-100 rounded-2xl rounded-bl-md'
                        }`}>
                          {m.content}
                        </div>
                        {isUser && suggestionByMessage[i] && (
                          <div className="mt-2 w-full flex flex-col items-end">
                            <button
                              type="button"
                              onClick={() => toggleSuggestion(i)}
                              aria-expanded={expandedSuggestions.has(i)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                              </svg>
                              Suggested improvement
                              <svg className={`w-3.5 h-3.5 transition-transform ${expandedSuggestions.has(i) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {expandedSuggestions.has(i) && (
                              <div className="mt-2 w-full text-left bg-amber-50/60 border border-amber-100 rounded-2xl p-4 animate-msg-in">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-1">Why this fell short</p>
                                <p className="text-sm text-gray-600 mb-3">{suggestionByMessage[i]!.critique}</p>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-1">Stronger answer</p>
                                <p className="text-sm text-gray-800 bg-white border border-amber-100 rounded-xl p-3 leading-relaxed">{suggestionByMessage[i]!.modelAnswer}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add App.tsx
git commit -m "feat: render expandable sub-70 suggestion pills in transcript"
```

---

### Task 7: Export — interleave suggestions

**Files:**
- Modify: `App.tsx` (`exportFeedbackAsMarkdown`, transcript build around line 158)

- [ ] **Step 1: Use the shared markdown builder**

In `exportFeedbackAsMarkdown`, replace:

```ts
    const transcriptMd = currentTranscript.map(m => {
      const speaker = m.role === 'user' ? '**You:**' : '**Interviewer:**';
      return `${speaker} ${m.content}`;
    }).join('\n\n');
```

with:

```ts
    const transcriptMd = buildTranscriptMarkdown(currentTranscript, feedback.suggestions);
```

(`feedback` is guaranteed non-null here by the `if (!feedback) return;` guard at the top of the function. `buildTranscriptMarkdown` was already imported in Task 6.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Full test + manual verification**

Run: `npx vitest run`
Expected: PASS (all suites).

Manual (dev server already runs on `http://localhost:3000`):
- Run a deliberately weak interview → score < 70 → amber "Suggested improvement" pills appear under the weakest user replies; clicking expands critique + stronger answer; chevron rotates.
- Run a strong interview (≥ 70) → no pills.
- Open an old history entry → no pills (and no crash).
- Export a sub-70 report → each suggestion appears as a blockquote after the correct reply.
- Export a ≥ 70 report → transcript section unchanged from before.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: include inline suggestions in markdown export"
```

---

## Self-Review Notes

- **Spec coverage:** data model (T1), evaluator prompt (T3) + schema/wiring (T4), index contract helper (T2) + mapping helper (T5), UI pills (T6), export (T7), tests for both pure helpers and the prompt instruction. All spec sections map to a task.
- **Index contract:** `formatTranscriptForEvaluator` (prompt side) and `mapSuggestionsToMessages` (UI/export side) both count only `role === 'user'` turns, 0-based — same contract on both ends.
- **Naming consistency:** `mapSuggestionsToMessages`, `buildTranscriptMarkdown`, `formatTranscriptForEvaluator`, `toggleSuggestion`, `expandedSuggestions` used identically across tasks.
- **Backward compatibility:** `suggestions` optional; empty/absent → empty map → no pills, plain export. Old history entries unaffected.
- **Untestable-by-unit surfaces** (geminiService network call, React component, DOM download) are covered by `tsc` + the manual checklist; all new pure logic is unit-tested.
