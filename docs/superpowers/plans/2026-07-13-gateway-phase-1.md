# Gateway (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all Gemini access server-side (Vercel functions) so the API key and interviewer prompts no longer ship in the client bundle — phase 1 of `docs/superpowers/specs/2026-07-11-billing-and-variants-design.md`.

**Architecture:** Three Vercel serverless functions (`/api/chat`, `/api/evaluate`, `/api/live-token`) plus `/api/health`, sharing `api/_lib/` modules (CORS allowlist, stable error codes, validation, prompt builders). The client swaps SDK calls for `fetch` calls via a thin `services/apiClient.ts`. Persona selection moves server-side; the client only ever sees `{ personaId, personaName }`. Voice mode uses config-locked Gemini **ephemeral tokens** (v1alpha) so the system instruction and voice never reach the client; the existing `goAway` reconnect logic mints a fresh token per reconnect. No auth, no quota, no database in this phase (those are phases 2–3).

**Tech Stack:** Vercel Node functions (`@vercel/node` types), `@google/genai` v1.34+ server-side (incl. `authTokens`), existing Vite/React client, Vitest.

## Global Constraints

- **Phase 1 has no auth and no database.** Interim abuse guards are exactly: CORS allowlist (spec C3) + per-session turn ceiling of 40 interviewer turns (spec C7) + input size limits. This is the spec's documented, time-boxed exposure window; `noindex` stays ON.
- **Stable error codes only** (spec C5): every error response is `{ error: { code, message } }` with a generic message. Details go to `console.error` (Vercel function logs) — the `error_logs` table arrives in phase 2; `sendError`'s signature already accepts the detail so only the sink changes later.
- **Protected code:** `VoiceInterview.tsx`'s audio pipeline (worklet wiring, playback queue, interruption handling, wake lock, StrictMode guard, `parseLiveSessionSignal` lifecycle) must not change. Task 5 lists the exact permitted edits; anything not listed there is off-limits.
- **Prompt parity:** the prompt builders *move*, they do not change. Existing prompt tests move with them and must pass unmodified (only import paths change).
- **Model IDs:** `TEXT_CHEF`/`EVALUATOR` primary `gemini-3.5-flash`, fallback `gemini-3-flash-preview` (newroom's adopted fallback-chain pattern); `VOICE_INTERVIEWER` `gemini-3.1-flash-live-preview` (no fallback — no GA live-audio alternative exists).
- **Env:** server key is `GEMINI_API_KEY` (never `VITE_`-prefixed). Client gets optional `VITE_API_BASE` (empty = same-origin). `VITE_GEMINI_API_KEY` is deleted in Task 6.
- **Branch:** work on `gateway`, branched off `theme-redesign` (the client swap depends on the themed components). `theme-redesign` merges to `main` before `gateway` does.

## File Structure

```
api/
  health.ts               GET smoke check (deploy/env verification)
  chat.ts                 POST text-interview turn
  evaluate.ts             POST post-interview evaluation
  live-token.ts           POST ephemeral-token mint (initial + reconnect)
  _lib/                   underscore prefix = not deployed as endpoints
    http.ts               error codes, sendError
    cors.ts               allowlist + preflight
    validate.ts           request-shape/size validation, LIMITS
    prompts.ts            personas (fragments+voices), builders, MODELS  ← moved from constants.ts
    evaluatorPrompt.ts    ← moved from lib/evaluatorPrompt.ts
    *.test.ts             vitest picks these up (include: **/*.test.ts)
lib/gatewayTypes.ts       request/response contracts shared client↔server
services/apiClient.ts     typed fetch client (replaces geminiService.ts)
scripts/check-bundle.mjs  key/prompt leak check over dist/
```

`api/*` functions may import from `lib/` and `constants.ts` (Vercel traces imports). The reverse — client code importing from `api/_lib/` — is forbidden; that boundary is what keeps prompts out of the bundle.

---

### Task 1: Gateway plumbing — errors, CORS, health endpoint

**Files:**
- Create: `api/_lib/http.ts`
- Create: `api/_lib/cors.ts`
- Test: `api/_lib/cors.test.ts`
- Create: `api/health.ts`
- Modify: `package.json` (devDependency + script)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `sendError(res: VercelResponse, status: number, code: ErrorCode, logDetail?: unknown): void`; `applyCors(req: VercelRequest, res: VercelResponse): boolean` (true = request fully handled, handler must return); `resolveCorsOrigin(origin: string | undefined, host: string | undefined, allowlist: string[]): 'no-origin' | 'same-origin' | 'allowed' | 'forbidden'`; `allowedOrigins(): string[]`. `ErrorCode = 'bad_request' | 'method_not_allowed' | 'origin_forbidden' | 'turn_limit' | 'upstream_error' | 'server_misconfigured'`.

- [ ] **Step 1: Install the Vercel function types**

```bash
cd /Users/hnsk/Projects/hireprep-ai && npm install -D @vercel/node
```

- [ ] **Step 2: Write the failing CORS tests**

Create `api/_lib/cors.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { resolveCorsOrigin, allowedOrigins } from './cors';

const ALLOW = ['http://localhost:3000', 'https://hireprep-ai-nine.vercel.app'];

describe('resolveCorsOrigin', () => {
  it('passes requests with no Origin header (curl, server-to-server)', () => {
    expect(resolveCorsOrigin(undefined, 'x.vercel.app', ALLOW)).toBe('no-origin');
  });

  it('allows same-origin requests regardless of allowlist (preview deployments)', () => {
    expect(
      resolveCorsOrigin('https://hireprep-abc123.vercel.app', 'hireprep-abc123.vercel.app', ALLOW)
    ).toBe('same-origin');
  });

  it('allows allowlisted cross-origin callers', () => {
    expect(resolveCorsOrigin('http://localhost:3000', 'x.vercel.app', ALLOW)).toBe('allowed');
  });

  it('forbids unknown origins', () => {
    expect(resolveCorsOrigin('https://evil.example', 'x.vercel.app', ALLOW)).toBe('forbidden');
  });

  it('forbids malformed origins', () => {
    expect(resolveCorsOrigin('not a url', 'x.vercel.app', ALLOW)).toBe('forbidden');
  });
});

describe('allowedOrigins', () => {
  afterEach(() => { delete process.env.ALLOWED_ORIGINS; });

  it('parses the ALLOWED_ORIGINS env var as a comma-separated list', () => {
    process.env.ALLOWED_ORIGINS = 'https://a.example, https://b.example';
    expect(allowedOrigins()).toEqual(['https://a.example', 'https://b.example']);
  });

  it('falls back to the built-in defaults when unset', () => {
    expect(allowedOrigins()).toContain('http://localhost:3000');
    expect(allowedOrigins()).toContain('https://hireprep-ai-nine.vercel.app');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/cors.test.ts`
Expected: FAIL — cannot resolve `./cors`.

- [ ] **Step 4: Implement `api/_lib/cors.ts` and `api/_lib/http.ts`**

`api/_lib/http.ts`:

```ts
import type { VercelResponse } from '@vercel/node';

export type ErrorCode =
  | 'bad_request'
  | 'method_not_allowed'
  | 'origin_forbidden'
  | 'turn_limit'
  | 'upstream_error'
  | 'server_misconfigured';

const MESSAGES: Record<ErrorCode, string> = {
  bad_request: 'The request was malformed.',
  method_not_allowed: 'Method not allowed.',
  origin_forbidden: 'This origin is not allowed to call the API.',
  turn_limit: 'This interview session has reached its maximum length.',
  upstream_error: 'The interview service is temporarily unavailable. Please try again.',
  server_misconfigured: 'The server is misconfigured. Please try again later.',
};

// Stable code + generic message to the client (spec C5); the detail goes to
// Vercel function logs — the error_logs table replaces this sink in phase 2.
export function sendError(
  res: VercelResponse,
  status: number,
  code: ErrorCode,
  logDetail?: unknown
): void {
  if (logDetail !== undefined) {
    console.error(`[gateway:${code}]`, logDetail);
  }
  res.status(status).json({ error: { code, message: MESSAGES[code] } });
}
```

`api/_lib/cors.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_ALLOWED = [
  'http://localhost:3000',
  'https://hireprep-ai-nine.vercel.app',
];

export function allowedOrigins(): string[] {
  const env = process.env.ALLOWED_ORIGINS;
  if (!env) return DEFAULT_ALLOWED;
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

export function resolveCorsOrigin(
  origin: string | undefined,
  host: string | undefined,
  allowlist: string[]
): 'no-origin' | 'same-origin' | 'allowed' | 'forbidden' {
  if (!origin) return 'no-origin';
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return 'forbidden';
  }
  // Same-origin lets every preview deployment call its own /api without the
  // allowlist having to enumerate ephemeral preview URLs.
  if (host && originHost === host) return 'same-origin';
  if (allowlist.includes(origin)) return 'allowed';
  return 'forbidden';
}

// Returns true when the request was fully handled (preflight or rejection)
// and the endpoint handler must return immediately.
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;
  const verdict = resolveCorsOrigin(origin, req.headers.host, allowedOrigins());

  if (verdict === 'forbidden') {
    res.status(403).json({
      error: { code: 'origin_forbidden', message: 'This origin is not allowed to call the API.' },
    });
    return true;
  }
  if (verdict === 'allowed' || verdict === 'same-origin') {
    res.setHeader('Access-Control-Allow-Origin', origin!);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return true;
  }
  return false;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/cors.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Add the health endpoint and dev script**

Create `api/health.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from './_lib/cors';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  // hasKey verifies env wiring without ever echoing the key.
  res.status(200).json({ ok: true, hasKey: Boolean(process.env.GEMINI_API_KEY) });
}
```

In `package.json` `"scripts"`, add (after `"dev:phone"`):

```json
    "dev:full": "vercel dev",
