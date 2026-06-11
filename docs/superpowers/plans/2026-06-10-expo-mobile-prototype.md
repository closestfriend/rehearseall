# Expo Mobile Prototype (Track B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A native Expo app on Hunter's iPhone where a full voice interview works end to end, with the complete resume → interview → feedback → history flow.

**Architecture:** New Expo (TypeScript) app at `hire-prep/hireprep-mobile/`, its own git repo. Same stage-state-machine architecture as the web app (no router — `AppStage` switch in the root component, mirroring `App.tsx`). Voice rides `react-native-audio-api` (Software Mansion's Web Audio implementation for RN): `AudioRecorder.onAudioReady` delivers raw Float32 PCM for the mic → Gemini Live path; `AudioContext.createBufferQueueSource()` plays the 24kHz response stream gaplessly. **Milestone 0 is a prove-or-kill spike of exactly that pipeline before any app is built around it.** Business logic (`constants.ts`, `types.ts`, evaluator) is copied verbatim from the web app, not shared via package.

**Tech Stack:** Expo SDK (latest), `expo-dev-client` (native modules ⇒ no Expo Go), `react-native-audio-api`, `@google/genai`, `@react-native-async-storage/async-storage`, `base64-js`, jest-expo.

**Spec:** `hireprep-ai/docs/superpowers/specs/2026-06-10-expo-mobile-prototype-design.md`

**Paths:**
- Web app (copy source): `/Volumes/2025_exSSD_2tb/hire-prep-iterations/hire-prep/hireprep-ai`
- This app (created in Task 1): `/Volumes/2025_exSSD_2tb/hire-prep-iterations/hire-prep/hireprep-mobile`

**API-doc references for the executor** (verify exact signatures here before deviating):
- AudioRecorder: https://docs.swmansion.com/react-native-audio-api/docs/inputs/audio-recorder/
- AudioBufferQueueSourceNode: https://docs.swmansion.com/react-native-audio-api/docs/sources/audio-buffer-queue-source-node
- AudioManager (iOS session, permissions): https://docs.swmansion.com/react-native-audio-api/docs/system/audio-manager

---

## Milestone 0 — Audio spike (prove or kill)

### Task 1: Scaffold the project

- [ ] **Step 1: Create the Expo app**

```bash
cd /Volumes/2025_exSSD_2tb/hire-prep-iterations/hire-prep
npx create-expo-app@latest hireprep-mobile --template blank-typescript
cd hireprep-mobile
```

If `create-expo-app` initialized git, keep it; otherwise `git init`. Commit the scaffold:

```bash
git add -A && git commit -m "chore: expo blank-typescript scaffold"
```

- [ ] **Step 2: Install dependencies**

```bash
npx expo install expo-dev-client
npm install react-native-audio-api @google/genai base64-js @react-native-async-storage/async-storage
npx expo install @react-native-async-storage/async-storage
npm install -D @types/base64-js
```

(`npx expo install` after `npm install` lets Expo pin RN-compatible versions; if it warns about `react-native-audio-api` versioning, follow Expo's suggested version.)

- [ ] **Step 3: Configure app.json**

In `app.json`, under `expo`, add/merge:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-audio-api",
        { "iosBackgroundMode": true }
      ]
    ],
    "ios": {
      "bundleIdentifier": "com.hunter.hireprep",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "HirePrep uses the microphone to conduct voice interviews."
      }
    }
  }
}
```

If the `react-native-audio-api` config plugin rejects these options (check the error from the next step), consult https://docs.swmansion.com/react-native-audio-api/docs/other/configuring-audio-api and use the documented option names; the required outcomes are: microphone permission string present, audio background mode enabled.

- [ ] **Step 4: Prebuild**

```bash
npx expo prebuild --platform ios
```

Expected: `ios/` directory generated, pods installed, no plugin errors.

- [ ] **Step 5 (HUMAN): First device build via Xcode**

1. `open ios/hireprepmobile.xcworkspace` (name may differ — the single `.xcworkspace` in `ios/`).
2. Xcode → Signing & Capabilities → Team: your personal Apple ID (free). Fix the bundle id if Xcode reports a collision.
3. Plug in the iPhone via cable, select it as the run target, press Run.
4. On the phone: Settings → General → VPN & Device Management → trust the developer certificate.

Expected: the app launches on the phone showing the Expo template screen.

- [ ] **Step 6: Verify the dev-client loop**

```bash
npx expo start --dev-client
```

Open the app on the phone; it should connect to the dev server (same Wi-Fi) and hot-reload a trivial text edit to `App.tsx`. Revert the edit.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: dev-client + audio-api + deps; ios prebuild config"
```

---

### Task 2: API key wiring

**Files:**
- Create: `.env`
- Modify: `.gitignore`

- [ ] **Step 1: Create `.env`**

```bash
echo "EXPO_PUBLIC_GEMINI_API_KEY=<paste key from hireprep-ai/.env.local>" > .env
```

