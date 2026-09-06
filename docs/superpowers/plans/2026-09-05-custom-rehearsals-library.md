# Custom Rehearsals Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable 43-entry rehearsal library, adaptive preset interviews, and optional Gemini Live screen sharing.

**Architecture:** A typed client-side catalog creates a validated `RehearsalSetup`, which joins the existing `PracticeSetup` union and reuses the voice/text/debrief pipeline. A new library stage selects presets and captures run-specific context. Screen sharing is an optional input on six compatible live interview presets.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Vitest 3, Google GenAI Live API, browser Media Capture APIs.

**Spec:** `docs/superpowers/specs/2026-09-05-custom-rehearsals-design.md`

## Global Constraints

- All 43 screenshot titles must appear exactly once.
- Copy must identify the collection as an independent approximation, not official an assessment provider content.
- Existing conversation and resume-interview behavior must remain compatible.
- Screen frames are JPEG, at most one frame per second, with no screen audio.
- Browser denial or lack of screen-share support must not end the voice session.
- Do not add a runtime dependency.

---

### Task 1: Typed catalog and discovery behavior

**Files:**
- Create: `lib/rehearsalCatalog.test.ts`
- Create: `lib/rehearsalCatalog.ts`
- Modify: `types.ts`

**Interfaces:**
- Produces: `RehearsalFormat`, `RehearsalPreset`, `RehearsalSetup`.
- Produces: `REHEARSAL_PRESETS`, `findRehearsalPresets(query, format, domain)`, `getRehearsalPreset(id)`, and `createRehearsalSetup(preset, participantContext)`.

- [ ] **Step 1: Write the failing catalog tests**

  Assert literal behavior: catalog length is 43; title set has 43 members;
  format totals are 30 interviews and 13 assessments; title/domain/competency
  search is case-insensitive; format filtering works; setup construction trims
  participant context and preserves screen-sharing capability.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- lib/rehearsalCatalog.test.ts`

  Expected: FAIL because `lib/rehearsalCatalog.ts` does not exist.

- [ ] **Step 3: Add the types and exact catalog**

  Add the following contract to `types.ts`:

  ```ts
  export type RehearsalFormat = 'interview' | 'assessment';

  export interface RehearsalPreset {
    id: string;
    title: string;
    collection: 'practice';
    domain: string;
    format: RehearsalFormat;
    listedDurationMinutes?: number;
    listedQuestionCount?: number;
    practiceQuestionCount: number;
    description: string;
    instructions: string;
    competencies: string[];
    guidance: string[];
    evaluationCriteria: string[];
    supportsScreenShare: boolean;
    sourceConfidence: 'title-only';
  }

  export interface RehearsalSetup {
    kind: 'rehearsal';
    presetId: string;
    title: string;
    format: RehearsalFormat;
    domain: string;
    description: string;
    instructions: string;
    competencies: string[];
    guidance: string[];
    evaluationCriteria: string[];
    targetQuestionCount: number;
    supportsScreenShare: boolean;
    participantContext: string;
  }
  ```

  Extend `PracticeSetup` with `RehearsalSetup`. Implement every catalog row from
  the spec table, using a practice count of the listed count capped at eight for
  assessments and a duration-calibrated target of 3–10 for interviews.

- [ ] **Step 4: Run the focused and full suites and verify GREEN**

  Run: `npm test -- lib/rehearsalCatalog.test.ts`

  Run: `npm test`

  Expected: 0 failures.

- [ ] **Step 5: Commit**

  ```bash
  git add types.ts lib/rehearsalCatalog.ts lib/rehearsalCatalog.test.ts docs/superpowers/specs/2026-09-05-custom-rehearsals-design.md docs/superpowers/plans/2026-09-05-custom-rehearsals-library.md
  git commit -m "feat: define custom rehearsal catalog"
  ```

### Task 2: Server validation and adaptive rehearsal prompts

**Files:**
- Modify: `api/_lib/validate.test.ts`
- Modify: `api/_lib/validate.ts`
- Modify: `api/_lib/prompts.test.ts`
- Modify: `api/_lib/prompts.ts`
- Modify: `lib/practiceSetup.test.ts`
- Modify: `lib/practiceSetup.ts`

**Interfaces:**
- Consumes: `RehearsalSetup` from Task 1.
- Produces: `isRehearsalSetup(setup)`, rehearsal-aware `practiceTitle`, `practiceDetail`, `buildPracticeSystemInstruction`, and `getFeedbackSystemInstruction`.

- [ ] **Step 1: Add failing behavioral tests**

  Test that validation accepts a fully bounded rehearsal setup, rejects an
  unknown format, rejects oversized arrays/strings, and rebuilds the object
  without unknown fields. Test that the live/chat instruction contains the
  preset title, competencies, participant context, exact target count, adaptive
  one-question-at-a-time behavior, and independent-approximation boundary. Test
  that the evaluation instruction uses the preset criteria. Test helper labels.

- [ ] **Step 2: Run focused tests and verify RED**

  Run: `npm test -- api/_lib/validate.test.ts api/_lib/prompts.test.ts lib/practiceSetup.test.ts`

  Expected: FAIL because rehearsal setups are not recognized.

- [ ] **Step 3: Implement bounded validation and prompt branches**

  Add limits for preset id, domain, description, instructions, participant
  context, array length, and array item size. Branch on `kind === 'rehearsal'`
  before the resume fallback. The interview instruction must keep the model in
  character, ask one question at a time, follow the candidate's claims, use the
  supplied guidance, and end with the existing conclusion sentence.

- [ ] **Step 4: Run focused and full suites and verify GREEN**

  Run: `npm test -- api/_lib/validate.test.ts api/_lib/prompts.test.ts lib/practiceSetup.test.ts`

  Run: `npm test`

  Expected: 0 failures.

- [ ] **Step 5: Commit**

  ```bash
  git add api/_lib/validate.ts api/_lib/validate.test.ts api/_lib/prompts.ts api/_lib/prompts.test.ts lib/practiceSetup.ts lib/practiceSetup.test.ts
  git commit -m "feat: add adaptive preset prompt logic"
  ```

### Task 3: Custom Rehearsals call-sheet UI

**Files:**
- Create: `components/RehearsalLibrary.tsx`
- Modify: `App.tsx`
- Modify: `types.ts`
- Modify: `components/theme/ThemedHome.tsx`
- Modify: `components/theme/personal-best/Home.tsx`
- Modify: `components/theme/transcript/Home.tsx`

**Interfaces:**
- Consumes: catalog search and setup factory from Task 1.
- Produces: `AppStage.REHEARSAL_LIBRARY` and `onStart(setup: RehearsalSetup)`.

- [ ] **Step 1: Add a failing navigation-state test through a pure reducer**

  Create `lib/rehearsalNavigation.test.ts` first and specify
  `destinationForRehearsal(setup)` returns `INTERVIEW_MODE` for interview
  presets and `ASSESSMENT_ACTIVE` for assessment presets. This anticipates the
  assessment plan without coupling UI tests to DOM mocks.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- lib/rehearsalNavigation.test.ts`

  Expected: FAIL because `lib/rehearsalNavigation.ts` does not exist.

