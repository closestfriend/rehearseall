# Mobile Web Phase 1 (Track A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing HirePrep web app fully usable on a phone (voice interviews included) and deploy it to Vercel.

**Architecture:** The app stays a static Vite/React build. The critical change is in the mic path: the recorder AudioWorklet currently assumes its AudioContext runs at 16kHz, but iOS Safari typically runs at 48kHz — we add a streaming resampler inside the worklet so the `audio/pcm;rate=16000` contract with the Gemini Live API always holds. Around that: an iOS autoplay-policy gesture gate, a screen wake lock, targeted responsive fixes, an HTTPS LAN dev loop, and the Vercel deploy.

**Tech Stack:** Vite 6, React 19, TypeScript, vitest, Tailwind (CDN, unchanged), `@vitejs/plugin-basic-ssl`, Vercel.

**Spec:** `docs/superpowers/specs/2026-06-10-mobile-web-phase1-design.md`

**Working directory for all commands:** `/Volumes/2025_exSSD_2tb/hire-prep-iterations/hire-prep/hireprep-ai`

---

### Task 1: index.html cleanup (AI Studio export leftovers)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Remove the dead stylesheet link, remove the esm.sh importmap, add `viewport-fit=cover`**

In `index.html`:

1. Change line 6 from:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
to:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

2. Delete the entire importmap block (lines 40–49):
```html
<script type="importmap">
{
  "imports": {
    "react/": "https://esm.sh/react@^19.2.3/",
    "react": "https://esm.sh/react@^19.2.3",
    "react-dom/": "https://esm.sh/react-dom@^19.2.3/",
    "@google/genai": "https://esm.sh/@google/genai@^1.34.0"
  }
}
</script>
```
(Vite bundles these from `node_modules`; the map is unused at best and a double-React risk at worst.)

3. Delete line 50:
```html
<link rel="stylesheet" href="/index.css">
```
(`index.css` does not exist — this 404s on every page load.)

- [ ] **Step 2: Verify the build and dev server still work**

Run: `npm run build && npm test`
Expected: build succeeds, existing tests pass.

Run: `npm run dev` briefly and load `http://localhost:3000` — app renders, no 404 for `/index.css` in the network tab, no console errors.

- [ ] **Step 3: Verify console-forward plugin is dev-only (no change expected)**

Read `console-forward-plugin.ts` and confirm it declares `apply: 'serve'` (it does, line 14 as of this writing). This satisfies the spec item; no code change. Confirm `npm run build` output (`dist/index.html`) contains no `/__console` script injection:

Run: `grep -c "__console" dist/index.html || echo "clean"`
Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix: remove dead index.css link and unused esm.sh importmap; add viewport-fit=cover"
```

---

### Task 2: Streaming resampler (pure function, TDD)

The worklet needs to convert from the *actual* context rate (often 48kHz on iOS) to 16kHz. We build it as a tested pure function in `lib/resample.ts`, then embed its source into the worklet string in Task 3 via `createResampler.toString()`.

**Files:**
- Create: `lib/resample.ts`
- Test: `lib/resample.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/resample.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createResampler } from './resample';

const ramp = (n: number, start = 0) =>
  Float32Array.from({ length: n }, (_, i) => start + i);