Expo inlines `EXPO_PUBLIC_*` vars into the JS bundle (same exposure posture as the web app's `VITE_` key — accepted in the spec, ephemeral tokens deferred to shipping).

- [ ] **Step 2: Ignore it**

Append to `.gitignore`:

```
.env
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore && git commit -m "chore: gitignore .env (EXPO_PUBLIC_GEMINI_API_KEY)"
```

---

### Task 3: Copy the resampler (tested) and PCM codecs

**Files:**
- Create: `lib/resample.ts` (copy from web app — Track A Task 2 must have landed there first; if not, copy the code from that plan)
- Create: `lib/pcm.ts`
- Test: `lib/__tests__/resample.test.ts`, `lib/__tests__/pcm.test.ts`

- [ ] **Step 1: Set up jest**

```bash
npx expo install jest-expo jest @types/jest
```

In `package.json` add:

```json
"scripts": { "test": "jest" },
"jest": { "preset": "jest-expo" }
```

- [ ] **Step 2: Copy resampler + tests from the web app**

```bash
mkdir -p lib/__tests__
cp ../hireprep-ai/lib/resample.ts lib/resample.ts
cp ../hireprep-ai/lib/resample.test.ts lib/__tests__/resample.test.ts
```

Edit `lib/__tests__/resample.test.ts`: change the vitest import line `import { describe, it, expect } from 'vitest';` to nothing (jest provides globals; delete the line) and fix the relative import to `'../resample'`.

- [ ] **Step 3: Write failing tests for the PCM codecs**

Create `lib/__tests__/pcm.test.ts`:

```ts
import { float32ToInt16, int16ToFloat32, int16ToBase64, base64ToInt16 } from '../pcm';

describe('pcm codecs', () => {
  it('round-trips float32 -> int16 -> float32 within quantization error', () => {
    const f = Float32Array.from([0, 0.5, -0.5, 1, -1, 0.999]);
    const back = int16ToFloat32(float32ToInt16(f));
    for (let i = 0; i < f.length; i++) expect(back[i]).toBeCloseTo(f[i], 3);
  });

  it('clamps out-of-range samples', () => {
    const i16 = float32ToInt16(Float32Array.from([2, -2]));
    expect(i16[0]).toBe(0x7fff);
    expect(i16[1]).toBe(-0x8000);
  });

  it('round-trips int16 -> base64 -> int16 exactly', () => {
    const i16 = Int16Array.from([0, 1, -1, 32767, -32768, 12345]);
    expect(Array.from(base64ToInt16(int16ToBase64(i16)))).toEqual(Array.from(i16));
  });
});
```

- [ ] **Step 4: Run tests to verify pcm tests fail**

Run: `npm test`
Expected: resample tests PASS, pcm tests FAIL (module not found).

- [ ] **Step 5: Implement `lib/pcm.ts`**

```ts
import * as base64 from 'base64-js';

export function float32ToInt16(f32: Float32Array): Int16Array {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function int16ToFloat32(i16: Int16Array): Float32Array {
  const out = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) out[i] = i16[i] / 32768;
  return out;
}

export function int16ToBase64(i16: Int16Array): string {
  return base64.fromByteArray(
    new Uint8Array(i16.buffer, i16.byteOffset, i16.byteLength)
  );
}

export function base64ToInt16(b64: string): Int16Array {
  const bytes = base64.toByteArray(b64);
  return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all).

- [ ] **Step 7: Commit**

```bash
git add lib package.json package-lock.json
git commit -m "feat: resampler (from web app) + tested PCM/base64 codecs"
```

---

### Task 4: The live audio pipeline + spike screen

**Files:**
- Create: `lib/livePipeline.ts`
- Modify: `App.tsx` (temporarily renders the spike screen)
- Create: `components/SpikeScreen.tsx`

This task is exploratory by design — the code below is the best-known shape against the documented APIs; where a call errors, consult the API-doc references at the top of this plan and adapt, keeping the pipeline contract fixed: **Float32 mic frames → 16kHz Int16 base64 → `sendRealtimeInput` → response base64 → 24kHz AudioBuffer → queue playback.**

- [ ] **Step 1: Implement the pipeline**

Create `lib/livePipeline.ts`:

```ts
import {
  AudioContext,
  AudioRecorder,
  AudioManager,
} from 'react-native-audio-api';
import { GoogleGenAI, Modality } from '@google/genai';
import { createResampler } from './resample';
import { float32ToInt16, int16ToFloat32, int16ToBase64, base64ToInt16 } from './pcm';

export interface LivePipelineCallbacks {
  onStatus: (s: 'connecting' | 'listening' | 'speaking' | 'error') => void;
  onInputTranscript: (text: string) => void;   // incremental candidate ASR
  onOutputTranscript: (text: string) => void;  // incremental interviewer text
  onTurnComplete: () => void;
  onVolume?: (rms: number) => void;            // mic RMS 0..1, drives the speaking orb
}

export interface LivePipelineConfig {
  apiKey: string;
  model: string;
  systemInstruction: string;
  voiceName: string;
  callbacks: LivePipelineCallbacks;
}

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;

export function createLivePipeline(cfg: LivePipelineConfig) {
  let recorder: AudioRecorder | null = null;
  let outCtx: AudioContext | null = null;
  let queue: ReturnType<AudioContext['createBufferQueueSource']> | null = null;
  let session: any = null;
  let stopped = false;

  async function start() {
    cfg.callbacks.onStatus('connecting');

    const permission = await AudioManager.requestRecordingPermissions();
    if (permission !== 'Granted') throw new Error(`Mic permission: ${permission}`);

    // Speaker + mic simultaneously; voiceChat mode enables iOS echo cancellation.
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosMode: 'voiceChat',
      iosOptions: ['defaultToSpeaker', 'allowBluetooth'],
    });
    await AudioManager.setAudioSessionActivity(true);

    outCtx = new AudioContext();
    queue = outCtx.createBufferQueueSource();
    queue.connect(outCtx.destination);
    queue.start(0);
    queue.onBufferEnded = (e: any) => {
      if (e.isLastBufferInQueue) cfg.callbacks.onStatus('listening');
    };

    const ai = new GoogleGenAI({ apiKey: cfg.apiKey });
    session = await ai.live.connect({
      model: cfg.model,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.voiceName } },
        },
        systemInstruction: cfg.systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => cfg.callbacks.onStatus('listening'),
        onmessage: (message: any) => {
          const data = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (data && outCtx && queue) {
            cfg.callbacks.onStatus('speaking');
            const f32 = int16ToFloat32(base64ToInt16(data));
            const buf = outCtx.createBuffer(1, f32.length, OUTPUT_RATE);
            buf.getChannelData(0).set(f32);
            queue.enqueueBuffer(buf);
          }
          if (message.serverContent?.interrupted && queue) {
            queue.clearBuffers();
            cfg.callbacks.onStatus('listening');
          }
          if (message.serverContent?.inputTranscription?.text) {
            cfg.callbacks.onInputTranscript(message.serverContent.inputTranscription.text);
          }
          if (message.serverContent?.outputTranscription?.text) {
            cfg.callbacks.onOutputTranscript(message.serverContent.outputTranscription.text);
          }
          if (message.serverContent?.turnComplete) {
            cfg.callbacks.onTurnComplete();
          }
        },
        onerror: (e: any) => {
          console.error('Live socket error:', e);
          cfg.callbacks.onStatus('error');
        },
        onclose: () => {
          if (!stopped) cfg.callbacks.onStatus('error');
        },
      },
    });

    recorder = new AudioRecorder();
    // Request 16kHz directly; the resampler is a guard in case the device
    // delivers a different rate anyway.
    const resample = createResampler(INPUT_RATE, INPUT_RATE);
    let guardedResample = resample;
    let detectedRate = INPUT_RATE;
    recorder.onAudioReady(
      { sampleRate: INPUT_RATE, bufferLength: 1600, channelCount: 1 },
      ({ buffer }: any) => {
        if (!session || stopped) return;
        const actualRate = buffer.sampleRate ?? INPUT_RATE;
        if (actualRate !== detectedRate) {
          detectedRate = actualRate;
          guardedResample = createResampler(actualRate, INPUT_RATE);
        }
        const f32: Float32Array = buffer.getChannelData(0);
        const pcm16 = float32ToInt16(guardedResample(f32));
        if (cfg.callbacks.onVolume) {
          let sum = 0;
          for (let i = 0; i < pcm16.length; i++) sum += pcm16[i] * pcm16[i];
          cfg.callbacks.onVolume(Math.sqrt(sum / pcm16.length) / 32768);
        }
        session.sendRealtimeInput({
          audio: { data: int16ToBase64(pcm16), mimeType: `audio/pcm;rate=${INPUT_RATE}` },
        });
      }
    );
    recorder.start();
  }

  function stop() {
    stopped = true;
    recorder?.stop();
    session?.close();
    queue?.stop();
    outCtx?.close();
    AudioManager.setAudioSessionActivity(false);
  }

  return { start, stop };
}
```

- [ ] **Step 2: Create the spike screen**

Create `components/SpikeScreen.tsx`:

```tsx
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createLivePipeline } from '../lib/livePipeline';

