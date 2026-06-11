# Mobile Web Phase 1 — HirePrep on a phone via Vercel

**Date:** 2026-06-10
**Status:** Approved
**Context:** Hunter wants to (1) practice interviews on the go ASAP and (2) eventually ship to both iOS and Android app stores. Decision made: phased approach — mobile-web pass now (this spec), Expo/React Native port later when shipping to stores gets real. Native Swift was ruled out (iOS-only, zero code reuse, two extra codebases for a solo developer). Hosting target: Vercel (Netlify as fallback).

## Goal

Make the existing web app fully usable on a phone, deployed to Vercel. No React Native, no new project, no backend. Styling stays provisional — the de-templatizing visual pass happens separately before launch; this is a functional mobile pass.

## Out of scope

- PWA install / "Add to Home Screen" manifest (open in browser is fine for Phase 1)
- Expo/React Native port (Phase 2, separate spec)
- Ephemeral-token backend for API-key protection (first task of the shipping phase)
- Visual redesign / de-templatizing pass

## 1. Deploy & build hygiene

- Connect the `hireprep-ai` git repo to Vercel via GitHub: push → production deploy, branches → preview URLs.
- Set `VITE_GEMINI_API_KEY` in Vercel project env settings.
- Clean AI Studio export leftovers before first deploy:
  - Remove dead `<link rel="stylesheet" href="/index.css">` from `index.html` (file doesn't exist; 404s on every load).
  - Remove the esm.sh importmap for `react`/`react-dom`/`@google/genai` from `index.html` (Vite bundles these from npm; the map is dead weight with double-React risk).
  - Ensure `console-forward-plugin` applies only in dev (`apply: 'serve'` or equivalent), never in the production build.
- Tailwind stays on the CDN script for Phase 1. Moving to a build-time Tailwind setup belongs to the later design pass.

## 2. Mobile audio hardening (core work)

The recorder worklet currently assumes the input `AudioContext` runs at the requested 16kHz. iOS Safari frequently ignores the requested rate and runs at 48kHz, which would send 3×-slow audio to the Live API and produce garbage transcription.

- **Resample instead of assume:** the worklet reads the actual context `sampleRate` and downsamples to 16kHz before posting PCM chunks. The `audio/pcm;rate=16000` contract with the Live API is preserved. Harmless on desktop where the context honors 16kHz (resampler becomes identity).
- **Resume-on-gesture:** if either AudioContext comes up `suspended` (iOS autoplay policy), show a "Tap to begin" overlay; resume both contexts inside the tap handler.
- **Screen wake lock** during the interview via `navigator.wakeLock.request('screen')` (iOS 16.4+/Android Chrome; graceful no-op where unsupported), released on finish/cancel/unmount.
- `getUserMedia` audio constraints unchanged: `echoCancellation: true` (more important on a phone — speaker and mic are centimeters apart), `noiseSuppression: false`, `autoGainControl: false`.
- Output path needs no change: buffers are created tagged 24kHz and `AudioBufferSourceNode` auto-resamples to the actual output context rate.

**Stale-docs note:** project CLAUDE.md describes RMS silence-zeroing in the mic path, but neither `VoiceInterview.tsx` nor `lib/audioWorklet.ts` contains it — chunks are sent unconditionally. Sync the doc (or knowingly reintroduce the feature) as part of this work.

## 3. Responsive UI pass

- `index.html`: add `viewport-fit=cover` to the viewport meta; apply safe-area inset padding where edges are flush.
- Use `dvh` (not `vh`) for full-height screens.
- `VoiceInterview.tsx`: shrink desktop-scale padding (`py-12`, `p-10`) on small screens; replace the cramped `grid-cols-3` button row with thumb-sized touch targets (≥44px) that stack or reflow on narrow viewports; size the camera PiP for small screens.
- `InterviewChat.tsx`: keyboard-aware input pinned to the bottom (visualViewport handling), sane transcript height when the soft keyboard is open.
- Resume-upload screen: verify textarea and PDF file input ergonomics on mobile (file picker from phone Files app).
- Implementation should use the `mobile-ux-optimizer` skill for this section.

## 4. Phone test loop

Two loops, both set up:

- **Primary — Vercel preview deployments:** every push yields an HTTPS URL to open on the phone. (getUserMedia requires a secure context; plain `http://<LAN-IP>` dev fails on the phone.)
- **Local — LAN HTTPS dev:** add `@vitejs/plugin-basic-ssl` so the phone can hit the dev server over HTTPS on the LAN. This keeps `console-forward-plugin` useful: phone-browser logs stream into the terminal, which is essential when debugging the live audio path.

## 5. API-key posture (eyes open, Phase 1 only)

The Gemini key ships in the client bundle on a public URL. Accepted for personal practice under these conditions:

- The deployment URL stays unlisted/unshared.
- Restrictions and/or quota caps are set on the key in AI Studio / Google Cloud console.
- Optionally enable Vercel deployment protection if available on the plan.

The real fix — a Vercel serverless function minting short-lived ephemeral tokens for the Live API — is explicitly deferred to the shipping phase and is its first task.

## 6. Verification (real-device checklist)

On the actual phone, against a deployed preview URL:

1. Complete one full **voice interview** end to end — connect, converse, finish.
2. Confirm **transcript quality** (sample-rate bugs manifest as garbage transcription).
3. Complete one full **text interview**.
4. Confirm **feedback generation** renders, **history** persists (localStorage is per-device — phone history is separate from desktop; expected, not a bug), and **Markdown export** works on mobile.
5. Confirm screen stays awake during a voice interview and audio survives the session without the tab being suspended.
6. Camera PiP toggle works (front camera) or fails gracefully with the existing error message.

## Risks / open questions

- iOS Safari quirks beyond sample rate (e.g., AudioWorklet timing, echo cancellation quality on specific devices) may surface during device testing; the LAN-HTTPS + console-forward loop exists precisely to debug these.
- `getUserMedia` in installed-PWA standalone mode has a patchy history on iOS; irrelevant for Phase 1 (browser only) but a known check before ever adding a manifest.
