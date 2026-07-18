# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HirePrep AI is a React-based interview preparation platform that uses Google's Gemini AI models to conduct mock interviews and provide feedback. The app supports both text-based chat interviews and real-time voice interviews with live audio streaming.

Originally exported from AI Studio: https://ai.studio/apps/drive/1TIYx1gtieBIFb6y3jSJE7cKMYSZKVIx4

## Development Commands

**Install dependencies:**
```bash
npm install
```

**Run development server:**
```bash
npm run dev
```
The app runs on `http://localhost:3000` (configured in vite.config.ts)

**Run development server with HTTPS on LAN (for phone testing):**
```bash
npm run dev:phone
```
`getUserMedia` requires a secure context — plain `http://<lan-ip>` is refused by mobile browsers. This mode activates `@vitejs/plugin-basic-ssl` to serve self-signed HTTPS on all interfaces. Find the Mac's LAN IP with `ipconfig getifaddr en0`, then open `https://<mac-lan-ip>:3000` on the phone. iOS Safari will show "This connection is not private" — tap Show Details → "visit this website" to accept the cert. `strictPort` is on for this mode: if port 3000 is already taken the server fails loudly rather than silently bumping to another port.

**Build for production:**
```bash
npm run build
```

**Preview production build:**
```bash
npm run preview
```

## Environment Setup

