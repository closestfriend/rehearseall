# Optional Job Description Input — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Job Description textarea to interview setup that, when filled, tailors the interviewer's questions (text + voice) and the evaluator's scoring to the specific posting.

**Architecture:** A new optional `jobDescription` field on `ResumeData` flows through the existing single prompt-builder (`buildInterviewerSystemInstruction`, used by both interview modes) and through a newly-extracted pure evaluator-prompt builder. When the field is empty/absent, output is byte-identical to today.

**Tech Stack:** React 19, TypeScript, Vite, Vitest. Google GenAI SDK (`@google/genai`). Tailwind utility classes (inline).

---

## File structure

- **Modify** `types.ts` — add `jobDescription?: string` to `ResumeData`.
- **Modify** `constants.ts` — append a JD block in `buildInterviewerSystemInstruction`; add one JD-weighting sentence to `SYSTEM_INSTRUCTION_FEEDBACK`.
- **Create** `lib/evaluatorPrompt.ts` — pure `buildEvaluatorPrompt(resume, chatTranscript)` (extracted from `geminiService` so the JD-in-scoring behavior is unit-testable without an API call). Mirrors the existing `lib/transcriptFormat.ts` pattern.
- **Create** `lib/evaluatorPrompt.test.ts` — present/absent JD assertions.
- **Modify** `services/geminiService.ts` — use `buildEvaluatorPrompt` instead of the inline template.
- **Modify** `constants.test.ts` — JD present/absent assertions for the interviewer builder + a JD-weighting assertion for the feedback instruction.
- **Modify** `App.tsx` — add `jobDescription: ''` to setup state, render the optional textarea, normalize (trim → `undefined`) on submit.

**No changes needed** to `components/InterviewChat.tsx` or `components/VoiceInterview.tsx`: both already call `buildInterviewerSystemInstruction(resume, persona)` with `resume={resumeData}` (App.tsx:663,671), so the JD propagates automatically.

---

## Task 1: Interviewer prompt — JD block + type field

**Files:**
- Modify: `types.ts` (add field to `ResumeData`)
- Modify: `constants.ts:26-38` (`buildInterviewerSystemInstruction`)
- Test: `constants.test.ts:51-81` (extend the existing `describe`)

- [ ] **Step 1: Write the failing tests**

In `constants.test.ts`, inside the existing `describe('buildInterviewerSystemInstruction', ...)` block (after the `'injects the resume context'` test, before the STAR test), add:

```ts
  it('omits the job-description block when none is provided', () => {
    // RESUME has no jobDescription
    expect(out).not.toContain('Job Description');
  });

  it('includes the job description block when one is provided', () => {
    const withJd = buildInterviewerSystemInstruction(
      { ...RESUME, jobDescription: '  Build React dashboards in TypeScript.  ' },
      skeptic
    );
    expect(withJd).toContain('Job Description (tailor your questions to this):');
    // trimmed, exact text present
    expect(withJd).toContain('Build React dashboards in TypeScript.');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run constants.test.ts -t "job-description"`
Expected: FAIL — the `withJd` test fails because the block string isn't produced yet; TypeScript also errors that `jobDescription` is not a property of `ResumeData`.

- [ ] **Step 3: Add the type field, then the builder block**

In `types.ts`, add the optional field to `ResumeData`:

```ts
export interface ResumeData {
  text: string;
  role: string;
  experienceLevel: string;
  jobDescription?: string;
}
```

In `constants.ts`, replace the `buildInterviewerSystemInstruction` body (lines 26-38) with:

```ts
export function buildInterviewerSystemInstruction(
  resume: ResumeData,
  persona: InterviewerPersona
): string {
  const jd = resume.jobDescription?.trim();
  const jdBlock = jd
    ? `\n\nJob Description (tailor your questions to this):\n${jd}`
    : '';
  return `${INTERVIEWER_CORE}

PERSONA — ${persona.name}:
${persona.fragment}

Candidate Resume: ${resume.text}
Target Role: ${resume.role}
Level: ${resume.experienceLevel}${jdBlock}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run constants.test.ts`
Expected: PASS — all `buildInterviewerSystemInstruction` tests green, including the two new ones and the pre-existing resume/STAR/English tests.

- [ ] **Step 5: Commit**

```bash
git add types.ts constants.ts constants.test.ts
git commit -m "feat: tailor interviewer prompt to optional job description"
```

---

## Task 2: Evaluator prompt — extract pure builder + JD line

**Files:**
- Create: `lib/evaluatorPrompt.ts`
- Test: `lib/evaluatorPrompt.test.ts`
- Modify: `services/geminiService.ts:14-24` (use the new builder)

- [ ] **Step 1: Write the failing tests**

Create `lib/evaluatorPrompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildEvaluatorPrompt } from './evaluatorPrompt';
import type { ResumeData } from '../types';