- [ ] **Step 3: Implement the navigation helper and library UI**

  Create `lib/rehearsalNavigation.ts`, add both enum values, and build the
  approved three-column call sheet. The library must have a search input,
  interview/assessment filter, domain filter, keyboard-focus styles, visible
  disclosure, exact listed duration/count, selected detail, participant-context
  field, and an action whose label names the format being started.

- [ ] **Step 4: Wire the landing pages and interview start path**

  Add `onBrowseRehearsals` through the themed home wrapper and both outfits.
  Store the selected `RehearsalSetup` in `App`, include it in `activeSetup`, and
  route interview presets to the existing mode picker. Make history reload and
  Practice Again restore rehearsal setups.

- [ ] **Step 5: Run tests and build**

  Run: `npm test`

  Run: `npm run build`

  Expected: both exit 0.

- [ ] **Step 6: Commit**

  ```bash
  git add App.tsx types.ts components/RehearsalLibrary.tsx components/theme/ThemedHome.tsx components/theme/personal-best/Home.tsx components/theme/transcript/Home.tsx lib/rehearsalNavigation.ts lib/rehearsalNavigation.test.ts
  git commit -m "feat: add custom rehearsals library"
  ```

### Task 4: Optional Live screen sharing

**Files:**
- Create: `lib/screenShare.test.ts`
- Create: `lib/screenShare.ts`
- Modify: `components/VoiceInterview.tsx`
- Modify: `components/theme/ThemedVoiceInterviewChrome.tsx`
- Modify: `components/theme/personal-best/VoiceInterviewChrome.tsx`
- Modify: `components/theme/transcript/VoiceInterviewChrome.tsx`

**Interfaces:**
- Produces: `canShareScreen(setup, mediaDevices)`, `captureScreenFrame(video, canvas)`, and screen-share chrome props.

- [ ] **Step 1: Write failing pure-contract tests**

  Assert screen sharing is offered only for rehearsal setups that enable it and
  only when `getDisplayMedia` exists. Assert `stripDataUrlPrefix` returns only
  base64 payload data and leaves raw payloads unchanged.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- lib/screenShare.test.ts`

  Expected: FAIL because `lib/screenShare.ts` does not exist.

- [ ] **Step 3: Implement capture and lifecycle**

  Request `{ video: true, audio: false }`, attach the stream to a hidden video,
  capture a JPEG frame every 1000 ms, and call
  `session.sendRealtimeInput({ video: { data, mimeType: 'image/jpeg' } })`.
  Stop the interval and every display track on toggle, browser-ended sharing,
  finish, cancel, and unmount.

- [ ] **Step 4: Add outfit controls and recovery copy**

  Thread availability, active state, error, and toggle callback through the
  themed chrome. Keep camera and screen share separate. A denied share shows a
  retryable message and leaves audio active.

- [ ] **Step 5: Run focused/full tests and build**

  Run: `npm test -- lib/screenShare.test.ts`

  Run: `npm test`

  Run: `npm run build`

  Expected: all exit 0.

- [ ] **Step 6: Commit**

  ```bash
  git add lib/screenShare.ts lib/screenShare.test.ts components/VoiceInterview.tsx components/theme/ThemedVoiceInterviewChrome.tsx components/theme/personal-best/VoiceInterviewChrome.tsx components/theme/transcript/VoiceInterviewChrome.tsx
  git commit -m "feat: add live rehearsal screen sharing"
  ```

