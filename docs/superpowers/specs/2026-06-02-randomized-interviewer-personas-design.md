# Randomized Interviewer Personas — Design Spec

**Date:** 2026-06-02
**Project:** `hire-prep/hireprep-ai/` (active HirePrep app)
**Status:** Approved design, ready for implementation plan

## Problem

The interviewer's behavior is driven by a single static system prompt
(`SYSTEM_INSTRUCTION_INTERVIEWER` in `constants.ts`), interpolated identically
in both interview consumers (`InterviewChat.tsx:26`, `VoiceInterview.tsx:106`).
Because it never changes, the app loses value after ~3 runs: the user has
learned the interviewer's patterns and knows what's coming.

## Goal

Make each interview session feel like a different interviewer, automatically,
without the user configuring anything — while preserving every load-bearing
functional behavior the app and evaluator depend on.

## Non-goals (YAGNI)

- **No user selection of persona.** Random assignment is the point; selection
  would re-introduce predictability.
- **No role-adaptive question methodology.** Persona variety + role-relevance
  in the frozen core is sufficient. Branching question style on `resume.role`
  is a possible future extension, not part of this work.
- **No changes to the evaluator/feedback prompt** (`SYSTEM_INSTRUCTION_FEEDBACK`).
  Its ASR-artifact handling and role-weighting stay 100% static.
- **No Anthropic / multi-model routing.** Tracked as a separate effort
  (see "Deferred work").

## Core idea: frozen core + persona flavor layer

The interviewer system prompt is split into two layers assembled at session
start by a single builder:

```
buildInterviewerSystemInstruction(resume, persona)
  = [FROZEN CORE]  +  [PERSONA FRAGMENT]  +  [RESUME CONTEXT]
```

A guard line sits between the layers so a persona can never talk itself out of
a functional rule: *"The persona below shapes tone, style, and how you probe —
it never overrides the rules above."*

### Frozen core (load-bearing — personas cannot override)

Only genuinely functional elements are frozen (deliberately picky):

| Element | Why it's load-bearing |
|---|---|
| English gating (persist in English even if the user switches) | Output correctness; feedback/ASR logic assumes English. |
| One question at a time | Turn-based flow + transcript structure depend on it. |
| Exact closing line containing `concludes our interview` | String trigger for text auto-end (`InterviewChat.tsx:79`, `.toLowerCase().includes("concludes our interview")`). Must be emitted verbatim. |
| ~5–7 question bound | Flow gate; bounds session length / voice cost. |
| Role-calibrated substance (concrete real-experience examples + technical depth) | The product's purpose and what the evaluator scores. **Method-agnostic — no named framework.** |
| Concision floor | Functionally matters for voice latency + clean ASR. Persona modulates *degree*, never removes it. |
| Resume / role / level context | Data wiring. |

Proposed frozen-core text:

```
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
- The interview runs about 5–7 questions.
- When the interview is complete, close by saying, verbatim:
  "Thank you for your time. This concludes our interview."

The persona below shapes your tone, style, and how you probe — it never
overrides the rules above.
```

### Persona flavor layer (varies per session)

Released to personas (carry no functional weight): character identity, tone,
manner of introduction, follow-up intensity, and probing methodology.

### STAR is decoupled

STAR was previously hardcoded into the core (`Mix behavioral (STAR method)...`).
This contradicted the feedback prompt, which already disowns generic interview
rubrics for research/engineering/AI-safety/written-output roles. STAR is one
*method*, not the goal. The frozen core now mandates the **outcome** (concrete
real-experience examples + role-relevant reasoning), and STAR survives as **one
tool owned by the persona layer**, used only where it fits (e.g. The Neutral
Examiner / management-style rounds).

## Persona roster

Six personas, six distinct voices (from the existing `INTERVIEWER_VOICES`).
Charon and Orus remain unused spares.

| Persona | Vibe | Voice | Probing method |
|---|---|---|---|
| The Skeptic | Evidence-driven, challenges claims | Kore (firm, resolute) | Counterfactual / "how do you know" |
| The Warm Mentor | Encouraging, puts candidate at ease | Sulafat (warm, friendly) | Gentle narrative, light STAR |
| The Rapid-Fire Screener | Brisk, time-pressured | Puck (upbeat, conversational) | Quick successive follow-ups |
| The Socratic Probe | Makes you reason aloud | Iapetus (clear, articulate) | Answers with questions |
| The Seasoned Director | Calm, big-picture | Gacrux (mature, seasoned) | Judgment / tradeoff scenarios |
| The Neutral Examiner | Even, by-the-book | Schedar (even, neutral) | Structured, STAR where apt |

