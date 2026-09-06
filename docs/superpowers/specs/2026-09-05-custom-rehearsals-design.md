# Custom Rehearsals Design

**Date:** 2026-09-05
**Status:** Approved by Hunter on 2026-09-05

## Goal

Add a reusable Custom Rehearsals library to RehearseAll and seed it with all
43 formats visible in Hunter's an assessment provider screenshots. The collection must be
useful for repeated practice without claiming to reproduce confidential or
official an assessment provider questions.

## Product boundary

The screenshots identify names, durations, and question counts; they do not
disclose question content. Every seeded rehearsal is therefore an independent,
Practice approximation based on the title, public format descriptions, and
ordinary domain conventions. The interface must say that clearly.

Public grounding:

- an assessment provider's candidate documentation says AI interviews can be technical,
  experience-based, or language/reasoning focused; some include a whiteboard
  and some require screen sharing.
- an assessment provider's assessment documentation describes fixed completion requirements
  and split-screen assessment instructions.
- an assessment provider's Monty engineering article describes a streaming voice interviewer
  with turn detection and domain-expert interviewing as a common format.

References:

- https://talent.docs.mercor.com/support/ai-interview
- https://talent.docs.mercor.com/how-to/assessments
- https://www.mercor.com/blog/monty-engineering-deep-dive/

## Experience architecture

The feature has one library and two execution engines:

1. **Adaptive interviews** use RehearseAll's existing text or Gemini Live voice
   session. A preset supplies competencies, an opening direction, a follow-up
   policy, and a preset-specific evaluation rubric. Relevant presets offer
   browser screen sharing to the live interviewer at no more than one frame per
   second.
2. **Structured assessments** request a fresh question deck from the server,
   present it one item at a time, retain answers while moving backward and
   forward, and send the completed deck to a dedicated evaluator. Long source
   assessments default to an eight-question practice cut; presets with eight or
   fewer questions use their listed count.

Existing open-conversation and resume-driven interview flows remain unchanged.
History and debriefs accept the new rehearsal setup so a preset can be repeated.

## Navigation and flow

The landing page gains a distinct `Browse rehearsals` action. It opens a dense
library rather than another setup form.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ REHEARSE_ALL                 Search __________________   Back home    │
├────────────────┬────────────────────────────┬────────────────────────┤
│ FORMAT         │ REHEARSALS                 │ SELECTED REHEARSAL     │
│ All            │ AI Fluency Interview 24m   │ AI Fluency Interview  │
│ Interview      │ AI Proficiency ...    21m  │ adaptive interview     │
│ Assessment     │ Algorithms ...        27m  │ what it tests          │
│                │ ...                        │ how this rep works      │
│ DOMAIN         │                            │ your context [........]│
│ AI + evaluation│                            │ Start rehearsal        │
└────────────────┴────────────────────────────┴────────────────────────┘
```

On narrow screens the filter becomes a horizontal control, the list occupies
the page, and selecting a row opens the detail as a full-width sheet.

Interview flow:

```text
Library → preset detail/context → voice or text → adaptive session → debrief
```

Assessment flow:

```text
Library → preset detail/context → generate deck → answer items → evaluate → debrief
```

## Visual direction

The memorable element is a **rehearsal call sheet**: a compact, sortable roster
with one persistent detail column. Rows encode real information through rhythm,
duration, format, and status. This deliberately avoids a grid of interchangeable
rounded cards.

The feature inherits each existing outfit instead of introducing a third brand:

| Token | Personal Best | Transcript |
|---|---|---|
| Canvas | `#101208` | `#e9e6dc` |
| Surface | `#171a0d` | `#fbfaf6` |
| Primary ink | `#f2f4e4` | `#1c1b18` |
| Secondary ink | `#a9ad91` | `#6d685c` |
| Signal | `#d4f222` | `#b3402a` |
| Rule | `#3a3e24` | `#b9b4a5` |

Typography stays Space Grotesk for Personal Best and IBM Plex Mono for
Transcript. Copy is sentence case in the library even where the surrounding
outfit uses uppercase display copy. Motion is reserved for opening/closing the
mobile detail sheet and the active progress indicator.

Design self-review: the first sketch risked becoming a generic filter-and-card
SaaS gallery. It was revised into a three-column call sheet with full-width rows,
one selected record, and no decorative cards. That structure belongs to a tool
for repeatedly selecting and running exercises.

## Preset contract

Each preset supplies:

- stable id and exact screenshot title;
- collection and domain category;
- `interview` or `assessment` format;
- listed duration or listed question count;
- default practice question count;
- plain-language description and instructions;
- three to five competencies;
- interviewer follow-up guidance or assessment construction guidance;
- evaluation criteria;
- whether screen sharing is useful;
- source-confidence label (`title-only` for this collection).

The user's optional context is kept separate from the preset definition and is
passed to the server only for that run.

## Catalog

### General and communication

| Title | Format | Listed size | Practice emphasis |
|---|---|---:|---|
| Hobbyist Interview | Interview | 13 min | depth, vocabulary, sustained personal practice |
| Personal Introduction | Interview | 9 min | concise narrative, evidence, current direction |
| Situational Interview | Interview | 18 min | judgment, ownership, conflict, ambiguity |
| Domain Expert Interview | Interview | 14 min | genuine depth and precise follow-up |
| Brief Introduction | Interview | 4 min | a compact, credible introduction |
| Brainstorming Session | Interview | 16 min | idea range, selection, development |
| General Assessment | Assessment | 12 questions | mixed comprehension, reasoning, communication |
| Task Review Exercise | Interview | 19 min | critique, prioritization, actionable revision |
| TESt | Assessment | 1 question | unclassified single-item dry run |

