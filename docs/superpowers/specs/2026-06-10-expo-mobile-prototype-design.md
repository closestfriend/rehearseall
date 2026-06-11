# Expo Mobile Prototype (Track B) — HirePrep as a real iOS/Android app

**Date:** 2026-06-10
**Status:** Approved
**Context:** Runs in parallel with the mobile-web pass (Track A, see `2026-06-10-mobile-web-phase1-design.md`). Hunter wants a real native app prototype he can hold and interact with — and **voice interviews are the centerpiece, not deferred**. Eventual target is both app stores (hence Expo/React Native over Swift). Primary test device: **iPhone**, built from Hunter's Mac.

This spec lives in `hireprep-ai/docs` for now as the workspace home base; copy it into `hireprep-mobile/docs` once that repo is scaffolded.

## Goal

A working Expo app at `hire-prep/hireprep-mobile/` (its own git repo, TypeScript) where Hunter can complete a full **voice interview** end to end on his iPhone, with text interviews and the full resume → interview → feedback → history flow also working.

## Why the structure below

Raw PCM mic capture requires native audio modules, so **Expo Go is off the table** — the project uses `expo-dev-client` from day one. The audio layer is the single biggest risk in the whole port, so it gets attacked first as an isolated spike before any app is built around it.

## Milestone 0 — Audio spike (prove or kill, first)

A bare dev build on the iPhone that does only this pipeline:

1. Capture mic audio and produce **16kHz PCM chunks** (the iPhone hardware rate is typically 48kHz — resampling is required, same as Track A's web fix; that logic ports conceptually intact).
2. Stream chunks to the **Gemini Live API** (`@google/genai` over WebSocket; React Native has WebSocket support) as `audio/pcm;rate=16000`.
3. Receive and play the **24kHz audio response** with gapless scheduling.

**Primary candidate:** Software Mansion's `react-native-audio-api` (a Web Audio API implementation for RN — closest conceptual match to the existing worklet architecture).
**Fallbacks if it can't deliver reliable raw PCM:** `react-native-webrtc` audio track, or a minimal custom native module.
**Exit criteria:** a spoken sentence gets a coherent spoken reply with acceptable latency, and input transcription text arrives. If no candidate passes within a few days of effort, stop and reassess (the web app remains the voice practice loop).

## Milestone 1 — App shell (can proceed in parallel with M0)

- Screens: landing/history → resume input → interview (text chat) → feedback. Native navigation, real-app feel; styling provisional (same de-templatizing-later rule as web).
- **Ported intact (by copy, not shared package):** `constants.ts` (personas, prompts, `pickPersona`, system-instruction builders), `types.ts`, evaluator logic from `geminiService.ts`. The `@google/genai` HTTP calls should work on RN fetch; fallback is plain REST to the same endpoints.
- **Text interviews fully working** (chat API is plain HTTPS — no native dependencies).
- **AsyncStorage** replaces localStorage: history (`hireprep_history_v1`-equivalent) and last-persona anti-repeat.
- **Resume input is paste-text-only.** `pdfjs-dist` requires a DOM and won't run in RN. (Later option: send PDF bytes directly to Gemini, which accepts PDF input — not v1.)
- Persona hidden during interview, revealed on feedback screen — same behavior as web.

## Milestone 2 — Voice integrated

The spike's pipeline wired into a real `VoiceInterview` screen, mirroring the web architecture:

- Persona `voiceId` → Live API `voiceConfig`.
- Input/output transcription buffering, flushed on `turnComplete`.
- Interruption handling (stop queued playback when the user talks over the AI).
- Status states (connecting/listening/speaking) and volume-driven UI.
- Echo cancellation posture matters more on a phone; configure capture accordingly (exact knobs depend on what the chosen audio library exposes — resolved during M0).

## Dev loop

- `expo-dev-client` dev build, installed via **Xcode local install** (free Apple ID, cable, app re-signs every 7 days).
- After the native build is on the device, JS changes hot-reload over the network like normal Expo; native rebuilds only when native deps change.
- Paid Apple Developer account ($99/yr) deferred until TestFlight/store time — shipping requires it anyway.

## Key posture

Same as Track A: Gemini key in the app via env/config for personal use; **ephemeral Live API tokens minted by a backend are the first task of the shipping phase**, and matter even more here (keys in shipped app binaries are extractable).

## Explicitly deferred

- PDF resume upload
- Markdown export / share sheet
- EAS/store builds, TestFlight distribution
- Visual design system (provisional styling rule)
- Android device testing (no Android device in hand; Expo keeps the door open)

## Verification

On the iPhone dev build:

1. Full **voice interview** end to end — connect, converse with persona voice, interruptions behave, finish.
2. Transcript quality is coherent (resampling bugs manifest as garbage transcription).
3. Full **text interview** end to end.
4. Feedback generates and renders; history persists across app restarts; persona anti-repeat works.

## Risks / open questions

- `react-native-audio-api` capability surface (raw PCM capture fidelity, worklet-equivalent processing) is unverified until M0 — that's the point of M0.
- `@google/genai` Live API (WebSocket) behavior under RN's WebSocket implementation is unverified; M0 covers it.
- iOS audio session management (route changes, headphones/AirPods, backgrounding) will surface device quirks; M0/M2 absorb them.
- 7-day re-sign friction on free Apple ID is accepted until a paid account exists.