```

- [ ] **Step 7: Add the server key to `.env.local` and smoke-test locally**

Append to `/Users/hnsk/Projects/hireprep-ai/.env.local` a line `GEMINI_API_KEY=<same value as the existing VITE_GEMINI_API_KEY line>` (copy the value from that file — do not touch the existing line yet; it goes away in Task 6). **Never put the key in a bare `.env` file — `.gitignore` covers `.env.local`/`.env.*.local` but NOT `.env`.**

The `hasKey` field in the next step verifies whether `vercel dev` actually exposes `.env.local` to functions. If it comes back `false`, use the cloud-env path instead: `vercel env add GEMINI_API_KEY development` (paste the same value), then `vercel env pull .env.development.local`, then restart `vercel dev`.

Run: `cd /Users/hnsk/Projects/hireprep-ai && npm run dev:full` (leave running), then in another shell:

```bash
curl -s http://localhost:3000/api/health
```

Expected: `{"ok":true,"hasKey":true}`. Also confirm the Vite app still loads at `http://localhost:3000`. Then:

```bash
curl -s -H "Origin: https://evil.example" http://localhost:3000/api/health
```

Expected: 403 with `{"error":{"code":"origin_forbidden",...}}`.

- [ ] **Step 8: Typecheck and commit**

Run: `npx tsc --noEmit` — expected: clean.

```bash
git add api package.json package-lock.json
git commit -m "feat(gateway): CORS allowlist, stable error codes, /api/health"
```

---

### Task 2: Move prompt material server-side (`api/_lib/prompts.ts`)

**Files:**
- Create: `api/_lib/prompts.ts`
- Create: `api/_lib/evaluatorPrompt.ts` (copy of `lib/evaluatorPrompt.ts` — original deleted in Task 6)
- Test: `api/_lib/prompts.test.ts`, `api/_lib/evaluatorPrompt.test.ts`

**Interfaces:**
- Consumes: `INTERVIEWER_PERSONAS` from `constants.ts` (still the full array at this point; slimmed to names-only in Task 6 — this module only reads `id` and `name` from it), `ResumeData` from `types.ts`.
- Produces: `MODELS: { TEXT_CHEF_CHAIN: string[]; EVALUATOR_CHAIN: string[]; VOICE_INTERVIEWER: string }`; `interface ServerPersona { id: string; name: string; voiceId: string; fragment: string }`; `SERVER_PERSONAS: ServerPersona[]`; `getPersona(id: string): ServerPersona | undefined`; `pickPersona(excludeId?: string): ServerPersona`; `buildInterviewerSystemInstruction(resume: ResumeData, persona: ServerPersona): string`; `SYSTEM_INSTRUCTION_FEEDBACK: string`; `INTERVIEWER_CORE: string`; `PREBUILT_VOICE_IDS: string[]`; `buildEvaluatorPrompt(resume: ResumeData, chatTranscript: string): string`.

- [ ] **Step 1: Write the failing tests**

Create `api/_lib/prompts.test.ts` — these are the existing prompt tests from `constants.test.ts`, retargeted (prompt **parity** is the requirement; assertions are unchanged):

```ts
import { describe, it, expect } from 'vitest';
import {
  SERVER_PERSONAS, PREBUILT_VOICE_IDS, getPersona, pickPersona,
  buildInterviewerSystemInstruction, INTERVIEWER_CORE,
  SYSTEM_INSTRUCTION_FEEDBACK, MODELS,
} from './prompts';
import type { ResumeData } from '../../types';

const RESUME: ResumeData = { text: 'Ten years in ML research.', role: 'Research Scientist', experienceLevel: 'senior' };

describe('SERVER_PERSONAS', () => {
  it('has six personas with unique ids', () => {
    expect(SERVER_PERSONAS).toHaveLength(6);
    expect(new Set(SERVER_PERSONAS.map(p => p.id)).size).toBe(6);
  });

  it('maps every persona to a real prebuilt voice id', () => {
    const voices = new Set(PREBUILT_VOICE_IDS);
    for (const p of SERVER_PERSONAS) expect(voices.has(p.voiceId)).toBe(true);
  });

  it('gives every persona a non-empty name and fragment', () => {
    for (const p of SERVER_PERSONAS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.fragment.trim().length).toBeGreaterThan(0);
    }
  });

  it('getPersona resolves known ids and rejects unknown ones', () => {
    expect(getPersona('skeptic')?.name).toBe('The Skeptic');
    expect(getPersona('nope')).toBeUndefined();
  });
});

describe('pickPersona', () => {
  it('returns a persona from the roster', () => {
    const ids = new Set(SERVER_PERSONAS.map(p => p.id));
    expect(ids.has(pickPersona().id)).toBe(true);
  });

  it('never returns the excluded persona', () => {
    const exclude = SERVER_PERSONAS[0].id;
    for (let i = 0; i < 200; i++) expect(pickPersona(exclude).id).not.toBe(exclude);
  });
});

describe('buildInterviewerSystemInstruction', () => {
  const skeptic = getPersona('skeptic')!;
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

  it('omits the job-description block when none is provided', () => {
    expect(out).not.toContain('Job Description');
  });

  it('falls back to a no-resume instruction when the resume text is empty', () => {
    const noResume = buildInterviewerSystemInstruction({ ...RESUME, text: '   ' }, skeptic);
    expect(noResume).toContain('none provided');
    expect(noResume).toContain(RESUME.role);
    expect(noResume.toLowerCase()).toContain("don't reference or ask about a resume");
  });

  it('includes the job description block when one is provided', () => {
    const withJd = buildInterviewerSystemInstruction(
      { ...RESUME, jobDescription: '  Build React dashboards in TypeScript.  ' }, skeptic
    );
    expect(withJd).toContain('Job Description (tailor your questions to this):');
    expect(withJd).toContain('Build React dashboards in TypeScript.');
  });

  it('does not hardcode STAR in the core (only personas may use it)', () => {
    expect(out.split('PERSONA —')[0]).not.toContain('STAR');
    expect(INTERVIEWER_CORE).not.toContain('STAR');
  });
});

describe('SYSTEM_INSTRUCTION_FEEDBACK', () => {
  it('gates inline suggestions on a sub-70 score', () => {
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('below 70');
  });
  it('references replies by their printed USER REPLY index', () => {
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('replyIndex');
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('USER REPLY');
  });
  it('weights role-fit to the job description when one is provided', () => {
    expect(SYSTEM_INSTRUCTION_FEEDBACK).toContain('JOB DESCRIPTION');
    expect(SYSTEM_INSTRUCTION_FEEDBACK.toLowerCase()).toContain('requirements');
  });
});

describe('MODELS', () => {
  it('defines fallback chains with the current primaries', () => {
    expect(MODELS.TEXT_CHEF_CHAIN[0]).toBe('gemini-3.5-flash');
    expect(MODELS.EVALUATOR_CHAIN[0]).toBe('gemini-3.5-flash');
    expect(MODELS.TEXT_CHEF_CHAIN.length).toBeGreaterThan(1);
    expect(MODELS.VOICE_INTERVIEWER).toBe('gemini-3.1-flash-live-preview');
  });
});
```