const SPIKE_SYSTEM_INSTRUCTION =
  'You are a friendly assistant. Answer in one or two short spoken sentences.';

export default function SpikeScreen() {
  const [status, setStatus] = useState<string>('idle');
  const [lines, setLines] = useState<string[]>([]);
  const pipelineRef = useRef<ReturnType<typeof createLivePipeline> | null>(null);
  const inputBuf = useRef('');
  const outputBuf = useRef('');

  const flush = () => {
    const i = inputBuf.current.trim();
    const o = outputBuf.current.trim();
    setLines((prev) => [
      ...prev,
      ...(i ? [`You: ${i}`] : []),
      ...(o ? [`AI: ${o}`] : []),
    ]);
    inputBuf.current = '';
    outputBuf.current = '';
  };

  const start = async () => {
    const pipeline = createLivePipeline({
      apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '',
      model: 'gemini-3.1-flash-live-preview',
      systemInstruction: SPIKE_SYSTEM_INSTRUCTION,
      voiceName: 'Puck',
      callbacks: {
        onStatus: setStatus,
        onInputTranscript: (t) => { inputBuf.current += t; },
        onOutputTranscript: (t) => { outputBuf.current += t; },
        onTurnComplete: flush,
      },
    });
    pipelineRef.current = pipeline;
    try {
      await pipeline.start();
    } catch (e) {
      setStatus(`error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const stop = () => {
    pipelineRef.current?.stop();
    pipelineRef.current = null;
    setStatus('idle');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{status}</Text>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={start}><Text style={styles.btnText}>Start</Text></Pressable>
        <Pressable style={[styles.btn, styles.stop]} onPress={stop}><Text style={styles.btnText}>Stop</Text></Pressable>
      </View>
      <ScrollView style={styles.log}>
        {lines.map((l, i) => <Text key={i} style={styles.line}>{l}</Text>)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80, paddingHorizontal: 20 },
  status: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  btn: { backgroundColor: '#2563eb', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
  stop: { backgroundColor: '#6b7280' },
  btnText: { color: 'white', fontWeight: '700' },
  log: { flex: 1 },
  line: { fontSize: 14, marginBottom: 8, color: '#111827' },
});
```

- [ ] **Step 3: Render it from `App.tsx`**

Replace the template `App.tsx` body so it renders `<SpikeScreen />` (keep the default export shape the template uses).

- [ ] **Step 4 (HUMAN + agent via LAN): Run the spike on the iPhone**

`npx expo start --dev-client`, open the app, tap Start, grant mic permission, say "What's the tallest mountain on Earth?".

**Exit criteria (spec M0):**
- A coherent spoken reply plays through the phone speaker with conversational latency.
- `You: ...` transcript line matches what was said (garbage here = sample-rate bug — check `detectedRate` via a console.log).
- Stop cleanly tears down (no crash, no stuck audio session).

- [ ] **Step 5: PROVE-OR-KILL CHECKPOINT**

If exit criteria pass → commit and proceed to Milestone 1.
If the pipeline fails after reasonable adaptation against the API docs (≤ a few days): STOP. Try fallback A (`react-native-webrtc` audio track for capture, keep playback) before abandoning. If still failing, reassess with Hunter — the web app (Track A) remains the voice practice loop.

```bash
git add -A && git commit -m "feat(M0): live audio spike — mic->16k PCM->Gemini Live->24k queued playback"
```

---

## Milestone 1 — App shell (text interviews fully working)

### Task 5: Port business logic by copy

**Files:**
- Create: `constants.ts`, `types.ts`, `services/geminiService.ts`, `lib/replySuggestions.ts` (copies)
- Test: existing web tests for constants

- [ ] **Step 1: Copy the files**

```bash
cp ../hireprep-ai/constants.ts constants.ts
cp ../hireprep-ai/types.ts types.ts
mkdir -p services
cp ../hireprep-ai/services/geminiService.ts services/geminiService.ts
cp ../hireprep-ai/lib/replySuggestions.ts lib/replySuggestions.ts
mkdir -p __tests__
cp ../hireprep-ai/constants.test.ts __tests__/constants.test.ts
```

(If `lib/replySuggestions.ts` has a web test file, copy it too. Adjust test import paths and remove vitest import lines as in Task 3.)

- [ ] **Step 2: De-webify**

1. In `services/geminiService.ts`: replace every `import.meta.env.VITE_GEMINI_API_KEY` with `process.env.EXPO_PUBLIC_GEMINI_API_KEY`.
2. In `constants.ts`: search for `localStorage` and `import.meta` — `pickPersona(excludeId?)` takes the exclusion as a parameter and storage lives in the app layer, so expect no hits; if any exist, lift them to the caller.

Run: `grep -rn "import.meta\|localStorage" constants.ts types.ts services/ lib/replySuggestions.ts`
Expected: no output.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS (constants tests + Task 3 tests).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(M1): port constants/types/evaluator/replySuggestions from web app"
```

---

### Task 6: AsyncStorage persistence service (TDD)

**Files:**
- Create: `lib/storage.ts`
- Test: `lib/__tests__/storage.test.ts`

- [ ] **Step 1: Write failing tests**

AsyncStorage ships a jest mock. Create `lib/__tests__/storage.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getHistory, saveEntry, deleteEntry, getLastPersonaId, setLastPersonaId } from '../storage';
import type { HistoryEntry } from '../../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const entry = (id: string): HistoryEntry => ({
  id,
  date: 1718000000000,
  resume: { text: 'r', role: 'Engineer', experienceLevel: 'mid' },
  transcript: [],
  feedback: { score: 80, strengths: [], improvements: [], detailedAnalysis: '' },
  personaName: 'The Skeptic',
});

beforeEach(() => AsyncStorage.clear());

describe('storage', () => {
  it('returns [] when empty', async () => {
    expect(await getHistory()).toEqual([]);
  });

  it('saves entries newest-first and round-trips', async () => {
    await saveEntry(entry('a'));
    await saveEntry(entry('b'));
    const h = await getHistory();
    expect(h.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('deletes by id', async () => {
    await saveEntry(entry('a'));
    await saveEntry(entry('b'));
    await deleteEntry('a');
    expect((await getHistory()).map((e) => e.id)).toEqual(['b']);
  });

  it('round-trips last persona id', async () => {
    expect(await getLastPersonaId()).toBeNull();
    await setLastPersonaId('skeptic');
    expect(await getLastPersonaId()).toBe('skeptic');
  });

  it('survives corrupt JSON', async () => {
    await AsyncStorage.setItem('hireprep_history_v1', '{nope');
    expect(await getHistory()).toEqual([]);
  });
});
```

(If the `feedback` object shape above doesn't match `types.ts` exactly — e.g. `suggestions` is required — fix the test fixture to match the real `InterviewFeedback` type, not the other way around.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- storage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/storage.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HistoryEntry } from '../types';

// Same keys as the web app for conceptual parity (stores are separate per platform).
const HISTORY_KEY = 'hireprep_history_v1';
const LAST_PERSONA_KEY = 'hireprep_last_persona_v1';

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveEntry(entry: HistoryEntry): Promise<HistoryEntry[]> {
  const next = [entry, ...(await getHistory())];
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export async function deleteEntry(id: string): Promise<HistoryEntry[]> {
  const next = (await getHistory()).filter((e) => e.id !== id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export async function getLastPersonaId(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_PERSONA_KEY);
}

export async function setLastPersonaId(id: string): Promise<void> {
  await AsyncStorage.setItem(LAST_PERSONA_KEY, id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts lib/__tests__/storage.test.ts
git commit -m "feat(M1): AsyncStorage history + persona persistence (tested)"
```

---

### Task 7: Stage machine + screens (text flow end to end)

**Files:**
- Modify: `App.tsx`
- Create: `components/LandingScreen.tsx`, `components/ResumeScreen.tsx`, `components/ChatScreen.tsx`, `components/FeedbackScreen.tsx`

Provisional styling throughout: plain `StyleSheet`, system fonts, the web app's blue (#2563eb) as the only accent. Structure mirrors the web `App.tsx` state machine exactly — read `../hireprep-ai/App.tsx` for reference while building.

- [ ] **Step 1: Root stage machine in `App.tsx`**

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import LandingScreen from './components/LandingScreen';
import ResumeScreen from './components/ResumeScreen';
import ChatScreen from './components/ChatScreen';
import FeedbackScreen from './components/FeedbackScreen';
import { AppStage, ResumeData, InterviewMessage, InterviewFeedback, HistoryEntry } from './types';
import { geminiService } from './services/geminiService';
import { pickPersona, InterviewerPersona } from './constants';
import * as storage from './lib/storage';

// crypto.randomUUID is unavailable in RN/Hermes
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function App() {
  const [stage, setStage] = useState<AppStage>(AppStage.LANDING);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [resumeData, setResumeData] = useState<ResumeData>({ text: '', role: '', experienceLevel: 'mid' });
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<InterviewMessage[]>([]);
  const [currentPersona, setCurrentPersona] = useState<InterviewerPersona | null>(null);
  const [displayPersonaName, setDisplayPersonaName] = useState<string | null>(null);

  useEffect(() => { storage.getHistory().then(setHistory); }, []);

  const startInterview = useCallback(async () => {
    const lastId = (await storage.getLastPersonaId()) ?? undefined;
    const persona = pickPersona(lastId);
    setCurrentPersona(persona);
    setDisplayPersonaName(null);
    await storage.setLastPersonaId(persona.id);
    setStage(AppStage.INTERVIEWING_TEXT);
  }, []);

  const processInterviewResults = useCallback(async (messages: InterviewMessage[]) => {
    setIsLoadingFeedback(true);
    setFeedbackError(null);
    setStage(AppStage.FEEDBACK);
    setCurrentTranscript(messages);
    try {
      const result = await geminiService.generateFeedback(resumeData, messages);
      setFeedback(result);
      const personaName = currentPersona?.name ?? 'Unknown';
      const entry: HistoryEntry = {
        id: makeId(),
        date: Date.now(),
        resume: { ...resumeData },
        transcript: messages,
        feedback: result,
        personaName,
      };
      setHistory(await storage.saveEntry(entry));
      setDisplayPersonaName(personaName);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingFeedback(false);
    }
  }, [resumeData, currentPersona]);

  const screens: Record<string, React.ReactNode> = {
    [AppStage.LANDING]: (
      <LandingScreen
        history={history}
        onStart={() => {
          setResumeData({ text: '', role: '', experienceLevel: 'mid' });
          setFeedback(null);
          setStage(AppStage.RESUME_UPLOAD);
        }}
        onOpenEntry={(e) => {
          setResumeData(e.resume);
          setFeedback(e.feedback);
          setCurrentTranscript(e.transcript);
          setDisplayPersonaName(e.personaName ?? null);
          setStage(AppStage.FEEDBACK);
        }}
        onDeleteEntry={async (id) => setHistory(await storage.deleteEntry(id))}
      />
    ),
    [AppStage.RESUME_UPLOAD]: (
      <ResumeScreen
        value={resumeData}
        onChange={setResumeData}
        onSubmit={startInterview}
        onCancel={() => setStage(AppStage.LANDING)}
      />
    ),
    [AppStage.INTERVIEWING_TEXT]: currentPersona ? (
      <ChatScreen
        resume={resumeData}
        persona={currentPersona}
        onFinish={processInterviewResults}
        onCancel={() => setStage(AppStage.LANDING)}
      />
    ) : null,
    [AppStage.FEEDBACK]: (
      <FeedbackScreen
        feedback={feedback}
        error={feedbackError}
        loading={isLoadingFeedback}
        transcript={currentTranscript}
        role={resumeData.role}
        personaName={displayPersonaName}
        onRetry={() => processInterviewResults(currentTranscript)}
        onDone={() => setStage(AppStage.LANDING)}
      />
    ),
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      {screens[stage] ?? screens[AppStage.LANDING]}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' },
});
```

Notes for the executor:
- The web `AppStage` enum includes `INTERVIEW_MODE` and `INTERVIEWING_VOICE`; mode selection is added in Milestone 2 (Task 9). Until then `startInterview` goes straight to text.
- If `AppStage` enum values don't index the `screens` record cleanly (numeric enum), switch to a plain `switch` statement like the web app.

- [ ] **Step 2: LandingScreen**

Create `components/LandingScreen.tsx`:

```tsx
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { HistoryEntry } from '../types';

interface Props {
  history: HistoryEntry[];
  onStart: () => void;
  onOpenEntry: (e: HistoryEntry) => void;
  onDeleteEntry: (id: string) => void;
}

export default function LandingScreen({ history, onStart, onOpenEntry, onDeleteEntry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>HirePrep AI</Text>
      <Text style={styles.subtitle}>Master your next job interview</Text>
      <Pressable style={styles.cta} onPress={onStart}>
        <Text style={styles.ctaText}>Start New Practice</Text>
      </Pressable>
      <Text style={styles.sectionHeader}>
        {history.length > 0 ? `Recent activity (${history.length})` : 'No sessions yet'}
      </Text>
      <FlatList
        data={history}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onOpenEntry(item)} onLongPress={() => onDeleteEntry(item.id)}>
            <View style={styles.scoreBubble}><Text style={styles.scoreText}>{item.feedback.score}</Text></View>
            <View style={styles.cardBody}>
              <Text style={styles.cardRole} numberOfLines={1}>{item.resume.role}</Text>
              <Text style={styles.cardMeta}>
                {new Date(item.date).toLocaleDateString()} · {item.transcript.length} messages
              </Text>
            </View>
          </Pressable>
        )}
      />
      {history.length > 0 && <Text style={styles.hint}>Long-press a session to delete it</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 32, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6b7280', marginTop: 4, marginBottom: 20 },
  cta: { backgroundColor: '#2563eb', borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginBottom: 28 },
  ctaText: { color: 'white', fontSize: 17, fontWeight: '700' },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 },
  scoreBubble: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  scoreText: { color: '#2563eb', fontWeight: '800', fontSize: 16 },
  cardBody: { flex: 1 },
  cardRole: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  hint: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 6 },
});
```

- [ ] **Step 3: ResumeScreen (paste-only)**

Create `components/ResumeScreen.tsx`:

```tsx
import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ResumeData } from '../types';