describe('createResampler', () => {
  it('returns input unchanged when rates match', () => {
    const resample = createResampler(16000, 16000);
    const input = ramp(512);
    expect(resample(input)).toBe(input);
  });

  it('produces 1/3 the samples for 48k -> 16k', () => {
    const resample = createResampler(48000, 16000);
    const out = resample(ramp(480));
    expect(out.length).toBe(160);
  });

  it('preserves a constant signal', () => {
    const resample = createResampler(48000, 16000);
    const out = resample(Float32Array.from({ length: 480 }, () => 0.5));
    for (const s of out) expect(s).toBeCloseTo(0.5, 6);
  });

  it('is continuous across chunk boundaries (chunked === one-shot)', () => {
    const whole = createResampler(48000, 16000)(ramp(960));
    const chunked = createResampler(48000, 16000);
    const a = chunked(ramp(480));
    const b = chunked(ramp(480, 480));
    const joined = Float32Array.from([...a, ...b]);
    expect(joined.length).toBe(whole.length);
    for (let i = 0; i < whole.length; i++) {
      expect(joined[i]).toBeCloseTo(whole[i], 4);
    }
  });

  it('handles non-integer ratios (44.1k -> 16k) without drift', () => {
    const resample = createResampler(44100, 16000);
    let total = 0;
    for (let c = 0; c < 100; c++) total += resample(ramp(441, c * 441)).length;
    // 100 chunks * 441 samples = 1s of audio -> ~16000 output samples
    expect(Math.abs(total - 16000)).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/resample.test.ts`
Expected: FAIL — `Cannot find module './resample'` (or equivalent).

- [ ] **Step 3: Implement `createResampler`**

Create `lib/resample.ts`:

```ts
// Streaming linear-interpolation resampler.
// Returned function is stateful: it carries the fractional read position and
// the last input sample across calls, so chunked input produces the same
// output as one-shot input (no clicks or drift at chunk boundaries).
//
// CONSTRAINT: this function's source is embedded into the AudioWorklet code
// string via createResampler.toString() (see lib/audioWorklet.ts). It must
// stay self-contained — no imports, no outer-scope references, no backticks.
export function createResampler(
  fromRate: number,
  toRate: number
): (input: Float32Array) => Float32Array {
  if (fromRate === toRate) return (input) => input;
  const step = fromRate / toRate;
  let pos = 0;        // fractional read index into the current chunk
  let carry = 0;      // last sample of the previous chunk (for pos in (-1, 0))
  let hasCarry = false;
  return (input) => {
    const out: number[] = [];
    while (pos <= input.length - 1) {
      if (pos < 0) {
        const frac = pos + 1;
        out.push(hasCarry ? carry + (input[0] - carry) * frac : input[0]);
      } else {
        const i = Math.floor(pos);
        const frac = pos - i;
        const next = i + 1 < input.length ? input[i + 1] : input[i];
        out.push(input[i] + (next - input[i]) * frac);
      }
      pos += step;
    }
    pos -= input.length;
    carry = input[input.length - 1];
    hasCarry = true;
    return Float32Array.from(out);
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/resample.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/resample.ts lib/resample.test.ts
git commit -m "feat: streaming linear resampler for worklet mic path"
```

---

### Task 3: Resampling inside the recorder worklet (TDD via worklet-string evaluation)

**Files:**
- Modify: `lib/audioWorklet.ts`
- Test: `lib/audioWorklet.test.ts`

- [ ] **Step 1: Write the failing test**

The worklet code is a string evaluated in `AudioWorkletGlobalScope`, where `sampleRate` is a global. We can test the real string with `new Function` and stub globals.

Create `lib/audioWorklet.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { audioWorkletCode } from './audioWorklet';

function instantiate(contextRate: number) {
  const posted: Int16Array[] = [];
  class FakeAudioWorkletProcessor {
    port = { postMessage: (d: Int16Array) => posted.push(d) };
  }
  let ProcessorClass: any;
  const registerProcessor = (_name: string, cls: any) => { ProcessorClass = cls; };
  new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', audioWorkletCode)(
    FakeAudioWorkletProcessor, registerProcessor, contextRate
  );
  return { processor: new ProcessorClass(), posted };
}

describe('recorder worklet', () => {
  it('posts 512-sample Int16 chunks at a 16kHz context (identity path)', () => {
    const { processor, posted } = instantiate(16000);
    const frame = Float32Array.from({ length: 128 }, () => 0.25);
    for (let i = 0; i < 8; i++) processor.process([[frame]]);
    expect(posted.length).toBe(2); // 8 * 128 = 1024 samples = 2 chunks
    expect(posted[0].length).toBe(512);
    expect(posted[0][0]).toBe(8191); // trunc(0.25 * 0x7fff) — Int16Array assignment truncates, not rounds
  });

  it('downsamples 3:1 at a 48kHz context', () => {
    const { processor, posted } = instantiate(48000);
    const frame = Float32Array.from({ length: 128 }, () => 0.25);
    // 36 * 128 = 4608 input samples -> 1536 output samples -> 3 chunks of 512
    for (let i = 0; i < 36; i++) processor.process([[frame]]);
    expect(posted.length).toBe(3);
    expect(posted[0].length).toBe(512);
  });

  it('keeps running when the input is empty', () => {
    const { processor } = instantiate(48000);
    expect(processor.process([[]])).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/audioWorklet.test.ts`
Expected: FAIL — at 48kHz the current worklet posts 9 chunks (no downsampling), so the `toBe(3)` assertion fails. (The 16kHz test passes already; that's fine — it pins existing behavior.)

- [ ] **Step 3: Embed the resampler in the worklet**

Replace the top of `lib/audioWorklet.ts` (keep `base64Encode` unchanged) with:

```ts
import { createResampler } from './resample';

// The worklet runs in AudioWorkletGlobalScope where `sampleRate` is a global
// holding the actual context rate. iOS Safari often ignores the requested
// 16kHz and runs at 48kHz — the embedded resampler guarantees the PCM we
// post (and ultimately send to the Live API as rate=16000) really is 16kHz.
export const audioWorkletCode = `
const createResampler = ${createResampler.toString()};
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 512;
    this.buffer = new Float32Array(this.chunkSize);
    this.bytesWritten = 0;
    this.resample = createResampler(sampleRate, 16000);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const samples = this.resample(input[0]);
      for (let i = 0; i < samples.length; i++) {
        this.buffer[this.bytesWritten++] = samples[i];
        if (this.bytesWritten >= this.chunkSize) {
          this.flush();
        }
      }
    }
    return true;
  }

  flush() {
    const pcm16 = new Int16Array(this.chunkSize);
    for (let i = 0; i < this.chunkSize; i++) {
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    this.port.postMessage(pcm16);
    this.bytesWritten = 0;
  }
}
registerProcessor('recorder-worklet', RecorderProcessor);
`;
```

Note: `createResampler`'s source contains no backticks, so embedding it in the template literal is safe (the constraint is documented in `lib/resample.ts`).

- [ ] **Step 4: Run all tests to verify they pass**

Run: `npm test`
Expected: PASS — all worklet tests, resampler tests, and the pre-existing `constants.test.ts`.

- [ ] **Step 5: Desktop smoke test**

Run: `npm run dev`, complete the first 2 exchanges of a voice interview on desktop. Expected: behavior unchanged (desktop context honors 16kHz → resampler takes the identity path).

- [ ] **Step 6: Commit**

```bash
git add lib/audioWorklet.ts lib/audioWorklet.test.ts
git commit -m "fix: resample mic audio to 16kHz inside worklet (iOS runs contexts at 48kHz)"
```

---

### Task 4: iOS gesture gate + screen wake lock in VoiceInterview

**Files:**
- Modify: `components/VoiceInterview.tsx`

- [ ] **Step 1: Add the gesture gate**

iOS creates AudioContexts in `suspended` state unless creation is directly tied to a user gesture. Add state/refs near the existing ones (after `isInitializedRef`, line ~37):

```tsx
const [needsGesture, setNeedsGesture] = useState(false);
const gestureResolveRef = useRef<(() => void) | null>(null);
```

In `startSession`, immediately after the two contexts are created and stored (`audioCtxRef.current = { input: inCtx, output: outCtx };`, line ~91), insert:

```tsx
// iOS autoplay policy: contexts may start suspended. Block here until the
// user taps the overlay, whose handler resumes them inside the gesture.
if (inCtx.state === 'suspended' || outCtx.state === 'suspended') {
  setNeedsGesture(true);
  await new Promise<void>((resolve) => { gestureResolveRef.current = resolve; });
}
```

Add the tap handler alongside `toggleCamera`:

```tsx
const handleBeginTap = useCallback(async () => {
  const ctxs = audioCtxRef.current;
  if (ctxs) {
    await Promise.all([ctxs.input.resume(), ctxs.output.resume()]);
  }
  setNeedsGesture(false);
  gestureResolveRef.current?.();
  gestureResolveRef.current = null;
}, []);
```

In the JSX, inside the card `<div className="bg-white rounded-3xl ...">` as its first child (above the status bar div), add:

```tsx
{needsGesture && (
  <div className="absolute inset-0 z-20 bg-white/95 flex flex-col items-center justify-center gap-4 rounded-3xl">
    <p className="text-gray-600 font-medium px-8 text-center">
      Your browser needs a tap to enable audio.
    </p>
    <button
      onClick={handleBeginTap}
      className="px-8 py-4 bg-blue-600 text-white rounded-full font-bold text-lg shadow-lg shadow-blue-200"
    >
      Tap to begin
    </button>
  </div>
)}
```

- [ ] **Step 2: Add the wake lock effect**

Add a new `useEffect` after the existing mount effect (line ~205):

```tsx
// Keep the screen on during the interview; re-acquire when the tab
// regains visibility (the lock is auto-released on backgrounding).
useEffect(() => {
  let lock: WakeLockSentinel | null = null;
  let done = false;
  const acquire = async () => {
    try {
      if ('wakeLock' in navigator) {
        lock = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Unsupported or denied — non-fatal, interview proceeds.
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible' && !done) acquire();
  };
  acquire();
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    done = true;
    document.removeEventListener('visibilitychange', onVisibility);
    lock?.release().catch(() => {});
  };
}, []);
```

If TypeScript doesn't know `WakeLockSentinel`/`navigator.wakeLock` with the current `lib` settings, use `let lock: any = null;` and `(navigator as any).wakeLock.request('screen')` rather than fighting tsconfig.

- [ ] **Step 3: Verify build + desktop behavior**

Run: `npm test && npm run build`
Expected: PASS / build succeeds.

Run: `npm run dev`, start a voice interview on desktop. Expected: no overlay appears (desktop contexts start `running`), interview works as before.

- [ ] **Step 4: Commit**

```bash
git add components/VoiceInterview.tsx
git commit -m "feat: iOS gesture gate for suspended AudioContexts + screen wake lock"
```

---

### Task 5: Responsive pass (usable, not polished)

**Files:**
- Modify: `components/VoiceInterview.tsx`
- Modify: `components/InterviewChat.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: VoiceInterview small-screen fixes**

In `components/VoiceInterview.tsx`:

1. Container (line ~248): `className="max-w-xl mx-auto py-12 px-4"` → `className="max-w-xl mx-auto py-4 sm:py-12 px-4"`
2. Card (line ~249): `p-10` → `p-6 sm:p-10` (rest of the class string unchanged).
3. Heading (line ~294): `text-3xl` → `text-2xl sm:text-3xl`
4. Button row (line ~303): replace `className="grid grid-cols-3 gap-4"` with `className="grid grid-cols-1 sm:grid-cols-3 gap-3"`, and add order classes so **End Interview** is the top (primary) button on mobile:
   - Cancel button: add `order-2 sm:order-none` to its className
   - End Interview button: add `order-1 sm:order-none`
   - Camera button: add `order-3 sm:order-none`
5. Buttons keep `py-4` — that's already a ≥44px touch target at full width.

- [ ] **Step 2: InterviewChat keyboard/viewport fixes**

In `components/InterviewChat.tsx`:

1. Container (line 86): `className="max-w-4xl mx-auto py-8 px-4 h-[calc(100vh-12rem)] flex flex-col"` → `className="max-w-4xl mx-auto py-2 sm:py-8 px-2 sm:px-4 h-[calc(100dvh-10rem)] sm:h-[calc(100dvh-12rem)] flex flex-col"`
   (`dvh` tracks the iOS dynamic toolbar; smaller offset on mobile reclaims header/footer space.)
2. Message area (line 106): `p-6 space-y-6` → `p-4 sm:p-6 space-y-4 sm:space-y-6`
3. Text input (line ~138): add `text-base` to the input's className — iOS Safari auto-zooms the page when a focused input's font-size is under 16px.

- [ ] **Step 3: Resume form mobile fixes**

In `App.tsx` `renderResumeUpload` (line ~298):

1. Container: `py-16` → `py-6 sm:py-16`
2. Card: `p-8 lg:p-12` stays; form inputs (role input line ~308, textarea line ~394): add `text-base` to each className (same iOS zoom reason).
3. Textarea height: `h-64` → `h-40 sm:h-64`.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run build`
Expected: PASS / build succeeds.

Run: `npm run dev`, then in browser devtools toggle device emulation (iPhone-size viewport) and click through: landing → resume form → mode select → chat interview (type a message with emulated touch) → cancel. Expected: no horizontal scroll, buttons reachable, chat input visible.

```bash
git add components/VoiceInterview.tsx components/InterviewChat.tsx App.tsx
git commit -m "feat: responsive pass — dvh chat height, stacked voice controls, 16px inputs"
```

---

### Task 6: HTTPS LAN dev loop

`getUserMedia` requires a secure context; `http://<lan-ip>:3000` from the phone is refused before any audio code runs. A self-signed-HTTPS dev mode keeps the console-forward loop usable from the phone.

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install the plugin**

Run: `npm install -D @vitejs/plugin-basic-ssl`

- [ ] **Step 2: Wire it behind a dedicated mode**

In `vite.config.ts`, add the import and make the plugin list mode-dependent:

```ts
import basicSsl from '@vitejs/plugin-basic-ssl';
```

Change the `plugins` line to:

```ts
plugins: [
  ...(mode === 'lan-https' ? [basicSsl()] : []),
  react(),
  consoleForwardPlugin(),
],
```

In `package.json` scripts, add:

```json
"dev:phone": "vite --mode lan-https"
```

**Note on env loading:** `loadEnv(mode, '.', '')` loads `.env.local` regardless of mode, so `VITE_GEMINI_API_KEY` keeps working — but verify (Step 3) since Vite also looks for `.env.lan-https` files that don't exist.

- [ ] **Step 3: Verify from the phone (HUMAN STEP — needs the physical phone)**

Run: `npm run dev:phone`, find the Mac's LAN IP (`ipconfig getifaddr en0`), open `https://<lan-ip>:3000` on the iPhone, accept the self-signed-certificate warning (Advanced → Visit Website).
Expected: app loads; tapping Start Voice triggers the mic permission prompt (proving secure context); browser console lines appear in the terminal via console-forward.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "feat: dev:phone script — self-signed HTTPS for LAN testing from the phone"
```

---

### Task 7: Vercel deploy (HUMAN-IN-LOOP)

No code changes — Vite static builds are auto-detected by Vercel. These steps need Hunter's accounts; agent prepares, Hunter authenticates.

- [ ] **Step 1: Push the repo to GitHub**

```bash
gh auth status || echo "HUMAN: run 'gh auth login' (or type '! gh auth login' in the Claude prompt)"
gh repo create hireprep-ai --private --source=. --push
```

- [ ] **Step 2 (HUMAN): Import to Vercel and set the env var**

In the Vercel dashboard: Add New Project → import `hireprep-ai` → framework preset auto-detects Vite → before deploying, add environment variable `VITE_GEMINI_API_KEY` = (the key from `.env.local`) for Production + Preview. Deploy.

(CLI alternative: `npx vercel login`, `npx vercel link`, `npx vercel env add VITE_GEMINI_API_KEY`, `npx vercel --prod`.)

- [ ] **Step 3 (HUMAN): Key posture per spec §5**

- Keep the deployment URL unshared.
- In Google AI Studio / Cloud console, set quota caps (and application restrictions if available) on this API key.
- Optionally enable Vercel deployment protection if the plan supports it.

- [ ] **Step 4: Verify the production URL on desktop**

Open the deployed URL: landing renders, a text interview round-trips (proves the env var reached the build).

---

### Task 8: Sync stale docs

**Files:**
- Modify: `CLAUDE.md` (project-level, in `hireprep-ai/`)

- [ ] **Step 1: Fix the silence-zeroing claim and document the resampler**

In `CLAUDE.md` under "Key Technical Details", the doc claims RMS silence-zeroing exists in the mic path — it doesn't (the feature was removed at some point; neither `VoiceInterview.tsx` nor `lib/audioWorklet.ts` zero-fills). Replace that claim with the current reality:

- Mic chunks are sent unconditionally (no silence-zeroing).
- The recorder worklet resamples from the actual context rate to 16kHz (`lib/resample.ts` embedded via `toString()`), because iOS Safari ignores the requested context rate.
- VoiceInterview has an iOS gesture gate for suspended AudioContexts and holds a screen wake lock during interviews.

Also note the new `dev:phone` script under Development Commands.

(The workspace-level `CLAUDE.md` one directory up repeats the silence-zeroing claim — flag it to Hunter rather than editing, since that file describes multiple projects.)

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: sync CLAUDE.md — resampler/gesture-gate/wake-lock; remove stale silence-zeroing claim"
```

---

### Task 9: Real-device verification (HUMAN, spec §6)

Against a Vercel URL (or `dev:phone`) on the iPhone:

- [ ] 1. Complete a full **voice interview** — connect, converse, finish. (If the "Tap to begin" overlay appears, it should unblock audio.)
- [ ] 2. Inspect the **transcript**: coherent text, no slow-motion garbage (that's the resampler's job).
- [ ] 3. Complete a full **text interview** — keyboard doesn't cover the input, no page zoom on focus.
- [ ] 4. Feedback renders; history persists on reload; **Export as Markdown** produces a file on iOS (Safari shows a download/share affordance).
- [ ] 5. Screen stays awake during a ≥3-minute voice interview.
- [ ] 6. Camera PiP toggles on (front camera) or fails gracefully.

Record any failures as new issues; do not patch ad-hoc without a failing reproduction.