Create `api/_lib/evaluatorPrompt.test.ts`: copy `lib/evaluatorPrompt.test.ts` verbatim, changing only the two import paths (`'./evaluatorPrompt'` stays the same; `'../types'` becomes `'../../types'`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/prompts.test.ts api/_lib/evaluatorPrompt.test.ts`
Expected: FAIL — cannot resolve `./prompts` / `./evaluatorPrompt`.

- [ ] **Step 3: Implement `api/_lib/prompts.ts`**

The prompt strings and builder logic are **moved verbatim** from `constants.ts` (lines 3–24 `INTERVIEWER_CORE`, 26–45 builder, 47–97 `SYSTEM_INSTRUCTION_FEEDBACK`, persona fragments/voiceIds from lines 123–160, `pickPersona` from 164–169). Do not rewrite the strings — copy them.

```ts
import { INTERVIEWER_PERSONAS } from '../../constants';
import type { ResumeData } from '../../types';

// Fallback chains: newroom's adopted resilience pattern (spec §2) — try the
// primary, fall back on failure, record the last error.
export const MODELS = {
  TEXT_CHEF_CHAIN: ['gemini-3.5-flash', 'gemini-3-flash-preview'],
  EVALUATOR_CHAIN: ['gemini-3.5-flash', 'gemini-3-flash-preview'],
  VOICE_INTERVIEWER: 'gemini-3.1-flash-live-preview',
};

export const PREBUILT_VOICE_IDS = [
  'Puck', 'Charon', 'Kore', 'Orus', 'Iapetus', 'Schedar', 'Gacrux', 'Sulafat',
];

export const INTERVIEWER_CORE = `<<< moved verbatim from constants.ts >>>`;

export interface ServerPersona {
  id: string;
  name: string;
  voiceId: string;
  fragment: string;
}

// The private half of each persona: voice + prompt fragment. Names stay in
// constants.ts (they're public UI copy); fragments must never reach the bundle.
const PERSONA_PRIVATE: Record<string, { voiceId: string; fragment: string }> = {
  skeptic:       { voiceId: 'Kore',    fragment: `<<< moved verbatim >>>` },
  'warm-mentor': { voiceId: 'Sulafat', fragment: `<<< moved verbatim >>>` },
  'rapid-fire':  { voiceId: 'Puck',    fragment: `<<< moved verbatim >>>` },
  socratic:      { voiceId: 'Iapetus', fragment: `<<< moved verbatim >>>` },
  director:      { voiceId: 'Gacrux',  fragment: `<<< moved verbatim >>>` },
  examiner:      { voiceId: 'Schedar', fragment: `<<< moved verbatim >>>` },
};

export const SERVER_PERSONAS: ServerPersona[] = INTERVIEWER_PERSONAS.map(p => {
  const priv = PERSONA_PRIVATE[p.id];
  if (!priv) throw new Error(`No private persona definition for id "${p.id}"`);
  return { id: p.id, name: p.name, ...priv };
});

export function getPersona(id: string): ServerPersona | undefined {
  return SERVER_PERSONAS.find(p => p.id === id);
}

export function pickPersona(excludeId?: string): ServerPersona {
  const pool = SERVER_PERSONAS.filter(p => p.id !== excludeId);
  const choices = pool.length > 0 ? pool : SERVER_PERSONAS;
  return choices[Math.floor(Math.random() * choices.length)];
}

export function buildInterviewerSystemInstruction(
  resume: ResumeData,
  persona: ServerPersona
): string {
  // <<< body moved verbatim from constants.ts buildInterviewerSystemInstruction >>>
}

export const SYSTEM_INSTRUCTION_FEEDBACK = `<<< moved verbatim from constants.ts >>>`;
```

Create `api/_lib/evaluatorPrompt.ts`: copy `lib/evaluatorPrompt.ts` verbatim, changing only `'../types'` → `'../../types'`. (The `lib/` original and its consumers stay untouched until Task 6.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run` — expected: all pass, including the still-present old `constants.test.ts` / `lib/evaluatorPrompt.test.ts` (duplication is deliberate until Task 6 removes the client-side copies).

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit` — expected: clean.

```bash
git add api/_lib
git commit -m "feat(gateway): server-side prompt module (personas, builders, model chains)"
```

---

### Task 3: `/api/evaluate` + client swap

**Files:**
- Create: `api/_lib/validate.ts`
- Test: `api/_lib/validate.test.ts`
- Create: `lib/gatewayTypes.ts`
- Create: `api/evaluate.ts`
- Create: `services/apiClient.ts`
- Modify: `App.tsx:11` (import), `App.tsx:142` (call)
- Delete: `services/geminiService.ts` (App was its only consumer)

**Interfaces:**
- Consumes: `sendError`/`applyCors` (Task 1), `MODELS.EVALUATOR_CHAIN`, `SYSTEM_INSTRUCTION_FEEDBACK`, `buildEvaluatorPrompt` (Task 2), `formatTranscriptForEvaluator` from `lib/transcriptFormat.ts` (existing), `InterviewFeedback`/`ResumeData`/`InterviewMessage` from `types.ts`.
- Produces: `validateSetup(raw: unknown): { ok: true; value: ResumeData } | { ok: false; reason: string }`; `validateMessages(raw: unknown): { ok: true; value: InterviewMessage[] } | { ok: false; reason: string }` (reason `'turn_limit'` is special-cased by handlers); `LIMITS` const; `GatewayError` type; `evaluateInterview(setup: ResumeData, transcript: InterviewMessage[]): Promise<InterviewFeedback>`; `GatewayRequestError` (has `.code: string`); private `post<T>(path, body)` helper reused by Tasks 4–5.

- [ ] **Step 1: Write the failing validation tests**

Create `api/_lib/validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateSetup, validateMessages, LIMITS } from './validate';

const SETUP = { text: 'resume text', role: 'Engineer', experienceLevel: 'mid' };

describe('validateSetup', () => {
  it('accepts a minimal valid setup', () => {
    const r = validateSetup(SETUP);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.role).toBe('Engineer');
  });

  it('accepts an empty resume text (no-resume flow) and optional JD', () => {
    expect(validateSetup({ ...SETUP, text: '' }).ok).toBe(true);
    expect(validateSetup({ ...SETUP, jobDescription: 'Own the pipeline.' }).ok).toBe(true);
  });

  it('rejects a missing or blank role', () => {
    expect(validateSetup({ ...SETUP, role: '  ' }).ok).toBe(false);
    expect(validateSetup({ ...SETUP, role: undefined }).ok).toBe(false);
  });

  it('rejects non-object bodies and oversized fields', () => {
    expect(validateSetup(null).ok).toBe(false);
    expect(validateSetup({ ...SETUP, text: 'x'.repeat(LIMITS.resumeChars + 1) }).ok).toBe(false);
    expect(validateSetup({ ...SETUP, jobDescription: 'x'.repeat(LIMITS.jdChars + 1) }).ok).toBe(false);
  });

  it('drops unknown extra fields instead of passing them through', () => {
    const r = validateSetup({ ...SETUP, sneaky: 'payload' });
    expect(r.ok).toBe(true);
    if (r.ok) expect('sneaky' in r.value).toBe(false);
  });
});