interface Props {
  value: ResumeData;
  onChange: (r: ResumeData) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const LEVELS = ['entry', 'mid', 'senior'] as const;

export default function ResumeScreen({ value, onChange, onSubmit, onCancel }: Props) {
  const valid = value.text.trim().length > 0 && value.role.trim().length > 0;
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Setup Your Interview</Text>

        <Text style={styles.label}>Target Job Role</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Senior Frontend Engineer"
          value={value.role}
          onChangeText={(role) => onChange({ ...value, role })}
        />

        <Text style={styles.label}>Experience Level</Text>
        <View style={styles.levels}>
          {LEVELS.map((level) => (
            <Pressable
              key={level}
              style={[styles.level, value.experienceLevel === level && styles.levelActive]}
              onPress={() => onChange({ ...value, experienceLevel: level })}
            >
              <Text style={[styles.levelText, value.experienceLevel === level && styles.levelTextActive]}>
                {level[0].toUpperCase() + level.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Resume (paste text)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          multiline
          placeholder="Paste your resume details, skills, and work history here..."
          value={value.text}
          onChangeText={(text) => onChange({ ...value, text })}
        />

        <Pressable style={[styles.submit, !valid && styles.disabled]} disabled={!valid} onPress={onSubmit}>
          <Text style={styles.submitText}>Continue</Text>
        </Pressable>
        <Pressable style={styles.cancel} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 16 },
  textarea: { height: 180, textAlignVertical: 'top' },
  levels: { flexDirection: 'row', gap: 8 },
  level: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', backgroundColor: 'white' },
  levelActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  levelText: { color: '#4b5563', fontWeight: '600' },
  levelTextActive: { color: '#2563eb' },
  submit: { backgroundColor: '#2563eb', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  disabled: { opacity: 0.4 },
  submitText: { color: 'white', fontSize: 17, fontWeight: '700' },
  cancel: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: '#6b7280', fontWeight: '600' },
});
```

- [ ] **Step 4: ChatScreen**

Create `components/ChatScreen.tsx` — a port of `../hireprep-ai/components/InterviewChat.tsx`'s logic (same chat init, same send flow) with RN UI:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GoogleGenAI, Chat } from '@google/genai';
import { MODELS, buildInterviewerSystemInstruction, InterviewerPersona } from '../constants';
import { InterviewMessage, ResumeData } from '../types';

interface Props {
  resume: ResumeData;
  persona: InterviewerPersona;
  onFinish: (transcript: InterviewMessage[]) => void;
  onCancel: () => void;
}

export default function ChatScreen({ resume, persona, onFinish, onCancel }: Props) {
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const initChat = async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '' });
      const chat = ai.chats.create({
        model: MODELS.TEXT_CHEF,
        config: { systemInstruction: buildInterviewerSystemInstruction(resume, persona) },
      });
      chatRef.current = chat;
      setIsTyping(true);
      const result = await chat.sendMessage({ message: 'Hello. Please introduce yourself and start the interview.' });
      setIsTyping(false);
      setMessages([{ role: 'assistant', content: result.text || "I'm ready. Let's begin. Tell me about yourself.", timestamp: Date.now() }]);
    };
    initChat();
  }, [resume, persona]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !chatRef.current || isTyping) return;
    setMessages((prev) => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
    setInput('');
    setIsTyping(true);
    try {
      const result = await chatRef.current.sendMessage({ message: text });
      setMessages((prev) => [...prev, { role: 'assistant', content: result.text || '', timestamp: Date.now() }]);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable onPress={onCancel}><Text style={styles.headerCancel}>Cancel</Text></Pressable>
        <Text style={styles.headerTitle}>Interview</Text>
        <Pressable style={styles.endBtn} onPress={() => onFinish(messages)}>
          <Text style={styles.endBtnText}>End & Analyze</Text>
        </Pressable>
      </View>
      <FlatList
        ref={listRef}
        style={styles.flex}
        contentContainerStyle={styles.listContent}
        data={isTyping ? [...messages, { role: 'assistant' as const, content: '…', timestamp: 0 }] : messages}
        keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={item.role === 'user' ? styles.userText : styles.aiText}>{item.content}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type your response..."
          multiline
        />
        <Pressable style={[styles.send, isTyping && styles.disabled]} disabled={isTyping} onPress={handleSend}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerCancel: { color: '#6b7280', fontWeight: '600' },
  headerTitle: { fontWeight: '700', color: '#111827' },
  endBtn: { backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  endBtnText: { color: 'white', fontSize: 13, fontWeight: '600' },
  listContent: { padding: 16, gap: 10 },
  bubble: { maxWidth: '82%', borderRadius: 16, padding: 12 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#2563eb' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#f3f4f6' },
  userText: { color: 'white', fontSize: 15, lineHeight: 21 },
  aiText: { color: '#1f2937', fontSize: 15, lineHeight: 21 },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  input: { flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, maxHeight: 120 },
  send: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  sendText: { color: 'white', fontWeight: '700' },
});
```

- [ ] **Step 5: FeedbackScreen**

Create `components/FeedbackScreen.tsx`:

```tsx
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { InterviewFeedback, InterviewMessage } from '../types';

interface Props {
  feedback: InterviewFeedback | null;
  error: string | null;
  loading: boolean;
  transcript: InterviewMessage[];
  role: string;
  personaName: string | null;
  onRetry: () => void;
  onDone: () => void;
}

export default function FeedbackScreen({ feedback, error, loading, transcript, role, personaName, onRetry, onDone }: Props) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Analyzing your interview…</Text>
      </View>
    );
  }
  if (!feedback) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Failed to load feedback.</Text>
        {error ? <Text style={styles.errorBody}>{error}</Text> : null}
        <Pressable style={styles.primary} onPress={onRetry}><Text style={styles.primaryText}>Retry</Text></Pressable>
        <Pressable style={styles.secondary} onPress={onDone}><Text style={styles.secondaryText}>Back to Dashboard</Text></Pressable>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.scoreCard}>
        <Text style={styles.score}>{feedback.score}</Text>
        <Text style={styles.scoreLabel}>SCORE</Text>
        <Text style={styles.roleLine}>Report for {role}</Text>
        {personaName ? <Text style={styles.personaLine}>Interviewed by {personaName}</Text> : null}
      </View>

      <Text style={styles.sectionTitle}>Key Strengths</Text>
      {feedback.strengths.map((s, i) => <Text key={i} style={styles.li}>• {s}</Text>)}

      <Text style={styles.sectionTitle}>Areas to Improve</Text>
      {feedback.improvements.map((s, i) => <Text key={i} style={styles.li}>• {s}</Text>)}

      <Text style={styles.sectionTitle}>Detailed Analysis</Text>
      <Text style={styles.analysis}>{feedback.detailedAnalysis}</Text>

      <Text style={styles.sectionTitle}>Transcript ({transcript.length} messages)</Text>
      {transcript.map((m, i) => (
        <View key={i} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
          <Text style={m.role === 'user' ? styles.userText : styles.aiText}>{m.content}</Text>
        </View>
      ))}

      <Pressable style={[styles.primary, styles.doneBtn]} onPress={onDone}>
        <Text style={styles.primaryText}>Back to Dashboard</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  loadingText: { color: '#6b7280', fontSize: 15 },
  errorTitle: { color: '#dc2626', fontWeight: '700', fontSize: 16 },
  errorBody: { color: '#6b7280', fontSize: 12 },
  container: { padding: 20, paddingBottom: 60 },
  scoreCard: { backgroundColor: 'white', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20 },
  score: { fontSize: 48, fontWeight: '800', color: '#111827' },
  scoreLabel: { fontSize: 11, letterSpacing: 2, color: '#9ca3af', fontWeight: '700' },
  roleLine: { marginTop: 10, color: '#374151', fontWeight: '600' },
  personaLine: { marginTop: 2, color: '#6b7280', fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 18, marginBottom: 8 },
  li: { color: '#374151', fontSize: 14, lineHeight: 21, marginBottom: 4 },
  analysis: { color: '#4b5563', fontSize: 14, lineHeight: 22 },
  bubble: { maxWidth: '85%', borderRadius: 14, padding: 10, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#2563eb' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#f3f4f6' },
  userText: { color: 'white', fontSize: 13, lineHeight: 19 },
  aiText: { color: '#1f2937', fontSize: 13, lineHeight: 19 },
  primary: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center' },
  doneBtn: { marginTop: 24 },
  primaryText: { color: 'white', fontWeight: '700' },
  secondary: { paddingVertical: 12 },
  secondaryText: { color: '#6b7280', fontWeight: '600' },
});
```

(Per-reply coaching suggestions from `replySuggestions.ts` are ported in logic but not yet surfaced in this screen — acceptable for the prototype; add a follow-up note, don't expand scope here.)

- [ ] **Step 6: Verify on device (HUMAN)**

`npx expo start --dev-client` — complete a full **text interview** on the iPhone: paste a resume snippet, chat 3+ rounds, End & Analyze, see scored feedback, return to landing, kill and reopen the app, history entry persists, open it.

- [ ] **Step 7: Run tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add -A && git commit -m "feat(M1): stage machine + landing/resume/chat/feedback screens — text flow end to end"
```

---

## Milestone 2 — Voice integrated

### Task 8: VoiceScreen on the spike pipeline

**Files:**
- Create: `components/VoiceScreen.tsx`
- Delete: `components/SpikeScreen.tsx` (superseded)

- [ ] **Step 1: Create VoiceScreen**

`createLivePipeline` already accepts `systemInstruction`, `voiceName`, and transcript callbacks — VoiceScreen is the spike screen grown up, with the web `VoiceInterview.tsx` transcript-buffer pattern:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createLivePipeline } from '../lib/livePipeline';
import { MODELS, buildInterviewerSystemInstruction, InterviewerPersona } from '../constants';
import { ResumeData } from '../types';

interface Props {
  resume: ResumeData;
  persona: InterviewerPersona;
  onFinish: (transcript: string[]) => void;
  onCancel: () => void;
}

export default function VoiceScreen({ resume, persona, onFinish, onCancel }: Props) {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'error'>('connecting');
  const [volume, setVolume] = useState(0);
  const pipelineRef = useRef<ReturnType<typeof createLivePipeline> | null>(null);
  const transcriptRef = useRef<string[]>([]);
  const inputBuf = useRef('');
  const outputBuf = useRef('');
  const startedRef = useRef(false);

  const flushBuffers = useCallback(() => {
    const input = inputBuf.current.trim();
    const output = outputBuf.current.trim();
    if (input) { transcriptRef.current.push(`Candidate: ${input}`); inputBuf.current = ''; }
    if (output) { transcriptRef.current.push(`Interviewer: ${output}`); outputBuf.current = ''; }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const pipeline = createLivePipeline({
      apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '',
      model: MODELS.VOICE_INTERVIEWER,
      systemInstruction: buildInterviewerSystemInstruction(resume, persona),
      voiceName: persona.voiceId,
      callbacks: {
        onStatus: setStatus,
        onInputTranscript: (t) => { inputBuf.current += t; },
        onOutputTranscript: (t) => { outputBuf.current += t; },
        onTurnComplete: flushBuffers,
        onVolume: setVolume,
      },
    });
    pipelineRef.current = pipeline;
    pipeline.start().catch((e) => {
      console.error('Voice start failed:', e);
      setStatus('error');
    });
    return () => { pipeline.stop(); };
  }, [resume, persona, flushBuffers]);

  const handleFinish = () => {
    flushBuffers();
    pipelineRef.current?.stop();
    onFinish(transcriptRef.current);
  };

  const statusCopy: Record<string, string> = {
    connecting: 'Initializing AI…',
    listening: 'Listening to you…',
    speaking: 'Interviewer is speaking',
    error: 'Connection problem — end the interview and retry',
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.orb,
          status === 'speaking' && styles.orbSpeaking,
          status === 'listening' && styles.orbListening,
          { transform: [{ scale: 1 + volume * 0.4 }] },
        ]}
      />
      <Text style={styles.statusTitle}>{statusCopy[status]}</Text>
      <Text style={styles.hint}>Speak naturally as you would in a real interview.</Text>
      <View style={styles.buttons}>
        <Pressable style={styles.endBtn} onPress={handleFinish}>
          <Text style={styles.endText}>End Interview</Text>
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={() => { pipelineRef.current?.stop(); onCancel(); }}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  orb: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#e5e7eb' },
  orbSpeaking: { backgroundColor: '#2563eb' },
  orbListening: { backgroundColor: '#22c55e' },
  statusTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 28 },
  hint: { color: '#6b7280', marginTop: 8, textAlign: 'center' },
  buttons: { marginTop: 40, width: '100%', gap: 10 },
  endBtn: { backgroundColor: '#111827', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  endText: { color: 'white', fontWeight: '700', fontSize: 16 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#6b7280', fontWeight: '600' },
});
```

Then `rm components/SpikeScreen.tsx`.

- [ ] **Step 2: Keep the screen awake during voice**

```bash
npx expo install expo-keep-awake
```

In `VoiceScreen.tsx`, add to imports: `import { useKeepAwake } from 'expo-keep-awake';` and call `useKeepAwake();` as the first line of the component body.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(M2): VoiceScreen on the live pipeline; keep-awake; remove spike screen"
```

---

### Task 9: Mode selection + wiring voice into the stage machine

**Files:**
- Modify: `App.tsx`
- Create: `components/ModeScreen.tsx`

- [ ] **Step 1: ModeScreen**

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  onVoice: () => void;
  onText: () => void;
  onBack: () => void;
}

export default function ModeScreen({ onVoice, onText, onBack }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Interview Format</Text>
      <Pressable style={styles.card} onPress={onVoice}>
        <Text style={styles.cardTitle}>🎙️ Voice Interview</Text>
        <Text style={styles.cardBody}>Real-time conversational audio. Best for verbal practice.</Text>
      </Pressable>
      <Pressable style={styles.card} onPress={onText}>
        <Text style={styles.cardTitle}>💬 Chat Interview</Text>
        <Text style={styles.cardBody}>Interactive text. Best for structuring complex answers.</Text>
      </Pressable>
      <Pressable style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>Go back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: 'white', borderRadius: 20, padding: 22, marginBottom: 14 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  cardBody: { color: '#6b7280', fontSize: 14, lineHeight: 20 },
  back: { alignItems: 'center', paddingVertical: 14 },
  backText: { color: '#9ca3af', fontWeight: '600' },
});
```

- [ ] **Step 2: Wire into App.tsx**

1. Change `startInterview` to accept the target stage (mirroring web `App.tsx:97-106`):

```tsx
const startInterview = useCallback(async (mode: AppStage.INTERVIEWING_VOICE | AppStage.INTERVIEWING_TEXT) => {
  const lastId = (await storage.getLastPersonaId()) ?? undefined;
  const persona = pickPersona(lastId);
  setCurrentPersona(persona);
  setDisplayPersonaName(null);
  await storage.setLastPersonaId(persona.id);
  setStage(mode);
}, []);
```

2. `ResumeScreen`'s `onSubmit` now goes to `AppStage.INTERVIEW_MODE`.
3. Add the two stages:

```tsx
[AppStage.INTERVIEW_MODE]: (
  <ModeScreen
    onVoice={() => startInterview(AppStage.INTERVIEWING_VOICE)}
    onText={() => startInterview(AppStage.INTERVIEWING_TEXT)}
    onBack={() => setStage(AppStage.RESUME_UPLOAD)}
  />
),
[AppStage.INTERVIEWING_VOICE]: currentPersona ? (
  <VoiceScreen
    resume={resumeData}
    persona={currentPersona}
    onFinish={(transcript) =>
      processInterviewResults(
        transcript.map((t) => ({
          role: t.startsWith('Candidate') ? ('user' as const) : ('assistant' as const),
          content: t.split(': ').slice(1).join(': ') || '',
          timestamp: Date.now(),
        }))
      )
    }
    onCancel={() => setStage(AppStage.INTERVIEW_MODE)}
  />
) : null,
```

(Note the `split(': ').slice(1).join(': ')` — the web version's `split(': ')[1]` silently truncates any utterance containing `": "`; don't copy that bug.)

- [ ] **Step 3: Run tests and commit**

Run: `npm test`
Expected: PASS.

```bash
git add -A && git commit -m "feat(M2): mode selection; voice interview wired into stage machine"
```

---

### Task 10: Real-device verification (HUMAN, spec §Verification)

On the iPhone dev build:

- [ ] 1. Full **voice interview** end to end: persona voice plays, conversation flows, interrupting the AI mid-sentence stops its audio, End Interview produces feedback.
- [ ] 2. Transcript on the feedback screen is coherent (resampling bugs = garbage text).
- [ ] 3. Full **text interview** end to end.
- [ ] 4. Feedback renders; history persists across an app kill + relaunch; persona anti-repeat holds across two consecutive interviews.
- [ ] 5. Screen stays awake during a ≥3-minute voice interview.
- [ ] 6. Audio routes sensibly with AirPods connected and disconnected mid-session (note quirks; fixes are follow-ups, not ad-hoc patches).

Record failures as issues with reproduction steps before fixing.

---

### Task 11: Project docs

**Files:**
- Create: `CLAUDE.md`
- Copy: spec + this plan into `docs/superpowers/`

- [ ] **Step 1: Copy spec and plan from hireprep-ai**

```bash
mkdir -p docs/superpowers/specs docs/superpowers/plans
cp ../hireprep-ai/docs/superpowers/specs/2026-06-10-expo-mobile-prototype-design.md docs/superpowers/specs/
cp ../hireprep-ai/docs/superpowers/plans/2026-06-10-expo-mobile-prototype.md docs/superpowers/plans/
```

- [ ] **Step 2: Write `CLAUDE.md`**

Cover: project purpose (native sibling of `hireprep-ai` — see the workspace CLAUDE.md two levels up), the copy-not-share relationship to the web app's `constants.ts`/`types.ts`/`geminiService.ts` (drift is expected; reconcile deliberately), the live pipeline architecture (`lib/livePipeline.ts`, 16k in / 24k out, resampler guard), the dev loop (`expo-dev-client`, Xcode install, 7-day re-sign on free Apple ID), `EXPO_PUBLIC_GEMINI_API_KEY` in `.env`, and `npm test` for jest.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "docs: CLAUDE.md + spec/plan copies"
```

- [ ] **Step 4: Flag for Hunter (workspace hygiene)**

Remind Hunter to add a `hireprep-mobile` row/section to the workspace-level CLAUDE.md at `/Volumes/2025_exSSD_2tb/hire-prep-iterations/CLAUDE.md` (it documents the sibling projects; this is a new sibling).