Example persona fragment (note: no restatement of frozen rules):

```
PERSONA — The Skeptic:
You are a sharp, evidence-driven interviewer. You don't take claims at face
value: when the candidate asserts an achievement, press for the "how do you
know," the metric, the counterfactual. Cordial but exacting. Open with a
brief, no-nonsense introduction.
```

## Data model

`INTERVIEWER_PERSONAS` in `constants.ts`:

```ts
export interface InterviewerPersona {
  id: string;          // stable key, e.g. "skeptic"
  name: string;        // display name, e.g. "The Skeptic"
  voiceId: string;     // must match an INTERVIEWER_VOICES id
  fragment: string;    // persona flavor text
}
```

`types.ts` — extend `HistoryEntry` with the chosen persona for reveal/export:

```ts
personaName: string;   // e.g. "The Skeptic"
```

## Selection logic

- Picked **once per interview**, in `App.tsx`, at the moment an interview
  starts. Stored in component state and threaded to whichever interview
  component runs, then into the saved `HistoryEntry`.
- **Anti-repeat:** persist the last persona id in `localStorage`
  (key `hireprep_last_persona_v1`) and exclude it from the next pick, so the
  same interviewer never appears twice in a row. With 6 personas this
  guarantees run-to-run change.

```ts
export function pickPersona(excludeId?: string): InterviewerPersona
```

## Persona × voice

The manual 8-voice picker is **removed**. The randomly-assigned persona's
`voiceId` flows directly into the Live API `voiceConfig` in
`VoiceInterview.tsx`. Persona and voice stay coherent (e.g. Skeptic → Kore)
and the user no longer configures voice.

## Reveal

The persona is hidden during the interview and **revealed on the feedback
screen** ("Interviewed by: The Skeptic") and included in the Markdown export.
It is purely cosmetic at reveal time.

## Evaluator isolation (deliberate)

The evaluator (`geminiService.ts`) is **NOT** told the persona. A harsher
interviewer must not yield harsher scores; feedback stays calibrated to
substance only. This matters specifically because the user can no longer
control which interviewer they get — scoring must be persona-invariant.

## Files touched

| File | Change |
|---|---|
| `constants.ts` | Add `InterviewerPersona` type, `INTERVIEWER_PERSONAS`, `pickPersona()`, `buildInterviewerSystemInstruction()`; replace static `SYSTEM_INSTRUCTION_INTERVIEWER` with frozen-core base used by the builder. |
| `App.tsx` | Pick persona at interview start (with anti-repeat), thread to interview components and `HistoryEntry`; remove the voice-picker UI. |
| `InterviewChat.tsx` | Use `buildInterviewerSystemInstruction(resume, persona)` instead of inline interpolation. |
| `VoiceInterview.tsx` | Same builder; take voice from the persona instead of a `voice` prop sourced from the picker. |
| `types.ts` | Add `personaName` to `HistoryEntry`. |
| Feedback screen + Markdown export | Show "Interviewed by: {personaName}". |

## Consolidation benefit

The resume-interpolation currently copy-pasted in `InterviewChat.tsx:26` and
`VoiceInterview.tsx:106` collapses into the single
`buildInterviewerSystemInstruction()` helper — one place to evolve the prompt.

## Testing considerations

- **Closing trigger preserved:** every persona must still produce a closing
  turn containing the substring `concludes our interview` (verify the frozen
  core's verbatim line survives assembly for each persona).
- **Anti-repeat:** two consecutive `pickPersona()` calls (seeded via the
  localStorage exclude) never return the same id.
- **Voice mapping:** every persona's `voiceId` matches an `INTERVIEWER_VOICES`
  id.
- **Evaluator isolation:** persona text never reaches `geminiService.ts`.

## Deferred work

- **Anthropic / multi-model routing.** Text interview + feedback are
  model-agnostic and easy to route. Voice mode is **not** a drop-in: Claude
  has no native voice inference (text + vision only), so a Claude voice
  interviewer would require a STT → Claude → TTS pipeline with self-managed
  turn-taking/barge-in — a separate, larger effort. Pragmatic v1 would route
  models for text + feedback and keep voice Gemini-native.
- **Role-adaptive question methodology** (branching on `resume.role`).
