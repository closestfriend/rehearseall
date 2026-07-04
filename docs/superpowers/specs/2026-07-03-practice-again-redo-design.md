# "Practice Again" — Redo a Past Interview Setup — Design

**Date:** 2026-07-03
**Status:** Approved (brainstorm) → ready for implementation plan

## Problem

Every interview run starts at `RESUME_UPLOAD`, which resets `resumeData` to blank (`handleStartResume`). Even though a `HistoryEntry` already stores the full `ResumeData` (resume text, role, experience level, JD) for every past session, there's no way to reuse it — practicing the same setup again means retyping everything from scratch.

## Goal

Let a user relaunch a new interview attempt from a specific past session's inputs — same resume, role, experience level, and job description — without retyping them. The setup form still appears (pre-filled, editable) so they can tweak anything before continuing; this is not a form-skipping shortcut.

## Non-goals (explicitly out of scope)

- Skipping the setup form entirely and jumping straight to format choice — considered and rejected; the user wants the chance to tweak before continuing.
- Any change to `types.ts`, `HistoryEntry`, or the `localStorage` schema — the data needed already exists in `ResumeData` per entry.
- Pinning the same interviewer persona across a redo — a redo re-enters the normal `startInterview()` flow, so the existing anti-repeat persona logic applies unchanged (varied practice, not a special case).
- Automated test coverage — `App.tsx` currently has no component-level tests (only `constants.test.ts` for persona/model constants); this will be verified manually via the dev server.

## Design

### Core handler — `App.tsx`

One new handler, alongside `handleStartResume`:

```ts
const startPracticeAgain = (entry?: HistoryEntry) => {
  if (entry) setResumeData(entry.resume);
  setFeedback(null);
  setUploadedFile(null);
  setResumeParseState('idle');
  setExpandedSuggestions(new Set());
  setStage(AppStage.RESUME_UPLOAD);
};
```

- Called **with an `entry`** (from a history card): loads that entry's `resume` into `resumeData`.
- Called **with no argument** (from the feedback screen): `resumeData` is already correct — it's whatever the currently-displayed report reflects, whether just-generated or opened via `viewHistoryItem` — so it's left untouched.
- The rest of the cleanup mirrors `handleStartResume`, so no stale `feedback`/`uploadedFile`/suggestion state leaks into the next attempt.
- Lands on `RESUME_UPLOAD` with every field pre-filled: role, experience level, JD, and resume text. The resume textarea is only `disabled` when `uploadedFile` is set, and redo always clears `uploadedFile`, so it's editable there too.

### UI — two entry points

1. **History card (`renderLanding`, inside the `history.map(...)` block):** add a "Practice Again" action alongside the existing "View Full Report →" line. It must call `e.stopPropagation()` before `startPracticeAgain(entry)`, the same pattern the existing delete button already uses, so it doesn't also trigger the card's `onClick={() => viewHistoryItem(entry)}`.
2. **Feedback screen (`renderFeedback`, action-button row):** add a "Practice Again" button next to "Export as Markdown" and "Back to Dashboard", calling `startPracticeAgain()` with no argument. Appears identically whether the report was just generated or opened from history.

### Edge cases

- **No path to a missing entry:** the feedback-screen button only renders once a report exists; the history-card button only exists on already-rendered cards. No call site can pass an invalid/undefined entry unintentionally.
- **JD whitespace:** `handleResumeSubmit` already trims and blanks out a whitespace-only JD on submit (`jd || undefined`); redo goes through that same submit path, so no new trimming logic is needed.

## Testing

Manual verification via the dev server:
- Redo from a history card → lands on a pre-filled `RESUME_UPLOAD` form with that entry's role/experience/JD/resume text; no stale feedback carries over.
- Redo from the feedback screen (both a freshly-completed report and one opened from history) → same pre-filled behavior, using whatever `resumeData` is currently in state.
- Confirm the history card's delete button and "View Full Report" click still work unaffected (no click-handler bleed-through from the new button).