describe('validateMessages', () => {
  const msg = (role: 'user' | 'assistant', content = 'hi') => ({ role, content, timestamp: 1 });

  it('accepts an alternating history and an empty first-turn history', () => {
    expect(validateMessages([]).ok).toBe(true);
    expect(validateMessages([msg('assistant'), msg('user')]).ok).toBe(true);
  });

  it('rejects bad roles, non-string content, and oversized content', () => {
    expect(validateMessages([{ role: 'system', content: 'x', timestamp: 1 }]).ok).toBe(false);
    expect(validateMessages([{ role: 'user', content: 5, timestamp: 1 }]).ok).toBe(false);
    expect(validateMessages([msg('user', 'x'.repeat(LIMITS.messageChars + 1))]).ok).toBe(false);
  });

  it('flags histories past the turn ceiling with reason turn_limit', () => {
    const tooLong = Array.from({ length: LIMITS.maxTurns * 2 + 1 }, (_, i) =>
      msg(i % 2 ? 'user' : 'assistant'));
    const r = validateMessages(tooLong);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('turn_limit');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/validate.test.ts`
Expected: FAIL — cannot resolve `./validate`.

- [ ] **Step 3: Implement `api/_lib/validate.ts`**

```ts
import type { ResumeData, InterviewMessage } from '../../types';

export const LIMITS = {
  resumeChars: 30_000,
  jdChars: 10_000,
  roleChars: 200,
  levelChars: 40,
  messageChars: 8_000,
  // Spec C7's phase-1 ceiling: 40 interviewer turns per session, enforced on
  // the client-supplied history length. A client can lie by trimming history,
  // but then the interview loses its context — real enforcement lands with
  // usage_events in phase 3.
  maxTurns: 40,
};

export type Validated<T> = { ok: true; value: T } | { ok: false; reason: string };

export function validateSetup(raw: unknown): Validated<ResumeData> {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'setup missing' };
  const s = raw as Record<string, unknown>;
  if (typeof s.text !== 'string' || s.text.length > LIMITS.resumeChars)
    return { ok: false, reason: 'setup.text' };
  if (typeof s.role !== 'string' || !s.role.trim() || s.role.length > LIMITS.roleChars)
    return { ok: false, reason: 'setup.role' };
  if (typeof s.experienceLevel !== 'string' || !s.experienceLevel.trim() || s.experienceLevel.length > LIMITS.levelChars)
    return { ok: false, reason: 'setup.experienceLevel' };
  if (s.jobDescription !== undefined && (typeof s.jobDescription !== 'string' || s.jobDescription.length > LIMITS.jdChars))
    return { ok: false, reason: 'setup.jobDescription' };
  // Rebuild the object so unknown fields never flow into prompt assembly.
  return {
    ok: true,
    value: {
      text: s.text,
      role: s.role,
      experienceLevel: s.experienceLevel,
      jobDescription: s.jobDescription as string | undefined,
    },
  };
}

export function validateMessages(raw: unknown): Validated<InterviewMessage[]> {
  if (!Array.isArray(raw)) return { ok: false, reason: 'messages not an array' };
  if (raw.length > LIMITS.maxTurns * 2) return { ok: false, reason: 'turn_limit' };
  const out: InterviewMessage[] = [];
  for (const m of raw) {
    if (typeof m !== 'object' || m === null) return { ok: false, reason: 'message shape' };
    const { role, content } = m as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') return { ok: false, reason: 'message role' };
    if (typeof content !== 'string' || content.length > LIMITS.messageChars)
      return { ok: false, reason: 'message content' };
    out.push({ role, content, timestamp: 0 });
  }
  return { ok: true, value: out };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/validate.test.ts` — expected: PASS.

- [ ] **Step 5: Create the shared contract types**

Create `lib/gatewayTypes.ts` (client-safe: types only):

```ts
import type { ResumeData, InterviewMessage, InterviewFeedback } from '../types';

// Request/response contracts for the /api gateway. Imported by both the
// Vercel functions and services/apiClient.ts — keep this file types-only.

export interface EvaluateRequest {
  setup: ResumeData;
  transcript: InterviewMessage[];
}
export type EvaluateResponse = InterviewFeedback;

export interface GatewayError {
  error: { code: string; message: string };
}
```

- [ ] **Step 6: Implement `api/evaluate.ts`**

The schema and generation config move verbatim from `services/geminiService.ts:20-50`; the empty/parse failure detail strings move into log details.

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import { applyCors } from './_lib/cors';
import { sendError } from './_lib/http';
import { validateSetup, validateMessages } from './_lib/validate';
import { MODELS, SYSTEM_INSTRUCTION_FEEDBACK } from './_lib/prompts';
import { buildEvaluatorPrompt } from './_lib/evaluatorPrompt';
import { formatTranscriptForEvaluator } from '../lib/transcriptFormat';

const FEEDBACK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
    detailedAnalysis: { type: Type.STRING },
    suggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          replyIndex: { type: Type.NUMBER },
          critique: { type: Type.STRING },
          modelAnswer: { type: Type.STRING },
        },
        required: ['replyIndex', 'critique', 'modelAnswer'],
      },
    },
  },
  required: ['score', 'strengths', 'improvements', 'detailedAnalysis'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const key = process.env.GEMINI_API_KEY;
  if (!key) return sendError(res, 500, 'server_misconfigured', 'GEMINI_API_KEY unset');

  const setup = validateSetup(req.body?.setup);
  if (!setup.ok) return sendError(res, 400, 'bad_request', `evaluate: ${setup.reason}`);
  const transcript = validateMessages(req.body?.transcript);
  if (!transcript.ok) return sendError(res, 400, 'bad_request', `evaluate: ${transcript.reason}`);
  if (transcript.value.length === 0) return sendError(res, 400, 'bad_request', 'evaluate: empty transcript');

  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = buildEvaluatorPrompt(setup.value, formatTranscriptForEvaluator(transcript.value));

  let lastErr: unknown;
  for (const model of MODELS.EVALUATOR_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_FEEDBACK,
          responseMimeType: 'application/json',
          maxOutputTokens: 16384,
          responseSchema: FEEDBACK_SCHEMA,
        },
      });
      const raw = response.text;
      if (!raw) {
        lastErr = `empty response from ${model} (finishReason=${(response as any)?.candidates?.[0]?.finishReason})`;
        continue;
      }
      try {
        res.status(200).json(JSON.parse(raw));
        return;
      } catch {
        lastErr = `unparseable JSON from ${model} (len=${raw.length}) preview=${raw.slice(0, 200)}`;
        continue;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  sendError(res, 502, 'upstream_error', lastErr);
}
```

- [ ] **Step 7: Implement `services/apiClient.ts`**

```ts
import type { ResumeData, InterviewMessage, InterviewFeedback } from '../types';
import type { GatewayError } from '../lib/gatewayTypes';

// '' = same-origin (deployed + vercel dev). Set VITE_API_BASE to a deployed
// preview URL when running plain `npm run dev` / `npm run dev:phone`, which
// serve no /api functions.
const API_BASE = import.meta.env.VITE_API_BASE || '';

export class GatewayRequestError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'GatewayRequestError';
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new GatewayRequestError('network', 'Could not reach the interview service. Check your connection and try again.');
  }
  if (!res.ok) {
    let code = 'unknown';
    let message = `Request failed (${res.status}).`;
    try {
      const parsed = (await res.json()) as GatewayError;
      if (parsed?.error?.code) ({ code, message } = parsed.error);
    } catch { /* non-JSON error body — keep the generic message */ }
    throw new GatewayRequestError(code, message);
  }
  return res.json() as Promise<T>;
}

export function evaluateInterview(
  setup: ResumeData,
  transcript: InterviewMessage[]
): Promise<InterviewFeedback> {
  return post<InterviewFeedback>('/api/evaluate', { setup, transcript });
}
```

- [ ] **Step 8: Swap App.tsx over and delete geminiService**

In `App.tsx`: replace line 11 `import { geminiService } from './services/geminiService';` with `import { evaluateInterview } from './services/apiClient';`, and line 142 `const result = await geminiService.generateFeedback(resumeData, messages);` with `const result = await evaluateInterview(resumeData, messages);`. Then:

```bash
git rm services/geminiService.ts
```

- [ ] **Step 9: Verify — tests, typecheck, live round-trip**

Run: `npx vitest run && npx tsc --noEmit` — expected: all pass, clean.

With `npm run dev:full` running:

```bash
curl -s http://localhost:3000/api/evaluate -H 'Content-Type: application/json' -d '{
  "setup": { "text": "", "role": "Software Engineer", "experienceLevel": "mid" },
  "transcript": [
    { "role": "assistant", "content": "Tell me about a project you shipped.", "timestamp": 1 },
    { "role": "user", "content": "I built a small internal dashboard in React that cut reporting time in half.", "timestamp": 2 }
  ]
}' | head -c 400
```

Expected: JSON starting `{"score":` with `strengths`/`improvements`/`detailedAnalysis`. Also verify a bad request: same call with `"transcript": []` → 400 `{"error":{"code":"bad_request",...}}`.

Then in the browser (localhost:3000): run a short **text** interview end-to-end (chat itself still uses the client SDK at this point) and confirm the Debrief screen renders scores — that exercises the new `/api/evaluate` path, including the Retry button on failure.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(gateway): /api/evaluate + client swap; evaluation key leaves the client"
```

---

### Task 4: `/api/chat` + text-mode client swap (server-side persona pick)

**Files:**
- Modify: `lib/gatewayTypes.ts` (add chat types)
- Create: `api/chat.ts`
- Modify: `services/apiClient.ts` (add `sendChatTurn`)
- Modify: `components/InterviewChat.tsx` (SDK → gateway)
- Modify: `App.tsx` (persona flow: server picks, client reports back)

**Interfaces:**
- Consumes: `post` helper + `GatewayRequestError` (Task 3), `validateSetup`/`validateMessages` (Task 3), `pickPersona`/`getPersona`/`buildInterviewerSystemInstruction`/`MODELS.TEXT_CHEF_CHAIN` (Task 2), `applyCors`/`sendError` (Task 1).
- Produces: `ChatRequest`/`ChatResponse` types (below); `sendChatTurn(body: ChatRequest): Promise<ChatResponse>`; new `InterviewChat` props `{ resume: ResumeData; lastPersonaId?: string; onPersonaPicked: (p: { id: string; name: string }) => void; onFinish; onCancel }`; App's `handlePersonaPicked` callback (reused by Task 5's `VoiceInterview`); **transitional** `voicePersona` state in App (removed in Task 5).

- [ ] **Step 1: Add the chat contract to `lib/gatewayTypes.ts`**

```ts
export interface ChatRequest {
  setup: ResumeData;
  /** Full history so far (client-rendered shape); [] on the first turn. */
  messages: InterviewMessage[];
  /** Echo of the first response's sessionId on subsequent turns. */
  sessionId?: string;
  /** Echo of the first response's personaId — keeps the persona stable per session. */
  personaId?: string;
  /** Anti-repeat hint (localStorage), meaningful on the first turn only. */
  lastPersonaId?: string;
}

export interface ChatResponse {
  sessionId: string;
  personaId: string;
  personaName: string;
  reply: string;
}
```

- [ ] **Step 2: Implement `api/chat.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { applyCors } from './_lib/cors';
import { sendError } from './_lib/http';
import { validateSetup, validateMessages } from './_lib/validate';
import { MODELS, getPersona, pickPersona, buildInterviewerSystemInstruction } from './_lib/prompts';
import type { ChatRequest, ChatResponse } from '../lib/gatewayTypes';

// The hidden opening user turn — moved from InterviewChat.tsx's initChat.
const KICKOFF = 'Hello. Please introduce yourself and start the interview.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const key = process.env.GEMINI_API_KEY;
  if (!key) return sendError(res, 500, 'server_misconfigured', 'GEMINI_API_KEY unset');

  const body = (req.body ?? {}) as ChatRequest;
  const setup = validateSetup(body.setup);
  if (!setup.ok) return sendError(res, 400, 'bad_request', `chat: ${setup.reason}`);
  const messages = validateMessages(body.messages);
  if (!messages.ok) {
    if (messages.reason === 'turn_limit') return sendError(res, 429, 'turn_limit');
    return sendError(res, 400, 'bad_request', `chat: ${messages.reason}`);
  }

  const persona = typeof body.personaId === 'string'
    ? getPersona(body.personaId)
    : pickPersona(typeof body.lastPersonaId === 'string' ? body.lastPersonaId : undefined);
  if (!persona) return sendError(res, 400, 'bad_request', `chat: unknown personaId ${body.personaId}`);

  const contents = [
    { role: 'user' as const, parts: [{ text: KICKOFF }] },
    ...messages.value.map(m => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content }],
    })),
  ];

  const ai = new GoogleGenAI({ apiKey: key });
  let lastErr: unknown;
  for (const model of MODELS.TEXT_CHEF_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: { systemInstruction: buildInterviewerSystemInstruction(setup.value, persona) },
      });
      const reply = response.text;
      if (!reply) {
        lastErr = `empty reply from ${model}`;
        continue;
      }
      const out: ChatResponse = {
        sessionId: typeof body.sessionId === 'string' && body.sessionId
          ? body.sessionId
          : crypto.randomUUID(),
        personaId: persona.id,
        personaName: persona.name,
        reply,
      };
      res.status(200).json(out);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  sendError(res, 502, 'upstream_error', lastErr);
}
```

- [ ] **Step 3: Add `sendChatTurn` to `services/apiClient.ts`**

Add the import and function:

```ts
import type { GatewayError, ChatRequest, ChatResponse } from '../lib/gatewayTypes';

