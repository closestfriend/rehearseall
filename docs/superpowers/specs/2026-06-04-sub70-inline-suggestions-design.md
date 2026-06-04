# Sub-70 Inline Reply Suggestions — Design

**Date:** 2026-06-04
**Status:** Approved (design), pending implementation plan
**Project:** `hire-prep/hireprep-ai/`

> Note: a broader visual/design pass is planned before shipping ("so everything
> doesn't look so templated"). This spec targets a functional, testable first
> cut; final styling will be revisited then.

## Summary

When the evaluator scores an interview **below 70**, the feedback screen's
transcript surfaces **inline coaching** on the user's weakest replies. Each
flagged reply gains a collapsed "Suggested improvement" pill that expands to
show *why the reply fell short* and *a stronger version of the answer*.

This turns the transcript from a passive record into a coaching tool, without
adding any latency to the live interview.

## Goals

- Attach targeted, per-reply coaching to the **weakest few** user replies (cap 3–4).
- Show coaching **only** when overall score < 70.
- Each suggestion contains both a short **critique** and a concrete **model answer**.
- Annotations are **collapsed by default**, expand on tap.
- No impact on the live conversation; work folds into the existing post-interview
  "Analyzing" phase.
- Backward compatible with existing saved history.

## Non-Goals

- Annotating every reply, or replies in interviews scoring ≥ 70.
- Editing/replaying the interview from a suggestion.
- Carrying suggestions into the Markdown export (intentionally UI-only for now).
- The broader visual redesign (separate, later pass).

## Approach

Single evaluator call, extended schema, **index-based** reply references
(chosen over verbatim text-matching, which is fragile against ASR noise, and
over a second AI call, which doubles latency/cost for no benefit).

The existing `generateFeedback` call already runs behind the "Analyzing"
spinner in `processInterviewResults` (`AppStage.FEEDBACK`). Suggestions ride
along in that same single round-trip. The only real-world effect is marginally
longer generation on sub-70 runs (more output tokens); score ≥ 70 returns no
suggestions and is identical to today. Ample headroom under the existing
`maxOutputTokens: 16384`.

## Data Model (`types.ts`)

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

`suggestions` is optional, so every existing `HistoryEntry` in localStorage
stays valid and renders no annotations. New sessions persist suggestions
automatically — the whole feedback object is already saved to history.

## Evaluator (`geminiService.ts` + `constants.ts`)

**Schema** — extend `responseSchema.properties` with an optional array
(NOT added to `required`, so the model can omit it for score ≥ 70):

```ts
suggestions: {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      replyIndex:  { type: Type.NUMBER },
      critique:    { type: Type.STRING },
      modelAnswer: { type: Type.STRING },
    },
    required: ["replyIndex", "critique", "modelAnswer"],
  },
}
```

**Transcript labeling** — today the prompt joins turns as
`${role.toUpperCase()}: ${content}`. Change so **user turns are explicitly
numbered** with a 0-based index, e.g.:

```
INTERVIEWER: Tell me about a hard tradeoff you made…
USER REPLY #0: Um, I just picked the faster one.
INTERVIEWER: …
USER REPLY #1: …
```

Assistant/interviewer turns keep a non-indexed label. The model copies the
printed index rather than counting, and the UI computes the identical 0-based
user-turn index — so `replyIndex` maps deterministically to the right bubble.

Extract this labeling into a small exported pure helper (e.g.
`formatTranscriptForEvaluator(transcript): string`) so the index contract is
unit-testable rather than buried inline in the `generateContent` call.

**Prompt instruction** (added to `SYSTEM_INSTRUCTION_FEEDBACK`):

> If, and only if, the overall score is below 70, identify the 3–4 user replies
> that most hurt the result. For each, provide a one-to-two-sentence `critique`
> and a stronger `modelAnswer` calibrated to the target role, referencing the
> reply by its printed `USER REPLY #n` index. If the score is 70 or above,
> return no suggestions. Apply the same ASR-artifact awareness used elsewhere —
> never coach against suspected transcription noise.

The weakest-few cap (3–4) and the < 70 gate both live in this instruction.

## UI (`App.tsx`, transcript block)

Builds on the existing chat-bubble transcript. Only **user** bubbles can carry
a suggestion.

**Index matching** — before the transcript `.map`, precompute:

```ts
let uCount = -1;
const userIndexByMessage = currentTranscript.map(m => m.role === 'user' ? ++uCount : -1);
const suggestionByUserIndex = new Map((feedback?.suggestions ?? []).map(s => [s.replyIndex, s]));
```

This is the same 0-based count the evaluator labeled, so lookup is
deterministic. Empty map (old history, or score ≥ 70) → nothing renders. The
gate is implicit and backward compatible.

**Annotation** — when a user bubble has a matching suggestion, beneath it
(right-aligned, under the blue bubble) render a subtle amber pill:
**✨ Suggested improvement ▾**. Clicking expands a coaching card with two parts,
reusing the existing amber "Areas to Improve" color language:

- **Why this fell short** → `critique` (muted text)
- **Stronger answer** → `modelAnswer` (emphasized, in its own white inset)

The chevron rotates on expand; the card fades in via the existing
`animate-msg-in` keyframe (added in the transcript-polish change). Collapsed by
default.

**State** — a `Set<number>` of expanded reply indices in `App`, with a
`toggleSuggestion(idx)` handler. Reset it in `handleStartResume`,
`viewHistoryItem`, and `processInterviewResults` so expansions never carry
across sessions.

**Accessibility** — the pill is a real `<button>` with `aria-expanded`.

## Data Flow

1. Interview ends → `processInterviewResults(messages)` → `AppStage.FEEDBACK`,
   spinner shown.
2. `generateFeedback(resume, transcript)` — single evaluator call. Prompt
   numbers user turns; schema permits `suggestions`.
3. Model returns `{score, strengths, improvements, detailedAnalysis,
   suggestions?}`. Suggestions present only if score < 70.
4. Feedback object set in state and saved to history (`HistoryEntry`).
5. `renderFeedback` builds `userIndexByMessage` + `suggestionByUserIndex`,
   renders pills under matched user bubbles; expansion driven by local Set state.

## Error Handling

- **Missing/empty `suggestions`** — normal for score ≥ 70 and for old history;
  UI renders no pills. No special-casing needed beyond the optional field.
- **Out-of-range `replyIndex`** (model error) — lookup simply doesn't match any
  bubble; that suggestion is silently dropped. No crash, no misattachment.
- **Parse/empty-response failures** — unchanged; the existing evaluator
  error-surfacing (finishReason + preview) and the Retry button still apply.

## Testing

- `constants.test.ts` already exists (Vitest configured). Add unit coverage for
  the extracted `formatTranscriptForEvaluator` helper (user turns numbered
  0..n, interviewer turns unlabeled) so the prompt index contract is pinned.
- Manual: run a deliberately weak interview, confirm score < 70 yields pills on
  the weakest replies, each expanding to critique + model answer; confirm a
  strong interview (≥ 70) shows none; confirm an old history entry shows none.

## Backward Compatibility

- `suggestions` optional → existing localStorage `HistoryEntry` records load and
  render unchanged.
- Markdown export untouched (suggestions are intentionally UI-only).
- No change to the live interview paths (voice/text).
