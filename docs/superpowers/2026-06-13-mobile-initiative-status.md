# Mobile Initiative — Status & Build Log

**As of:** 2026-06-13
**What this is:** the as-built home base for HirePrep's mobile push. The specs say what we intended; the plans say step-by-step how; **this says what actually exists right now and how to pick it back up.** Read this first when resuming.

---

## TL;DR

| Track | What | State | Backed up? |
|---|---|---|---|
| **A — Mobile web** | Harden the existing Vite/React app for phones; deploy to Vercel | **Shipped & live**, pending one human device test | ✅ GitHub `closestfriend/hireprep-ai` |
| **B — Expo native** | New native iOS/Android app, voice-first | **M0 audio spike built**, blocked on a tooling gap (full Xcode) | ✅ GitHub `closestfriend/hireprep-mobile` (private) |

**Live web app:** https://hireprep-ai-nine.vercel.app (any modern mobile browser; on iOS all browsers are WebKit so behavior matches Safari).

---

## The decision: why Expo, not Swift

Hunter's two goals were (1) practice interviews on the go ASAP and (2) eventually ship to **both** app stores. That second word decided it:

- **Swift buys only iOS.** Reaching Android would mean a second native rewrite in Kotlin — three codebases (web, Swift, Kotlin) maintained solo. Wrong shape.
- **Expo/React Native** reuses the existing TypeScript: `constants.ts`, personas, prompts, evaluator logic, and the resampler port almost verbatim; the Gemini Live API rides a WebSocket RN handles. One codebase, both stores.
- "Wanting to learn Swift" is better served by a side project than by making it the load-bearing wall of a two-platform product.

We then split into **two parallel tracks** rather than one: the web pass gives Hunter a practice loop in days (Track A), while the native app — where voice is the centerpiece, not deferred — is built behind it (Track B).

Full reasoning: `specs/2026-06-10-mobile-web-phase1-design.md` and `specs/2026-06-10-expo-mobile-prototype-design.md`.

---

## Track A — Mobile web (SHIPPED)

**Branch `feat/mobile-web-phase1` merged to `main` (`933c44b`), pushed, auto-deployed to Vercel production.** Verified end-to-end on the live URL with a browser agent: full text interview, two Gemini round-trips, scored feedback (74/100, persona "The Warm Mentor") — so the API-key-through-Vercel path is proven.

### What landed (each task TDD'd, then spec-reviewed + quality-reviewed by separate agents)

- **The load-bearing fix — worklet resampling** (`lib/resample.ts`, `lib/audioWorklet.ts`): the recorder worklet now resamples from the *actual* AudioContext rate to 16kHz. iOS Safari ignores the requested 16kHz and runs at 48kHz; without this, audio reached Gemini in 3× slow-motion and the ASR produced garbage. The resampler is embedded into the worklet string via `createResampler.toString()` (self-contained: no imports/refs/backticks, enforced by a test). Tested by evaluating the real worklet string at 16/44.1/48kHz.
- **iOS gesture gate + screen wake lock** (`components/VoiceInterview.tsx`): a "Tap to begin" overlay resumes suspended AudioContexts inside a user gesture (iOS autoplay policy); a wake lock keeps the screen alive mid-interview, re-acquired on tab refocus.
- **Responsive pass:** `dvh` heights, stacked/reordered voice controls (End Interview primary on mobile), 16px inputs (kills iOS focus-zoom), safe-area padding. Visually verified at 390×844 via Playwright.
- **`npm run dev:phone`:** self-signed HTTPS on the LAN so a phone can reach the dev server (getUserMedia needs a secure context; plain `http://<lan-ip>` is refused). `strictPort` on for this mode. Keeps console-forward streaming phone logs to the terminal.
- **Cleanup:** removed dead `/index.css` link + esm.sh importmap + dead `process.env` vite defines (AI Studio export leftovers); `viewport-fit=cover`.