export function sendChatTurn(body: ChatRequest): Promise<ChatResponse> {
  return post<ChatResponse>('/api/chat', body);
}
```

- [ ] **Step 4: Rewrite `components/InterviewChat.tsx` onto the gateway**

Full replacement of the logic portion (the `ThemedTextInterviewChrome` render block at the bottom is unchanged):

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { InterviewMessage, ResumeData } from '../types';
import { sendChatTurn } from '../services/apiClient';
import ThemedTextInterviewChrome from './theme/ThemedTextInterviewChrome';

interface InterviewChatProps {
  resume: ResumeData;
  lastPersonaId?: string;
  onPersonaPicked: (persona: { id: string; name: string }) => void;
  onFinish: (transcript: InterviewMessage[]) => void;
  onCancel: () => void;
}

const InterviewChat: React.FC<InterviewChatProps> = ({
  resume, lastPersonaId, onPersonaPicked, onFinish, onCancel,
}) => {
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // Server-issued ids, echoed on every turn so the persona stays stable.
  const sessionRef = useRef<{ sessionId?: string; personaId?: string }>({});
  // Same StrictMode double-mount guard as VoiceInterview.
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    const initChat = async () => {
      setIsTyping(true);
      try {
        const res = await sendChatTurn({ setup: resume, messages: [], lastPersonaId });
        sessionRef.current = { sessionId: res.sessionId, personaId: res.personaId };
        onPersonaPicked({ id: res.personaId, name: res.personaName });
        setMessages([{ role: 'assistant', content: res.reply, timestamp: Date.now() }]);
      } catch (err) {
        console.error('Chat init error:', err);
      } finally {
        setIsTyping(false);
      }
    };
    initChat();
  }, [resume, lastPersonaId, onPersonaPicked]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping || messages.length === 0) return;

    const userMessage: InterviewMessage = { role: 'user', content: input, timestamp: Date.now() };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setIsTyping(true);

    try {
      const res = await sendChatTurn({ setup: resume, messages: history, ...sessionRef.current });
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply, timestamp: Date.now() }]);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <ThemedTextInterviewChrome
      /* …exact same props as before — unchanged… */
    />
  );
};

export default InterviewChat;
```

Notes: the `GoogleGenAI`/`Chat`/`MODELS`/`buildInterviewerSystemInstruction` imports and the dead `"concludes our interview"` check are removed; the guard `messages.length === 0` stops sends before the intro arrives.

- [ ] **Step 5: Rewire App.tsx (text path; voice keeps a transitional shim)**

In `App.tsx`:

1. Line 13 import becomes: `import { LAST_PERSONA_STORAGE_KEY, pickPersona, InterviewerPersona } from './constants';` (unchanged for now — `pickPersona` still feeds the voice shim until Task 5).
2. Line 32: split the persona state:

```tsx
  // Server-picked persona (id+name only — fragments never reach the client).
  const [currentPersona, setCurrentPersona] = useState<{ id: string; name: string } | null>(null);
  // TRANSITIONAL (removed in the live-token task): voice mode still picks
  // client-side until /api/live-token exists.
  const [voicePersona, setVoicePersona] = useState<InterviewerPersona | null>(null);
```

3. Replace `startInterview` (lines 106–116):

```tsx
  const startInterview = (mode: AppStage.INTERVIEWING_VOICE | AppStage.INTERVIEWING_TEXT) => {
    setCurrentPersona(null);
    setCurrentMode(mode === AppStage.INTERVIEWING_VOICE ? 'voice' : 'text');
    setDisplayPersonaName(null);
    if (mode === AppStage.INTERVIEWING_VOICE) {
      // TRANSITIONAL: old client-side pick, voice only (removed in Task 5).
      const lastId = localStorage.getItem(LAST_PERSONA_STORAGE_KEY) ?? undefined;
      const persona = pickPersona(lastId);
      setVoicePersona(persona);
      setCurrentPersona({ id: persona.id, name: persona.name });
      localStorage.setItem(LAST_PERSONA_STORAGE_KEY, persona.id);
    }
    setStage(mode);
  };

  // Called by the interview components when the server's first response
  // resolves the persona. Persisting immediately (before the interview
  // completes) keeps the deliberate anti-repeat-even-if-user-backs-out behavior.
  const handlePersonaPicked = React.useCallback((p: { id: string; name: string }) => {
    setCurrentPersona(p);
    localStorage.setItem(LAST_PERSONA_STORAGE_KEY, p.id);
  }, []);
```

4. The `INTERVIEWING_TEXT` render case (line 285) no longer gates on `currentPersona` (it resolves async now):

```tsx
      case AppStage.INTERVIEWING_TEXT: return (
        <InterviewChat
          resume={resumeData}
          lastPersonaId={localStorage.getItem(LAST_PERSONA_STORAGE_KEY) ?? undefined}
          onPersonaPicked={handlePersonaPicked}
          onFinish={processInterviewResults}
          onCancel={() => setStage(AppStage.INTERVIEW_MODE)}
        />
      );
```

5. The `INTERVIEWING_VOICE` case swaps its gate to the shim: `return voicePersona ? (<VoiceInterview resume={resumeData} persona={voicePersona} …unchanged… />) : renderInterviewMode();`

`processInterviewResults` (line 149) already reads `currentPersona?.name` — works for both paths unchanged.

- [ ] **Step 6: Verify — tests, typecheck, live text interview**

Run: `npx vitest run && npx tsc --noEmit` — expected: pass/clean.

With `npm run dev:full`: run a full **text** interview in the browser. Confirm: intro message arrives; multi-turn conversation coheres (persona voice consistent across turns); finishing shows Debrief with the persona name revealed; a second interview draws a *different* persona (anti-repeat). Then run a **voice** interview and confirm it still works via the shim (old client-key path).

Curl the turn ceiling:

```bash
node -e '
const msgs = Array.from({length: 81}, (_, i) => ({ role: i % 2 ? "user" : "assistant", content: "x", timestamp: 1 }));
console.log(JSON.stringify({ setup: { text: "", role: "Engineer", experienceLevel: "mid" }, messages: msgs }));
' > /tmp/turnlimit.json
curl -s -w '\n%{http_code}\n' http://localhost:3000/api/chat -H 'Content-Type: application/json' -d @/tmp/turnlimit.json
```

Expected: `{"error":{"code":"turn_limit",...}}` and `429`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(gateway): /api/chat with server-side persona pick; text mode off the client SDK"
```

---

### Task 5: `/api/live-token` + VoiceInterview swap (protected file — exact edits only)

**Files:**
- Modify: `lib/gatewayTypes.ts` (add live-token types)
- Create: `api/live-token.ts`
- Modify: `services/apiClient.ts` (add `mintLiveToken`)
- Modify: `components/VoiceInterview.tsx` (**only** the edits enumerated in Step 3)
- Modify: `App.tsx` (remove the Task-4 voice shim)

**Interfaces:**
- Consumes: `post` helper (Task 3), `validateSetup` (Task 3), `getPersona`/`pickPersona`/`buildInterviewerSystemInstruction`/`MODELS.VOICE_INTERVIEWER` (Task 2), `applyCors`/`sendError` (Task 1), `handlePersonaPicked` in App (Task 4).
- Produces: `LiveTokenRequest`/`LiveTokenResponse` types; `mintLiveToken(body: LiveTokenRequest): Promise<LiveTokenResponse>`; new `VoiceInterview` props `{ resume; lastPersonaId?: string; onPersonaPicked: (p: { id: string; name: string }) => void; onFinish; onCancel }`.

- [ ] **Step 1: Add the live-token contract + client function**

Append to `lib/gatewayTypes.ts`:

```ts
export interface LiveTokenRequest {
  setup: ResumeData;
  /** Anti-repeat hint, initial mint only. */
  lastPersonaId?: string;
  /** goAway reconnects need a fresh single-use token for the SAME persona. */
  reconnect?: boolean;
  /** Required when reconnect: true. */
  sessionId?: string;
  /** Required when reconnect: true. */
  personaId?: string;
}

export interface LiveTokenResponse {
  /** Ephemeral token name — used as the client apiKey with apiVersion v1alpha. */
  token: string;
  model: string;
  sessionId: string;
  personaId: string;
  personaName: string;
}
```

Append to `services/apiClient.ts` (extend the existing gatewayTypes import):

```ts
export function mintLiveToken(body: LiveTokenRequest): Promise<LiveTokenResponse> {
  return post<LiveTokenResponse>('/api/live-token', body);
}
```

- [ ] **Step 2: Implement `api/live-token.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Modality } from '@google/genai';
import { applyCors } from './_lib/cors';
import { sendError } from './_lib/http';
import { validateSetup } from './_lib/validate';
import { MODELS, getPersona, pickPersona, buildInterviewerSystemInstruction } from './_lib/prompts';
import type { LiveTokenRequest, LiveTokenResponse } from '../lib/gatewayTypes';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'method_not_allowed');
  const key = process.env.GEMINI_API_KEY;
  if (!key) return sendError(res, 500, 'server_misconfigured', 'GEMINI_API_KEY unset');

  const body = (req.body ?? {}) as LiveTokenRequest;
  const setup = validateSetup(body.setup);
  if (!setup.ok) return sendError(res, 400, 'bad_request', `live-token: ${setup.reason}`);

  let persona;
  if (body.reconnect) {
    if (typeof body.sessionId !== 'string' || typeof body.personaId !== 'string')
      return sendError(res, 400, 'bad_request', 'live-token: reconnect requires sessionId + personaId');
    persona = getPersona(body.personaId);
  } else {
    persona = pickPersona(typeof body.lastPersonaId === 'string' ? body.lastPersonaId : undefined);
  }
  if (!persona) return sendError(res, 400, 'bad_request', `live-token: unknown personaId ${body.personaId}`);

  // Phase 3 attaches quota here: initial mints charge one interview; reconnect
  // mints within the 30-minute session window don't (spec §3).

  // Ephemeral tokens require the v1alpha API surface.
  const ai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: 'v1alpha' } });
  const now = Date.now();
  try {
    const token = await ai.authTokens.create({
      config: {
        uses: 1, // single-use: each reconnect mints fresh (spec §3)
        expireTime: new Date(now + 30 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 2 * 60_000).toISOString(),
        // Config-locked (lockAdditionalFields: [] locks exactly these fields):
        // the system instruction, voice, and transcription settings never
        // reach the client. sessionResumption stays unlocked — the client
        // passes the varying resumption handle per connect.
        liveConnectConstraints: {
          model: MODELS.VOICE_INTERVIEWER,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.voiceId } },
            },
            systemInstruction: buildInterviewerSystemInstruction(setup.value, persona),
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        },
        lockAdditionalFields: [],
      },
    });
    if (!token.name) return sendError(res, 502, 'upstream_error', 'live-token: token minted without name');

    const out: LiveTokenResponse = {
      token: token.name,
      model: MODELS.VOICE_INTERVIEWER,
      sessionId: body.reconnect && body.sessionId ? body.sessionId : crypto.randomUUID(),
      personaId: persona.id,
      personaName: persona.name,
    };
    res.status(200).json(out);
  } catch (err) {
    sendError(res, 502, 'upstream_error', err);
  }
}
```

Verify the mint against the real API before touching VoiceInterview — with `npm run dev:full` running:

```bash
curl -s http://localhost:3000/api/live-token -H 'Content-Type: application/json' \
  -d '{"setup":{"text":"","role":"Engineer","experienceLevel":"mid"}}' | head -c 300