const RESUME: ResumeData = {
  text: 'Ten years in ML research.',
  role: 'Research Scientist',
  experienceLevel: 'senior',
};
const TRANSCRIPT = 'INTERVIEWER: Hi.\nUSER REPLY #1: Hello.';

describe('buildEvaluatorPrompt', () => {
  it('includes resume, role, experience, and the transcript', () => {
    const out = buildEvaluatorPrompt(RESUME, TRANSCRIPT);
    expect(out).toContain(RESUME.text);
    expect(out).toContain(RESUME.role);
    expect(out).toContain(RESUME.experienceLevel);
    expect(out).toContain(TRANSCRIPT);
  });

  it('omits the JOB DESCRIPTION line when none is provided', () => {
    const out = buildEvaluatorPrompt(RESUME, TRANSCRIPT);
    expect(out).not.toContain('JOB DESCRIPTION');
  });

  it('includes a trimmed JOB DESCRIPTION line when one is provided', () => {
    const out = buildEvaluatorPrompt(
      { ...RESUME, jobDescription: '  Own the data pipeline.  ' },
      TRANSCRIPT
    );
    expect(out).toContain('JOB DESCRIPTION: Own the data pipeline.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/evaluatorPrompt.test.ts`
Expected: FAIL — `Cannot find module './evaluatorPrompt'` (file does not exist yet).

- [ ] **Step 3: Create the builder, then wire it into the service**

Create `lib/evaluatorPrompt.ts`:

```ts
import type { ResumeData } from '../types';

/**
 * Assembles the user-prompt block sent to the evaluator model. Kept pure
 * (no SDK/network) so JD-in-scoring behavior is unit-testable. The JOB
 * DESCRIPTION line is included only when a non-empty JD is provided.
 */
export function buildEvaluatorPrompt(
  resume: ResumeData,
  chatTranscript: string
): string {
  const jd = resume.jobDescription?.trim();
  const jdLine = jd ? `\n      JOB DESCRIPTION: ${jd}` : '';
  return `
      RESUME: ${resume.text}
      TARGET ROLE: ${resume.role}
      EXPERIENCE: ${resume.experienceLevel}${jdLine}
      
      INTERVIEW TRANSCRIPT:
      ${chatTranscript}
    `;
}
```

In `services/geminiService.ts`, add the import near the existing `lib` import (line 5):

```ts
import { buildEvaluatorPrompt } from "../lib/evaluatorPrompt";
```

Then replace the inline `const prompt = ...` template (lines 17-24) with:

```ts
    const prompt = buildEvaluatorPrompt(resume, chatTranscript);
```

(Leave `const chatTranscript = formatTranscriptForEvaluator(transcript);` on line 15 as-is.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/evaluatorPrompt.test.ts`
Expected: PASS — all three assertions green.

- [ ] **Step 5: Commit**

```bash
git add lib/evaluatorPrompt.ts lib/evaluatorPrompt.test.ts services/geminiService.ts
git commit -m "refactor: extract evaluator prompt builder; add optional JD line"
```

---

## Task 3: Feedback instruction — weight scoring to the JD

**Files:**
- Modify: `constants.ts:45-51` (`SYSTEM_INSTRUCTION_FEEDBACK`, the "WEIGHT SIGNALS TO THE ROLE" section)
- Test: `constants.test.ts:85-94` (extend the existing `describe`)

- [ ] **Step 1: Write the failing test**

In `constants.test.ts`, inside `describe('SYSTEM_INSTRUCTION_FEEDBACK', ...)`, add:

```ts
  it('weights role-fit to the job description when one is provided', () => {
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('JOB DESCRIPTION');
    expect(SYSTEM_INSTRUCTION_FEEDBACK.toLowerCase()).toContain('requirements');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run constants.test.ts -t "job description"`
Expected: FAIL — `SYSTEM_INSTRUCTION_FEEDBACK` does not yet mention `JOB DESCRIPTION`.

- [ ] **Step 3: Add the weighting sentence**

In `constants.ts`, in the `WEIGHT SIGNALS TO THE ROLE:` paragraph, insert the new sentence immediately after `Read the TARGET ROLE and RESUME carefully before scoring.` (line 46) so the start of that paragraph reads:

```
WEIGHT SIGNALS TO THE ROLE:
Read the TARGET ROLE and RESUME carefully before scoring. If a JOB DESCRIPTION
is provided, weight role-fit against its specific requirements rather than the
TARGET ROLE title alone. Weight verbal/oral
communication only proportional to how much spoken communication actually
matters in the job. For remote, asynchronous, or written-output-heavy roles
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run constants.test.ts`
Expected: PASS — the new feedback test and all existing constants tests green.

- [ ] **Step 5: Commit**

```bash
git add constants.ts constants.test.ts
git commit -m "feat: weight evaluator scoring to the job description when present"
```

---

## Task 4: Setup form — optional JD textarea

No component-test harness exists in this repo (no React Testing Library / jsdom), so this UI task is verified by typechecking and driving the running app rather than a unit test.

**Files:**
- Modify: `App.tsx:16-20` (setup state init)
- Modify: `App.tsx:108-113` (`handleResumeSubmit` — normalize on submit)
- Modify: `App.tsx:332-334` (insert textarea between Experience Level and Resume blocks)

- [ ] **Step 1: Add `jobDescription` to the setup state init**

In `App.tsx`, update the `useState<ResumeData>` initializer (lines 16-20) to:

```tsx
  const [resumeData, setResumeData] = useState<ResumeData>({
    text: '',
    role: '',
    experienceLevel: 'mid',
    jobDescription: ''
  });
```

- [ ] **Step 2: Normalize the JD on submit (trim → undefined)**

In `App.tsx`, replace `handleResumeSubmit` (lines 108-113) with:

```tsx
  const handleResumeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resumeData.text && resumeData.role) {
      const jd = resumeData.jobDescription?.trim();
      setResumeData({ ...resumeData, jobDescription: jd || undefined });
      setStage(AppStage.INTERVIEW_MODE);
    }
  };
```

- [ ] **Step 3: Add the textarea between Experience Level and Resume Content**

In `App.tsx`, after the Experience Level `</div>` (the block that closes at line 332) and before the Resume `<div>` that begins at line 334, insert:

```tsx
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Job Description (optional)
            </label>
            <textarea
              placeholder="Paste the full job description to tailor the interview…"
              className="w-full h-32 sm:h-40 px-5 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow resize-none text-base"
              value={resumeData.jobDescription ?? ''}
              onChange={(e) => setResumeData({...resumeData, jobDescription: e.target.value})}
            />
          </div>
```

- [ ] **Step 4: Typecheck and visually verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Then with the dev server running (`npm run dev`), open `http://localhost:3000`, and confirm:
- the "Job Description (optional)" textarea appears between Experience Level and Resume Content;
- leaving it blank and starting an interview behaves exactly as before;
- the form still requires Role and Resume.

(Full JD-tailoring behavior is verified end-to-end in Task 5.)

- [ ] **Step 5: Commit**

```bash
git add App.tsx
git commit -m "feat: add optional job-description field to interview setup"
```

---

## Task 5: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites, including the new interviewer-builder, evaluator-prompt, and feedback-instruction assertions.

- [ ] **Step 2: Drive the app with a real JD**

With `npm run dev` running, at `http://localhost:3000`:
1. Set a Target Job Role and paste a short resume.
2. Paste a distinctive JD (e.g. one emphasizing "Rust systems programming and on-call incident response").
3. Start a **text** interview. Confirm the interviewer's questions reflect the JD's specifics (e.g. asks about Rust / on-call), not just the title.
4. Finish the interview and confirm the feedback's analysis references the JD's requirements.
5. Repeat the start of a **voice** interview briefly to confirm the JD reaches that path too (the persona/opening should reflect the JD).

- [ ] **Step 3: Confirm the no-JD path is unchanged**

Run one more text interview leaving the JD blank; confirm behavior matches pre-feature (questions calibrated to role/resume only; no errors in the console beyond the known harmless `favicon.ico` 404).

- [ ] **Step 4: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "test: verify job-description tailoring end-to-end"
```

(If no fixes were needed, skip — Tasks 1-4 already committed the work.)

---

## Self-review notes

- **Spec coverage:** data model (Task 1), UI textarea + trim-to-undefined (Task 4), interviewer wiring for text+voice (Task 1, propagates via shared builder), evaluator JD line (Task 2), feedback nudge (Task 3), history persistence (automatic — JD lives in `ResumeData`, saved via existing `HistoryEntry.resume`), tests (Tasks 1-3), manual UI/E2E verification (Tasks 4-5). All spec sections mapped.
- **Out of scope confirmed absent:** no URL fetch, no char cap, no JD parsing, no role auto-derive.
- **Type consistency:** `jobDescription?: string` defined once in Task 1; `buildEvaluatorPrompt(resume, chatTranscript)` signature consistent between Task 2's test, implementation, and the `geminiService` call site.