### Software and systems

| Title | Format | Listed size | Practice emphasis |
|---|---|---:|---|
| Office.js Proficiency Test | Assessment | 2 questions | Office.js APIs and practical automation |
| Quant Screen | Interview | 48 min | quantitative reasoning and communication |
| Software Mastery Interview | Interview | 41 min | language/tool depth and debugging judgment |
| System Design Session | Interview | 35 min | requirements, architecture, tradeoffs, failure modes |
| Code Review Session | Interview | 25 min | correctness, maintainability, risk, review communication |
| Software Engineering Demo | Interview | 107 min | screen-led project walkthrough and implementation depth |
| Algorithms Interview | Interview | 27 min | decomposition, complexity, alternatives, edge cases |
| Cybersecurity Interview | Interview | 36 min | threat modeling, controls, incident judgment |
| Technical Screen | Interview | 18 min | concise technical depth and problem solving |
| Niche Programming Session | Interview | 23 min | specialized language or framework fluency |
| Robotics Engineering | Assessment | 5 questions | sensing, controls, integration, safety |

### Data, math, and reasoning

| Title | Format | Listed size | Practice emphasis |
|---|---|---:|---|
| Math Contest | Interview | 28 min | mathematical reasoning aloud |
| Olympiad Problem | Interview | 27 min | proof strategy and rigorous derivation |
| Reasoning Style Assessment | Assessment | 22 questions | analytical, verbal, and decision reasoning |
| Data Science Interview | Interview | 30 min | framing, data quality, modeling, evaluation |
| Data Annotation Test | Assessment | 25 questions | guideline application and edge-case consistency |
| Frontier AI: Pattern & Puzzle Eval | Assessment | cognitive | pattern induction and constraint reasoning |
| STEM Skills Challenge | Assessment | 5 questions | mixed quantitative and scientific reasoning |

### AI and evaluation

| Title | Format | Listed size | Practice emphasis |
|---|---|---:|---|
| AI Fluency Interview | Interview | 24 min | practical model use, limits, verification |
| AI Proficiency Interview | Interview | 21 min | advanced workflows, evaluation, responsible deployment |
| Model Response Evaluation | Assessment | 44 questions | ranking, error detection, instruction following |

### Media and creative work

| Title | Format | Listed size | Practice emphasis |
|---|---|---:|---|
| OCR Video Captioning | Assessment | 3 questions | text extraction and temporal caption accuracy |
| Visual Design Showcase | Interview | 33 min | screen-led portfolio decisions and critique |
| Visual Media Assessment | Assessment | 11 questions | visual description, comparison, ambiguity |
| Voice Acting Interview | Interview | 17 min | interpretation, direction, vocal choices |
| Audio Media Assessment | Assessment | 4 questions | audio description and quality judgment |
| Creative Prompt Writing | Assessment | 2 questions | constraint-aware ideation and revision |
| Writing Interview | Interview | 19 min | editorial judgment, process, audience, revision |

### Professional domains

| Title | Format | Listed size | Practice emphasis |
|---|---|---:|---|
| Bilingual Competency | Interview | 33 min | meaning preservation and register decisions |
| Law Interview | Interview | 28 min | issue spotting and bounded legal reasoning |
| Finance Interview | Interview | 30 min | financial reasoning, assumptions, risk |
| Clinical Case Study | Interview | 23 min | structured case reasoning without medical diagnosis claims |
| Consulting Interview | Interview | 33 min | problem structure, assumptions, synthesis |
| Sports Expert Interview | Interview | 17 min | domain depth, evidence, historical context |

## Screen sharing

Screen sharing is offered for Software Engineering Demo, System Design Session,
Code Review Session, Visual Design Showcase, Data Science Interview, and Niche
Programming Session. It is optional and user-triggered.

`getDisplayMedia()` supplies a display stream to a hidden video element. A canvas
captures JPEG frames at a maximum of one frame per second and sends them as
Gemini Live `video` realtime input. Screen audio is never requested or sent.
Stopping sharing in the browser immediately stops capture and updates the UI.

## Structured assessment safety and fidelity

- A generated deck may contain single choice, multiple choice, short text, or
  long text items.
- Media-oriented decks use a clearly labeled simulated stimulus in v1; they do
  not pretend that generated prose is an actual video or audio clip.
- The generator receives the preset's competencies, construction guidance,
  requested practice count, and optional user context.
- The response is constrained by a JSON schema and validated again before it is
  returned to the browser.
- Evaluation receives the exact deck, answer guide, criteria, and user's answers.
- The interface reveals rationales only in the debrief, never while answering.

## Errors and recovery

- Deck generation failure stays on the assessment screen with a specific retry
  action and a path back to the library.
- An unanswered question is allowed; submission confirms the count left blank.
- Screen-share denial leaves the interview running and explains how to retry.
- Unsupported browsers hide or disable screen sharing without affecting voice.

## Acceptance criteria

- All 43 screenshot titles are present exactly once.
- Filters find entries by title, domain, competency, and format.
- All 30 interview presets start in text or voice mode and use preset-specific
  adaptive prompt logic.
- All 13 assessment/cognitive presets generate and complete a practice deck.
- Relevant voice rehearsals can start and stop screen sharing.
- Every custom run can reach the existing debrief and be repeated from history.
- The independent-approximation disclosure is visible in the library.
- Existing open rehearsal and resume interview flows continue to pass their tests.
- The app builds and the browser flow works at desktop and mobile widths.