```

Expected: JSON with `"token":"auth_tokens/…"`, `"model":"gemini-3.1-flash-live-preview"`, a `sessionId` UUID, and a persona. If this 502s, stop and debug the mint (SDK version, v1alpha availability) before any client edits.

- [ ] **Step 3: Edit `components/VoiceInterview.tsx` — exactly these changes, nothing else**

**Do not touch:** `decode`, `decodeAudioData`, `flushBuffers`, the getUserMedia constraints, worklet setup, all `onmessage` audio/text/lifecycle handling, `onerror`/`onclose`, the mic-sender `workletNode.port.onmessage`, the cleanup effect, wake-lock effect, camera logic, gesture overlay, mute, the render block.

**(a) Imports (lines 3–4):** replace

```ts
import { GoogleGenAI, Modality } from '@google/genai';
import { MODELS, buildInterviewerSystemInstruction, InterviewerPersona } from '../constants';
```

with

```ts
import { GoogleGenAI } from '@google/genai';
import { mintLiveToken } from '../services/apiClient';
```

**(b) Props (lines 14–19):** replace `persona: InterviewerPersona;` with

```ts
  lastPersonaId?: string;
  onPersonaPicked: (persona: { id: string; name: string }) => void;
```

and update the destructuring on line 21 accordingly (`{ resume, lastPersonaId, onPersonaPicked, onFinish, onCancel }`).

**(c) New refs** (next to `resumeHandleRef`, ~line 57):

```ts
  // Server-issued ids from the initial token mint; reconnect mints echo them
  // so the locked system instruction/voice stay identical across sockets.
  const sessionIdRef = useRef<string | null>(null);
  const personaIdRef = useRef<string | null>(null);
```

**(d) Remove line 106** (`const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });`) — the client is now constructed per-token inside `connectLive`.

**(e) Replace `connectLive` (lines 143–155 head only — the `callbacks: { … }` object is untouched):**

```ts
      // Reconnectable: called on first connect and again on `goAway`, always
      // via sessionPromiseRef so the mic-audio sender below never targets a
      // closed socket. Ephemeral tokens are single-use, so every (re)connect
      // mints a fresh one; everything except the resumption handle is locked
      // into the token server-side. `sessionResumption: {}` (not omission) is
      // required even on the very first connect — that's what makes the
      // server start sending back the resumption handles we'll need later.
      const connectLive = async (resumeHandle?: string): Promise<any> => {
        const isReconnect = personaIdRef.current !== null;
        const minted = await mintLiveToken(
          isReconnect
            ? { setup: resume, reconnect: true, sessionId: sessionIdRef.current!, personaId: personaIdRef.current! }
            : { setup: resume, lastPersonaId }
        );
        if (!isReconnect) {
          sessionIdRef.current = minted.sessionId;
          personaIdRef.current = minted.personaId;
          onPersonaPicked({ id: minted.personaId, name: minted.personaName });
        }
        const ai = new GoogleGenAI({ apiKey: minted.token, httpOptions: { apiVersion: 'v1alpha' } });
        return ai.live.connect({
          model: minted.model,
          config: {
            sessionResumption: resumeHandle ? { handle: resumeHandle } : {}
          },
          callbacks: {
            /* …UNCHANGED — the entire existing callbacks object… */
          }
        });
      };
```

**(f) Harden the goAway reconnect against mint failure** — inside the existing `if (signal.goAway …)` block, wrap only the reconnect assignment (lines 222–223) in try/catch:

```ts
                if (!isUnmountedRef.current) {
                  try {
                    sessionPromiseRef.current = connectLive(resumeHandleRef.current);
                    sessionRef.current = await sessionPromiseRef.current;
                  } catch (err) {
                    console.error('Reconnect failed (token mint or connect):', err);
                    setStatus('idle');
                  }
                }
                isReconnectingRef.current = false;
```

**(g) `startSession` dependency array (line 261):** `[resume, persona, flushBuffers]` → `[resume, lastPersonaId, onPersonaPicked, flushBuffers]`. (`handlePersonaPicked` is `useCallback`-stable in App; the `isInitializedRef` guard covers the rest.)

- [ ] **Step 4: Remove the Task-4 shim from App.tsx**

1. Import line 13 becomes: `import { LAST_PERSONA_STORAGE_KEY } from './constants';` (`pickPersona` and `InterviewerPersona` no longer imported).
2. Delete the `voicePersona` state line and the `if (mode === AppStage.INTERVIEWING_VOICE) { … }` shim block inside `startInterview`.
3. `INTERVIEWING_VOICE` render case mirrors the text case:

```tsx
      case AppStage.INTERVIEWING_VOICE: return (
        <VoiceInterview
          resume={resumeData}
          lastPersonaId={localStorage.getItem(LAST_PERSONA_STORAGE_KEY) ?? undefined}
          onPersonaPicked={handlePersonaPicked}
          onFinish={(transcript) => processInterviewResults(transcript.map(t => ({
            role: t.startsWith('Candidate') ? 'user' : 'assistant',
            content: t.split(': ')[1] || '',
            timestamp: Date.now()
          })))}
          onCancel={() => setStage(AppStage.INTERVIEW_MODE)}
        />
      );
```

- [ ] **Step 5: Verify — tests, typecheck, live voice interview**

Run: `npx vitest run && npx tsc --noEmit` — expected: pass/clean.

With `npm run dev:full`: run a full **voice** interview. Confirm: connection opens (interviewer speaks), live transcript accumulates, mute/camera work, finishing produces the Debrief with the persona revealed, and the persona voice matches (six runs would cycle voices — spot-check one). Check the network tab: the only Gemini-bound credential is the `auth_tokens/…` string; no `AIza…` key anywhere. A real `goAway` reconnect can't be forced locally (sessions time out at ~10+ min) — the deploy task's long-run test covers it; the code path is the same `connectLive` that just ran.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(gateway): /api/live-token with config-locked ephemeral tokens; voice off the client key"
```

---

### Task 6: Strip the client — key, prompts, dead exports

**Files:**
- Modify: `constants.ts` (slim to client-safe exports)
- Modify: `constants.test.ts` (drop tests for moved material)
- Delete: `lib/evaluatorPrompt.ts`, `lib/evaluatorPrompt.test.ts` (moved to `api/_lib/` in Task 2)
- Modify: `.env.local` (remove `VITE_GEMINI_API_KEY`)

**Interfaces:**
- Consumes: nothing new.
- Produces: final `constants.ts` surface: `PersonaPublic`, `INTERVIEWER_PERSONAS: PersonaPublic[]` (same export name — `components/theme/personal-best/Home.tsx` and `components/theme/transcript/Home.tsx` keep using `.name` unchanged), `LAST_PERSONA_STORAGE_KEY`. Everything else is gone from the client.

- [ ] **Step 1: Rewrite `constants.ts` to its final client-safe form**

```ts
// Client-safe constants only. Prompt text, persona fragments, voice mappings,
// and model ids live server-side in api/_lib/prompts.ts — nothing here may
// reveal how the interviewer is prompted.

export interface PersonaPublic {
  id: string;
  name: string;
}

// Public roster (names appear in Home marketing copy and the Debrief reveal).
// api/_lib/prompts.ts composes these with the private fragments — ids must
// stay in sync with PERSONA_PRIVATE there (prompts.test.ts enforces it).
export const INTERVIEWER_PERSONAS: PersonaPublic[] = [
  { id: 'skeptic', name: 'The Skeptic' },
  { id: 'warm-mentor', name: 'The Warm Mentor' },
  { id: 'rapid-fire', name: 'The Rapid-Fire Screener' },
  { id: 'socratic', name: 'The Socratic Probe' },
  { id: 'director', name: 'The Seasoned Director' },
  { id: 'examiner', name: 'The Neutral Examiner' },
];

export const LAST_PERSONA_STORAGE_KEY = 'hireprep_last_persona_v1';
```