### Review caught three real bugs before merge
1. **NaN injection in the resampler** on empty audio chunks (`carry = input[-1]` → undefined → NaN click) — guarded.
2. **StrictMode-stuck overlay**: dev double-mount closed the contexts while the tap-overlay was parked, so tapping resumed closed contexts → unhandled rejection + dead button. Fixed with try/finally + closed-state guard + nulling the ref on cleanup.
3. **Wake-lock/unmount race** leaking a never-released sentinel — fixed with a post-await `done` check.

### How to run
- Dev: `cd hireprep-ai && npm run dev` (port 3000, falls back to 3001).
- Phone test on LAN: `npm run dev:phone`, then `https://<mac-lan-ip>:3000` on the phone (find IP with `ipconfig getifaddr en0`; accept the self-signed cert).
- Deploy: automatic on push to `main` (Vercel ↔ GitHub). `VITE_GEMINI_API_KEY` is set in Vercel for all three environments.

### Pending (the only open Track A item)
**Human device test** — run the spec §6 checklist on a real iPhone against the live URL. The voice-interview transcript quality is the verdict on the resampler. See "Consolidated human checklist" below.

### Known cosmetic issues (pre-existing, not blockers)
- The interviewer greets with a literal `[Interviewer Name]` — the persona is deliberately hidden from the model, so it has no name to insert. One-line prompt fix when desired.
- No favicon (404 in console, harmless).

---

## Track B — Expo native (M0 SPIKE BUILT, BLOCKED ON TOOLING)