The Gemini API key is **server-side only** (as of the gateway phase, Jul 2026):
- Set `GEMINI_API_KEY` in `.env.local` (never a bare `.env` — it isn't gitignored). The same var is set in Vercel project env for all three environments.
- There is no `VITE_`-prefixed key anywhere — nothing key-like may ship in the bundle (`npm run check:bundle` enforces this after a build).
- Local dev that exercises interviews needs the functions: use `npm run dev:full` (sources `.env.local`, runs a current `vercel dev`; the stale global CLI is broken for ESM functions). Plain `npm run dev`/`dev:phone` serve no `/api` — point them at a deployment with `VITE_API_BASE` if needed.

## Backend gateway (`api/`)

All Gemini access goes through Vercel functions: `/api/chat` (text turns; server picks the persona, issues a `sessionId`, enforces a 40-turn ceiling), `/api/evaluate` (post-interview scoring), `/api/live-token` (voice; single-use config-locked ephemeral tokens — system instruction and voice never reach the client; `goAway` reconnects mint fresh tokens for the same persona), `/api/health`. Shared modules live in `api/_lib/` — **client code must never import from `api/_lib/`**; that boundary is what keeps prompt material (persona fragments, evaluator instructions, model ids — all in `api/_lib/prompts.ts`) out of the bundle. `constants.ts` retains only public persona names. Two build-shape constraints, learned the hard way: `api/` has its own CommonJS package scope (`api/package.json` + `api/tsconfig.json`) because Vercel's builder does per-file transpile with no bundling, and no runtime import may cross the `api/` boundary (type-only imports are fine; `prompts.test.ts` drift-guards the by-value persona roster against `constants.ts`).

## Architecture

### Core Application Flow (App.tsx)

The app uses a stage-based state machine defined by the `AppStage` enum:

1. **LANDING** - Dashboard with history of past interviews
2. **RESUME_UPLOAD** - User inputs resume, role, and experience level
3. **INTERVIEW_MODE** - User chooses voice or text interview
4. **INTERVIEWING_TEXT** - Chat-based interview using `InterviewChat` component
5. **INTERVIEWING_VOICE** - Live audio interview using `VoiceInterview` component
6. **FEEDBACK** - AI-generated performance analysis and transcript

Interview history persists to localStorage under key `hireprep_history_v1`.

### Gemini Models (constants.ts)

The app uses three different Gemini models for different purposes:

- **TEXT_CHEF**: `gemini-3.5-flash` - Text-based chat interviews (moved off `gemini-2.5-flash` 2026-07-06; that model has an announced Oct 16, 2026 shutdown with `gemini-3.5-flash` as Google's designated GA replacement)
- **VOICE_INTERVIEWER**: `gemini-3.1-flash-live-preview` - Real-time voice with audio streaming (stays on preview — the entire Gemini Live API is still pre-GA; no GA alternative exists for realtime audio-to-audio as of 2026-07-06)
- **EVALUATOR**: `gemini-3.5-flash` - Generates feedback with structured JSON output (moved off the preview `gemini-3-flash-preview` 2026-07-06, per Google's own migration guidance)

### Voice Interview Architecture (VoiceInterview.tsx)

The voice interview component uses Gemini's Live API with bidirectional audio streaming:

**Audio Processing Chain:**
1. User's microphone input → 16kHz PCM encoding
2. Continuous streaming to Gemini Live API via `sendRealtimeInput`
3. AI response audio (24kHz) decoded and queued for playback
4. Transcriptions accumulated in background buffers
5. Text buffers flushed to transcript on `turnComplete` events

**Key Technical Details:**
- Two separate AudioContext instances (input: 16kHz, output: 24kHz)
- Audio playback uses buffering with `nextStartTimeRef` to prevent gaps
- Interruption handling: stops all playing audio sources when user speaks
- Transcription is collected asynchronously to avoid blocking audio pipeline
- Volume visualization driven by RMS calculation from input samples
- Audio capture: `echoCancellation: true`, `noiseSuppression: false`, `autoGainControl: false` — suppression and AGC are intentionally off to avoid degrading the audio Gemini receives
- The recorder worklet resamples from the actual AudioContext rate to 16kHz (`lib/resample.ts`, embedded into the worklet string via `createResampler.toString()`; the function must stay self-contained — no imports, no outer-scope references, no backticks). iOS Safari ignores the requested 16kHz context rate and typically runs at 48kHz; the resampler keeps the Live API's `audio/pcm;rate=16000` contract true.
- VoiceInterview shows a tap-to-begin overlay when AudioContexts start suspended (iOS autoplay policy) and resumes them inside the user gesture (`handleBeginTap`).
- A screen wake lock is held during voice interviews (`navigator.wakeLock.request('screen')`), re-acquired on tab re-focus via `visibilitychange`, no-op where unsupported.
- Initialization guard (`isInitializedRef`) prevents duplicate session creation in React strict mode

### Text Interview Architecture (InterviewChat.tsx)

Uses Gemini's Chat API (`ai.chats.create`) with a persistent conversation thread. The chat is initialized with system instructions including the candidate's resume, role, and experience level.

### Feedback Generation (geminiService.ts)

Uses structured output with a JSON schema to ensure consistent feedback format:
- `score` (number 0-100)
- `strengths` (array of strings)
- `improvements` (array of strings)
- `detailedAnalysis` (string)
- `suggestions` (array; populated only when `score < 70`) — per-reply `{ replyIndex, critique, modelAnswer }` coaching on the weakest user answers, surfaced inline in the transcript and included in the Markdown export.

The EVALUATOR model receives the full resume data and interview transcript.

## Data Types (types.ts)

Core interfaces:
- **ResumeData** - Resume text, target role, experience level
- **InterviewMessage** - Chat messages with role (user/assistant), content, timestamp
- **InterviewFeedback** - Structured feedback from AI evaluator
- **HistoryEntry** - Complete record of an interview session with resume, transcript, and feedback

## System Instructions (constants.ts)

The interviewer prompt is split into a **frozen functional core + a per-session persona layer**, assembled by `buildInterviewerSystemInstruction(resume, persona)`:

- `INTERVIEWER_CORE` holds the load-bearing rules that personas can never override: English-only output, one question at a time, ~5–7 questions, role-calibrated substance, a concision floor, and the verbatim closing line (`"Thank you for your time. This concludes our interview."`). STAR is **not** in the core — it was deliberately decoupled (it's a generic framework that misfits many target roles, and contradicted the evaluator's role-weighting). STAR now survives only as one option inside the personas that suit it (e.g. The Neutral Examiner).
- `INTERVIEWER_PERSONAS` is a roster of six interviewers (The Skeptic, The Warm Mentor, The Rapid-Fire Screener, The Socratic Probe, The Seasoned Director, The Neutral Examiner). Each carries a flavor `fragment` and a mapped `voiceId`. `pickPersona(excludeId?)` selects one at random per interview with anti-repeat (last id persisted in `localStorage` under `hireprep_last_persona_v1`), so the same interviewer never appears twice in a row. The persona is hidden during the interview and revealed only on the feedback screen ("Interviewed by …") and in the Markdown export.
- The persona drives the voice in voice mode (the old manual voice picker was removed); `INTERVIEWER_VOICES` remains as the set those `voiceId`s map to.
- `SYSTEM_INSTRUCTION_FEEDBACK` (the evaluator prompt) still enforces **English output** and its ASR/role-weighting logic, and is deliberately **never told the persona** so scoring stays calibrated to substance, not to which interviewer was assigned.

Design/plan: `docs/superpowers/specs/2026-06-02-randomized-interviewer-personas-design.md` and `docs/superpowers/plans/2026-06-02-randomized-interviewer-personas.md`.

> Note: text and voice interviews both end via a manual button. `InterviewChat.tsx` checks for the `concludes our interview` substring but the block is currently an empty no-op (pre-existing) — the closing line is preserved verbatim but does not yet auto-end the session.

## Technical Stack

- React 19 with TypeScript
- Vite for build tooling
- Google GenAI SDK (`@google/genai`) for all AI interactions
- Web Audio API for voice processing
- Tailwind CSS classes for styling (utility-first approach)
- LocalStorage for persistence

## Deployment

- **Vercel project**: `hireprep-ai` — linked via `.vercel/` (gitignored).
- **GitHub repo**: `closestfriend/hireprep-ai` — connected for auto-deploys: `main` → production, branches → preview deployments.
- **Production alias**: https://hireprep-ai-nine.vercel.app
- **Environment variables**: `GEMINI_API_KEY` (server-side, used by `/api` functions) is set in Vercel for all three environments. The legacy `VITE_GEMINI_API_KEY` is also still set there — **it must stay until the gateway branch merges to `main`** (production still builds from pre-gateway code); remove it after the merge.
- The API key no longer ships in the client bundle — the gateway phase (`docs/superpowers/specs/2026-07-11-billing-and-variants-design.md`, phase 1) moved all Gemini access server-side. `noindex` stays ON until phase 2 (auth) closes the anonymous-access window.
