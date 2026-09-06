# Structured Assessment Decks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 13 assessment/cognitive presets generate fresh, answerable practice decks and reach a format-specific debrief.

**Architecture:** Two typed server endpoints generate and evaluate schema-constrained decks. A client runner owns answer state and navigation, while pure helpers provide validation, progress, transcript projection, and submission behavior that can be tested without a browser DOM.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Vitest 3, Google GenAI structured output, Vercel functions.

**Spec:** `docs/superpowers/specs/2026-09-05-custom-rehearsals-design.md`

## Global Constraints

- All 13 assessment presets must be startable.
- Generated items are limited to single choice, multiple choice, short text, and long text.
- Media exercises must label prose stimuli as simulated.
- Long listed assessments default to at most eight practice questions.
- Answer guides and evaluator criteria are never shown before submission.
- Unknown fields and oversized strings/arrays are stripped or rejected server-side.
- No new runtime dependency.

---

### Task 1: Assessment contracts, generation prompt, and validation

**Files:**
- Modify: `types.ts`
- Modify: `lib/gatewayTypes.ts`
- Create: `api/_lib/assessmentDeck.test.ts`
- Create: `api/_lib/assessmentDeck.ts`

**Interfaces:**
- Produces: `AssessmentQuestion`, `AssessmentDeck`, `AssessmentAnswer`.
- Produces: `buildAssessmentDeckPrompt(setup)`, `validateAssessmentDeck(raw, expectedCount)`, and `validateAssessmentAnswers(raw, deck)`.

- [ ] **Step 1: Write failing prompt and validation tests**

  Assert the prompt includes the title, competencies, guidance, participant
  context, requested count, originality boundary, and simulated-media rule.
  Validate a literal complete deck. Reject wrong counts, duplicate ids,
  unsupported item types, missing choice options, answer keys outside options,
  and oversized content. Validate that each answer references a known question
  once and has the correct string or string-array shape.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- api/_lib/assessmentDeck.test.ts`

  Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement contracts and pure functions**

  Use this externally visible shape:

  ```ts
  export type AssessmentQuestionType =
    | 'single-choice' | 'multiple-choice' | 'short-text' | 'long-text';

  export interface AssessmentQuestion {
    id: string;
    type: AssessmentQuestionType;
    prompt: string;
    stimulus?: string;
    options?: string[];
    answerKey?: string[];
    evaluationCriteria: string[];
    rationale: string;
  }

  export interface AssessmentDeck {
    title: string;
    instructions: string;
    questions: AssessmentQuestion[];
  }

  export interface AssessmentAnswer {
    questionId: string;
    value: string | string[];
  }
  ```

- [ ] **Step 4: Run the focused test and verify GREEN**

  Run: `npm test -- api/_lib/assessmentDeck.test.ts`

  Expected: 0 failures.

- [ ] **Step 5: Commit**

  ```bash
  git add types.ts lib/gatewayTypes.ts api/_lib/assessmentDeck.ts api/_lib/assessmentDeck.test.ts docs/superpowers/plans/2026-09-05-structured-assessment-decks.md
  git commit -m "feat: define structured assessment decks"
  ```

### Task 2: Deck generation endpoint and client

**Files:**
- Create: `api/assessment-deck.ts`
- Modify: `services/apiClient.ts`

**Interfaces:**
- Consumes: `AssessmentDeckRequest`, `AssessmentDeckResponse` from Task 1.
- Produces: `POST /api/assessment-deck` and `generateAssessmentDeck(setup)`.

- [ ] **Step 1: Add the response schema and endpoint**

  Validate that the setup is a rehearsal assessment, request structured JSON
  from the existing text model fallback chain, parse the response, validate it
  with `validateAssessmentDeck`, and return the validated value. Return the
  existing gateway error shapes for bad input, missing API key, and upstream
  failure.

- [ ] **Step 2: Add the typed client call**

  Add `AssessmentDeckRequest { setup: RehearsalSetup }` and
  `AssessmentDeckResponse = AssessmentDeck`, then implement
  `generateAssessmentDeck(setup)` through the existing `post` helper.

- [ ] **Step 3: Run full tests and build**

  Run: `npm test`

  Run: `npm run build`

  Expected: both exit 0.

- [ ] **Step 4: Commit**

  ```bash
  git add api/assessment-deck.ts services/apiClient.ts lib/gatewayTypes.ts
  git commit -m "feat: generate fresh assessment decks"
  ```

### Task 3: Assessment evaluation endpoint

**Files:**
- Create: `api/_lib/assessmentEvaluator.test.ts`
- Create: `api/_lib/assessmentEvaluator.ts`
- Create: `api/evaluate-assessment.ts`
- Modify: `lib/gatewayTypes.ts`
- Modify: `services/apiClient.ts`

**Interfaces:**
- Produces: `buildAssessmentEvaluationPrompt(setup, deck, answers)`, `POST /api/evaluate-assessment`, and `evaluateAssessment(setup, deck, answers)` returning `InterviewFeedback`.

- [ ] **Step 1: Write the failing evaluator-prompt test**

  With a literal two-question deck, assert the evaluator prompt preserves the
  question, answer guide, criteria, rationale, user's response, and a clear
  `[UNANSWERED]` marker. Assert the system instruction scores domain accuracy,
  reasoning, guideline consistency, and uncertainty rather than interview polish.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- api/_lib/assessmentEvaluator.test.ts`

  Expected: FAIL because the evaluator module does not exist.