- [ ] **Step 2: Rewrite `constants.test.ts` to match**

```ts
import { describe, it, expect } from 'vitest';
import { INTERVIEWER_PERSONAS, LAST_PERSONA_STORAGE_KEY } from './constants';

describe('INTERVIEWER_PERSONAS (public roster)', () => {
  it('has six personas with unique ids and non-empty names', () => {
    expect(INTERVIEWER_PERSONAS).toHaveLength(6);
    expect(new Set(INTERVIEWER_PERSONAS.map(p => p.id)).size).toBe(6);
    for (const p of INTERVIEWER_PERSONAS) expect(p.name.length).toBeGreaterThan(0);
  });

  it('exposes a stable localStorage key', () => {
    expect(LAST_PERSONA_STORAGE_KEY).toBe('hireprep_last_persona_v1');
  });
});
```

- [ ] **Step 3: Delete the moved lib files and the client key**

```bash
git rm lib/evaluatorPrompt.ts lib/evaluatorPrompt.test.ts
```

Edit `.env.local`: delete the `VITE_GEMINI_API_KEY=…` line (the `GEMINI_API_KEY` line from Task 1 stays).

- [ ] **Step 4: Verify nothing still references the removed surface**

```bash
cd /Users/hnsk/Projects/hireprep-ai
grep -rn "VITE_GEMINI_API_KEY" --include='*.ts' --include='*.tsx' --include='*.html' . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=docs
grep -rn "buildInterviewerSystemInstruction\|SYSTEM_INSTRUCTION_FEEDBACK\|pickPersona\|InterviewerPersona\b" --include='*.tsx' components App.tsx index.tsx
```

Expected: **no output** from either (all remaining references live under `api/`). If anything surfaces, fix that import before proceeding. Also check `README.md` for `VITE_GEMINI_API_KEY` setup instructions and update them to `GEMINI_API_KEY` + `npm run dev:full`.

Run: `npx vitest run && npx tsc --noEmit` — expected: pass/clean. Restart `npm run dev:full` (env change) and re-run one quick text interview to confirm nothing client-side needed the deleted env var.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(gateway): strip client of API key and all prompt material"
```

---

### Task 7: Bundle leak check

**Files:**
- Create: `scripts/check-bundle.mjs`
- Modify: `package.json` (script)

**Interfaces:**
- Consumes: `dist/` produced by `npm run build`.
- Produces: `npm run check:bundle` — exits 1 if the built assets contain a Gemini key, the old env var name, or server-side prompt text. This is the spec §9 CI-able check.

- [ ] **Step 1: Write `scripts/check-bundle.mjs`**

```js
// Scans the built client bundle for material that must never ship:
// the Gemini API key (or its env-var name) and server-side prompt text.
// Spec: docs/superpowers/specs/2026-07-11-billing-and-variants-design.md §9.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist', import.meta.url).pathname;

const FORBIDDEN = [
  { name: 'Gemini API key', pattern: /AIza[0-9A-Za-z_-]{30,}/ },
  { name: 'old client key env name', pattern: /VITE_GEMINI_API_KEY/ },
  // Sentinels for the two server-side prompt bodies (persona fragment + evaluator):
  { name: 'persona fragment text', pattern: /evidence-driven interviewer/ },
  { name: 'evaluator prompt text', pattern: /ACCOUNT FOR TRANSCRIPTION ARTIFACTS/ },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

let failed = false;
for (const file of walk(DIST)) {
  const text = readFileSync(file, 'latin1');
  for (const { name, pattern } of FORBIDDEN) {
    if (pattern.test(text)) {
      console.error(`LEAK: ${name} found in ${file}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log('check-bundle: clean — no key or prompt material in dist/');
```

- [ ] **Step 2: Wire it up and verify it fails on a planted leak**

Add to `package.json` scripts: `"check:bundle": "npm run build && node scripts/check-bundle.mjs"`.

First prove the check can fail: `echo 'const x = "VITE_GEMINI_API_KEY";' >> dist/assets/$(ls dist/assets | head -1)` after a build, run `node scripts/check-bundle.mjs`, expect `LEAK:` + exit 1. Then rebuild clean:

Run: `npm run check:bundle`
Expected: `check-bundle: clean — no key or prompt material in dist/`, exit 0.

- [ ] **Step 3: Full-suite gate and commit**

Run: `npx vitest run && npx tsc --noEmit && npm run check:bundle` — all green.

```bash
git add scripts package.json
git commit -m "chore(gateway): bundle leak check for key and prompt material"
```

---

### Task 8: Deploy, end-to-end verification, docs

**Files:**
- Modify: Vercel project env (via CLI — needs the user for the key value)
- Modify: `CLAUDE.md` (project — API-key wiring + gateway sections)
- Modify: `/Volumes/2025_exSSD_2tb/hire-prep-iterations/hire-prep/hireprep-mobile/CLAUDE.md` (spec §8 note)

**Interfaces:**
- Consumes: everything prior.
- Produces: a working preview deployment with zero client-side key; updated docs.

- [ ] **Step 1: Set the server env vars on Vercel**

The Gemini key must be added to the Vercel project for all environments. **Ask the user to run** (or approve running — the value is the same key currently in `.env.local`):

```bash
cd /Users/hnsk/Projects/hireprep-ai
vercel env add GEMINI_API_KEY production
vercel env add GEMINI_API_KEY preview
vercel env add GEMINI_API_KEY development
```

(`ALLOWED_ORIGINS` is not needed — the code defaults cover localhost + production, and previews pass via same-origin.)

- [ ] **Step 2: Push and verify the preview deployment**

```bash
git push origin gateway
```

Vercel builds a preview. Then against the preview URL (from `vercel ls` or the dashboard):

```bash
curl -s https://<preview-url>/api/health
```

Expected: `{"ok":true,"hasKey":true}`. In the browser on the preview URL: one full text interview, one full voice interview (this is also the phone-testable URL). For the goAway reconnect (spec §9): let a voice interview run past the Live API session limit (~10–15 min of connection) and confirm the status flips to `connecting` then recovers — watch the function logs (`vercel logs <preview-url>`) for a second `/api/live-token` hit with `reconnect: true`.

- [ ] **Step 3: Update the docs**

In `~/Projects/hireprep-ai/CLAUDE.md`: rewrite the **API-key wiring** bullet — the key is now server-side only (`GEMINI_API_KEY` in Vercel env + `.env.local` for `vercel dev`); `VITE_GEMINI_API_KEY` is gone; local dev needing `/api` uses `npm run dev:full`; plain `npm run dev`/`dev:phone` need `VITE_API_BASE` pointed at a deployment. Add a short **Gateway** section: the four endpoints, `api/_lib/prompts.ts` as the prompt home, the client-must-not-import-`api/_lib` rule, and `npm run check:bundle`.

In `hireprep-mobile/CLAUDE.md` (on the external drive): add a note that the web app moved to a server-side gateway (phase 1 of the billing spec) on this date; mobile keeps `EXPO_PUBLIC_GEMINI_API_KEY` until its shipping phase migrates it (spec §8).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: gateway architecture + server-side key wiring"
git -C /Volumes/2025_exSSD_2tb/hire-prep-iterations/hire-prep/hireprep-mobile status
# commit the mobile CLAUDE.md note in its own repo:
git -C /Volumes/2025_exSSD_2tb/hire-prep-iterations/hire-prep/hireprep-mobile add CLAUDE.md
git -C /Volumes/2025_exSSD_2tb/hire-prep-iterations/hire-prep/hireprep-mobile commit -m "docs: note web-app gateway migration; mobile key posture unchanged"
git push origin gateway
```

**Merge is NOT part of this plan** — `gateway` merges only after `theme-redesign` → `main` lands and the user has tested the preview (merging to `main` auto-deploys production and needs explicit user confirmation).
