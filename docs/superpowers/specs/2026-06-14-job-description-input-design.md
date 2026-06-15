# Optional Job Description Input — Design

**Date:** 2026-06-14
**Status:** Approved (brainstorm) → ready for implementation plan

## Problem

The interview is currently calibrated to a free-text **Target Job Role** (e.g. "Senior Frontend Engineer") plus an experience level. That's a thin signal — the interviewer and the evaluator have to guess what the role actually entails. Users often have the real job description in hand and want the interview tailored to *that specific posting*, not just a title.

## Goal

Let a user paste a full job description (JD) during setup. When present, the JD sharpens both the interviewer's questions and the evaluator's scoring. When absent, behavior is exactly as today.

## Non-goals (explicitly out of scope)

- **Pasting a job-listing URL** (the "option B" idea). This is a client-only Vite app; fetching arbitrary listing URLs hits CORS and JS-rendered/anti-scraped pages, and would require a Vercel serverless proxy + brittle per-site extraction. Whatever it scraped would become JD text feeding *this* same pathway — so URL fetch is a future add-on that pre-fills this box, not part of this work.
- Character caps, JD parsing/summarization, or auto-deriving the Target Job Role from the JD.
- Any change to the existing required fields' behavior.

## Design

### Data model — `types.ts`

Add one optional field to `ResumeData`:

```ts
export interface ResumeData {
  text: string;
  role: string;
  experienceLevel: string;
  jobDescription?: string;   // NEW — optional; pasted job posting
}
```

Optional means existing callers and any persisted `HistoryEntry.resume` remain valid. Because the JD lives inside `ResumeData`, it auto-persists into history with no further work.

### UI — `App.tsx` setup form

Add an optional `<textarea>` between **Experience Level** and **Resume Content**:

- Label: "Job Description (optional)"
- Placeholder: "Paste the full job description to tailor the interview…"
- Backed by a new `jobDescription` state value.
- On submit, the value is whitespace-trimmed; an empty result is stored as `undefined` (not `""`), so downstream "is it present?" checks are a simple truthiness test.
- Styling mirrors the existing Resume textarea so the form stays visually consistent (no design pass here — consistent with the pending de-templatizing pass being deferred).

### Prompt wiring — where the JD earns its keep

**Interviewer** — `buildInterviewerSystemInstruction(resume, persona)` in `constants.ts`:

- When `resume.jobDescription` is non-empty, append a trailing block:

  ```
  Job Description (tailor your questions to this):
  <jobDescription text>
  ```

- When empty/absent, append nothing — the literal string "Job Description" must not appear in the instruction.
- Both interview modes (`InterviewChat.tsx`, `VoiceInterview.tsx`) call this one builder, so they pick up the JD automatically — no per-mode changes.

**Evaluator** — `generateFeedback(resume, transcript)` in `services/geminiService.ts`:

- When the JD is present, add a `JOB DESCRIPTION:` line to the evaluator's user-prompt block (alongside the existing `RESUME / TARGET ROLE / EXPERIENCE` lines). Omit the line entirely when absent.
- Add one sentence to `SYSTEM_INSTRUCTION_FEEDBACK` in `constants.ts`: if a job description is provided, weight role-fit against its specific requirements rather than the role title alone.

### Data flow

```
Setup form (App.tsx)
  → ResumeData { text, role, experienceLevel, jobDescription? }
      → buildInterviewerSystemInstruction()  → InterviewChat + VoiceInterview  (questions tailored)
      → generateFeedback()                    → evaluator                       (scoring calibrated)
      → HistoryEntry.resume                                                     (persists automatically)
```

### Error handling

None of substance. The JD is an optional local text field — no network, no parsing, no failure modes. Empty or whitespace-only input is treated as "not provided."

## Testing (TDD)

Extend `constants.test.ts` for `buildInterviewerSystemInstruction`:

- **JD present:** the returned instruction contains the JD block and the JD text.
- **JD absent:** the returned instruction does **not** contain the string "Job Description".

If the evaluator prompt assembly is unit-testable without a live API call, add an equivalent present/absent assertion for the `generateFeedback` prompt block; otherwise verify it manually by running an interview with a pasted JD and confirming the scored feedback references the posting.

## Acceptance

- Setup form shows an optional JD textarea; leaving it blank produces today's exact behavior.
- With a JD pasted, the interviewer's questions reflect the posting (text and voice), and the feedback scoring references the posting's requirements.
- JD round-trips into interview history.
- New unit tests pass; existing tests unaffected.