**Location:** `/Volumes/2025_exSSD_2tb/hire-prep-iterations/hire-prep/hireprep-mobile/` (external drive — the mobile port did *not* move to local disk with the web app) — its own git repo, Expo SDK 56 + TypeScript. Pushed to GitHub `closestfriend/hireprep-mobile` (private; no Vercel/CI wired — it's a native app).

The build order is deliberate: **Milestone 0 is a prove-or-kill spike of the realtime audio pipeline before any app shell is built around it**, because the audio layer is the single biggest risk in the whole port.

### What's built and verified-on-Mac (tests + typecheck green)
- **Scaffold + native config** (`5c499b0`): `expo-dev-client` (native audio modules ⇒ no Expo Go), `react-native-audio-api@0.12.2`, `@google/genai@^1.52`, `base64-js`, AsyncStorage. iOS prebuild done — `ios/` workspace generated, CocoaPods installed, mic permission + audio background mode in Info.plist (confirmed via PlistBuddy).
- **Tested codecs** (`064e55f`): resampler copied from the web app (byte-identical, 7 tests) + PCM/base64 codecs (4 tests). 11 tests passing under jest-expo.
- **The live pipeline** (`02c237b`, `991d973`): `lib/livePipeline.ts` — mic → resample-guard to 16kHz → Int16 → base64 → `sendRealtimeInput`; response → 24kHz buffer → queued playback; interruption → `clearBuffers`. `components/SpikeScreen.tsx` is a Start/Stop + transcript test harness. The Gemini Live integration mirrors the web app's working pattern field-for-field.

### Two `react-native-audio-api` 0.12.2 gotchas caught in source review (would have sunk the spike)
These are real findings about the library, worth remembering for anyone touching its queue-source path:
1. **`queue.start(0)` throws `RangeError`** — the 0.12.2 JS wrapper defaults `offset` to `-1` and rejects its own default. Must call `queue.start(0, 0)`.
2. **The queue source does NO sample-rate reconciliation** (unlike Web Audio's buffer source). A 24kHz buffer in a default 48kHz context plays at half-speed / an octave low. Fixed by pinning `new AudioContext({ sampleRate: 24000 })` — **but iOS may hand back its hardware rate anyway; verify on-device that 24kHz is honored.**

Neither is caught by `tsc` or unit tests — both are device-behavior issues, which is exactly why M0 is a device spike.

### What's blocking it: full Xcode is not installed
This Mac has **only Command Line Tools** (`/Library/Developer/CommandLineTools`) — `xcodebuild` errors out, zero codesigning identities, no `devicectl`. iOS device builds need **full Xcode** (App Store, ~7GB+). This is also the prerequisite for *ever* shipping to the App Store (goal #2), so it's not spike-only overhead — it's the last tooling gap between this Mac and iOS development generally.

### How to resume Track B (once Xcode is installed)
1. **Human, one-time:** install full Xcode from the App Store → launch once (accepts license, installs iOS platform) → `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`. Add Apple ID in Xcode → Settings → Accounts (free Personal Team). Connect iPhone, Trust This Computer, enable Developer Mode.
2. **Then agent-drivable:** `cd hireprep-mobile && npx expo run:ios --device` builds, signs, installs, and launches onto the phone. The app opens straight onto the **spike screen**.
3. **The prove-or-kill test:** tap Start, grant mic, ask it something. Coherent spoken reply + accurate "You:" transcript = M0 proven → Milestone 1 (the real app shell: landing/resume/chat/feedback + AsyncStorage) starts immediately. Garbage/silence = read the console via `npx expo start --dev-client` and debug the audio path (likely the 24kHz-honored question above).

Full step-by-step: `plans/2026-06-10-expo-mobile-prototype.md` (Milestones 0/1/2).

> **M1 note — web setup form gained an optional Job Description field (2026-06-14).**
> The web app's setup now accepts a pasted JD that tailors both the interviewer's
> questions and the evaluator's scoring (spec: `specs/2026-06-14-job-description-input-design.md`).
> When M1 builds the native setup/resume screen, include it: it's `jobDescription?: string`
> on the copied `ResumeData`, the JD blocks already in the (copied) `constants.ts` +
> `lib/evaluatorPrompt.ts`, and one `<TextInput>`. Logic is copied not shared, so copy
> those now-JD-aware files over wholesale and the feature rides along.

### Backup
Resolved (2026-06-14): pushed to private GitHub repo `closestfriend/hireprep-mobile`. No CI/deploy wired — it's a native app, distributed via dev builds / TestFlight, not a web host.

---

## Consolidated human checklist

**Track A — phone test the live web app** (https://hireprep-ai-nine.vercel.app, in mobile Safari):
- [ ] Full **voice interview** end to end — connect, converse, finish. (Tap-to-begin overlay may appear; it should unblock audio.)
- [ ] Inspect the **transcript** — coherent, not slow-motion garbage (the resampler's verdict).
- [ ] Full **text interview** — keyboard doesn't cover the input, no zoom on focus.
- [ ] Feedback renders; history persists on reload; **Export as Markdown** works on iOS.
- [ ] Screen stays awake during a ≥3-min voice interview.
- [ ] Camera PiP toggles (front camera) or fails gracefully.
- [ ] (Optional) Repeat one voice round in Chrome-on-iOS as a second data point — same engine, should match.

**Track B — bring iOS tooling online** (one-time, then the spike is minutes away):
- [ ] Install full Xcode + `xcode-select -s` to it.
- [ ] Apple ID in Xcode Accounts; iPhone trusted + Developer Mode on.
- [x] ~~Create + push a private GitHub repo for `hireprep-mobile`~~ — done 2026-06-14 (`closestfriend/hireprep-mobile`).

---

## Map of the paper trail

| Doc | Purpose |
|---|---|
| `specs/2026-06-10-mobile-web-phase1-design.md` | Track A intent/scope |
| `specs/2026-06-10-expo-mobile-prototype-design.md` | Track B intent/scope (voice-first, M0/M1/M2) |
| `plans/2026-06-10-mobile-web-phase1.md` | Track A step-by-step (9 tasks) |
| `plans/2026-06-10-expo-mobile-prototype.md` | Track B step-by-step (11 tasks) |
| **this file** | **as-built status + how to resume** |
| `hireprep-ai/CLAUDE.md` | web app internals (synced with the mobile changes) |
| `hireprep-mobile/CLAUDE.md` (external drive) | native app internals |
| `/Volumes/2025_exSSD_2tb/hire-prep-iterations/CLAUDE.md` (workspace, external drive) | the sibling-project map (web app now lives at `~/Projects/hireprep-ai`; `hireprep-mobile` stayed on the drive) |