- [ ] **Step 3: Implement evaluator prompt and endpoint**

  Reuse the existing feedback JSON shape and model fallback chain. Validate the
  setup, deck, and answers before constructing the evaluator input. Return
  structured feedback with an empty `suggestions` array because assessment
  answers do not map onto conversational reply indexes.

- [ ] **Step 4: Run focused/full tests and build**

  Run: `npm test -- api/_lib/assessmentEvaluator.test.ts`

  Run: `npm test`

  Run: `npm run build`

  Expected: all exit 0.

- [ ] **Step 5: Commit**

  ```bash
  git add api/_lib/assessmentEvaluator.ts api/_lib/assessmentEvaluator.test.ts api/evaluate-assessment.ts lib/gatewayTypes.ts services/apiClient.ts
  git commit -m "feat: evaluate structured assessment attempts"
  ```

### Task 4: Assessment runner and app integration

**Files:**
- Create: `lib/assessmentSession.test.ts`
- Create: `lib/assessmentSession.ts`
- Create: `components/AssessmentRunner.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Produces: `isAssessmentAnswered(question, answer)`, `assessmentProgress(deck, answers)`, `assessmentAnswersToTranscript(deck, answers)`, and `AssessmentRunner` callbacks `onComplete(feedback, transcript)` and `onCancel()`.

- [ ] **Step 1: Write failing session-helper tests**

  Assert whitespace-only text is unanswered, an empty choice list is unanswered,
  valid responses count toward literal progress, and transcript projection keeps
  question/answer order while representing blanks as `[Unanswered]`.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- lib/assessmentSession.test.ts`

  Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement helpers and runner**

  The runner loads a deck, shows specific loading/retry errors, renders one
  question at a time, supports Back/Next, retains controlled answer values,
  displays answered progress, confirms when blanks remain, submits once, and
  disables navigation during evaluation. Use each outfit's existing palette and
  typography through `ThemeContext`; keep the call-sheet row rhythm and avoid a
  generic card grid.

- [ ] **Step 4: Wire completion into history and debrief**

  Route `ASSESSMENT_ACTIVE` to the runner. On completion, set the transcript,
  feedback, display persona to `Structured assessment`, mode to `text`, save the
  history entry, and open `FEEDBACK`. Practice Again returns a rehearsal setup to
  the library so a fresh deck is generated.

- [ ] **Step 5: Run focused/full tests and build**

  Run: `npm test -- lib/assessmentSession.test.ts`

  Run: `npm test`

  Run: `npm run build`

  Expected: all exit 0.

- [ ] **Step 6: Commit**

  ```bash
  git add lib/assessmentSession.ts lib/assessmentSession.test.ts components/AssessmentRunner.tsx App.tsx
  git commit -m "feat: add repeatable assessment runner"
  ```

### Task 5: End-to-end verification and documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the complete feature.
- Produces: documented local test path and verified release candidate.

- [ ] **Step 1: Document the feature and disclosure**

  Explain Custom Rehearsals, the difference between interviews and assessments,
  the practice-cut behavior, screen-share browser requirements, and the
  independent-approximation boundary.

- [ ] **Step 2: Run automated verification**

  Run: `npm test`

  Run: `npm run check:bundle`

  Expected: all tests pass, production build exits 0, and the bundle check finds
  no private prompt fragments or API keys.

- [ ] **Step 3: Run browser verification**

  Start: `npm run dev:full -- --host 127.0.0.1 --port 41739 --strictPort`

  Verify at desktop and narrow mobile widths: library search/filter/detail;
  interview launch in text mode; assessment deck loading/answer navigation;
  retry/error copy; debrief/history; screen-share control availability on an
  enabled voice preset. Capture screenshots for visual critique, then stop the
  server.

- [ ] **Step 4: Inspect the branch diff**

  Run: `git diff --check`

  Run: `git status --short`

  Confirm only intentional feature and documentation files remain.

- [ ] **Step 5: Commit documentation corrections**

  ```bash
  git add README.md
  git commit -m "docs: explain custom rehearsal practice"
  ```

