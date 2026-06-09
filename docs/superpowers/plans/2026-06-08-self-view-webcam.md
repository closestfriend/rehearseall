# Optional Self-View Webcam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let candidates optionally turn on their webcam as a mirror-only self-view during a voice interview, with the video never leaving the browser.

**Architecture:** All changes are contained in `components/VoiceInterview.tsx`. A camera toggle requests a separate video-only `MediaStream` (independent of the existing audio stream and Live session), attaches it to a `<video>` element, and renders it as a mirrored picture-in-picture tile in the top-right of the existing card. No Live API, evaluator, or audio-pipeline changes.

**Tech Stack:** React 19 + TypeScript, Web Media APIs (`navigator.mediaDevices.getUserMedia`), Tailwind utility classes, Vite dev server.

---

## File Structure

- **Modify:** `components/VoiceInterview.tsx` — the only file touched. Adds camera state/refs, a toggle handler, a stream-attach effect, cleanup teardown, the toggle button, and the PiP `<video>` tile.

No new files. No changes to `constants.ts`, `services/geminiService.ts`, `App.tsx`, or `types.ts`.

## Testing Approach

The webcam path depends on browser permission prompts and physical hardware, so it is verified manually in the browser against `npm run dev`, not with automated tests. Each task ends with a concrete manual verification and a commit. The pre-existing `constants.test.ts` must continue to pass and is not modified.

Before starting, in one terminal run:

```bash
npm run dev
```

Open the app (http://localhost:3000, or 3001 if 3000 is taken), upload a resume, choose **Voice Interview**, and keep that screen open to verify each task. Note: the OS camera indicator light is the ground-truth signal that the stream is open or released.

---

### Task 1: Camera state, toggle handler, attach effect, and cleanup

**Files:**
- Modify: `components/VoiceInterview.tsx`

This task adds all the camera logic and a working toggle button (no PiP tile yet, so the self-view won't be visible — but the permission prompt and the OS indicator light let us verify the stream opens and releases correctly).

- [ ] **Step 1: Add camera state**

In `components/VoiceInterview.tsx`, find the existing state declarations (around line 16-18):

```tsx
  const [isConnecting, setIsConnecting] = useState(true);
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'idle'>('connecting');
  const [volume, setVolume] = useState(0);
```

Add two new state lines immediately after the `volume` line:

```tsx
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
```

- [ ] **Step 2: Add camera refs**

Find the existing `streamRef` declaration (around line 29):

```tsx
  const streamRef = useRef<MediaStream | null>(null);
```

Add two new refs immediately after it:

```tsx
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
```

- [ ] **Step 3: Add the toggle handler**

Find the existing `handleFinish` function (around line 202):

```tsx
  const handleFinish = () => {
    flushBuffers(); // Final check
    onFinish(transcriptionRef.current);
  };
```

Add this `toggleCamera` handler immediately **before** `handleFinish`:

```tsx
  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      videoStreamRef.current?.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
      if (videoElRef.current) videoElRef.current.srcObject = null;
      setCameraOn(false);
      return;
    }
    try {
      const vstream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoStreamRef.current = vstream;
      setCameraError(null);
      setCameraOn(true);
    } catch (err) {
      console.error("Failed to start camera:", err);
      setCameraError("Camera unavailable");
      setCameraOn(false);
    }
  }, [cameraOn]);
```

Note: `useCallback` is already imported on line 2. The enable path sets the stream ref and `cameraOn` but does **not** touch `videoElRef` directly, because the `<video>` element is only mounted once `cameraOn` is true. The next step attaches the stream after that render.

- [ ] **Step 4: Add the stream-attach effect**

Find the existing lifecycle `useEffect` that calls `startSession()` (around line 188-200). Add a **new, separate** `useEffect` immediately after it:

```tsx
  useEffect(() => {
    if (cameraOn && videoElRef.current && videoStreamRef.current) {
      videoElRef.current.srcObject = videoStreamRef.current;
    }
  }, [cameraOn]);
```

This attaches the already-acquired stream to the `<video>` element once it mounts (after `cameraOn` flips to true).

- [ ] **Step 5: Add video teardown to unmount cleanup**

In the existing lifecycle `useEffect` (the one calling `startSession()`), find its cleanup return (around line 190-199):

```tsx
    return () => {
      sessionRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) {
        audioCtxRef.current.input.close();
        audioCtxRef.current.output.close();
      }
```

Add a video-track teardown line immediately after the `streamRef` teardown line:

```tsx
      sessionRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
      videoStreamRef.current?.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) {
```

This guarantees the camera is released when the user leaves the screen (End/Cancel/navigation) regardless of toggle state.

- [ ] **Step 6: Add a temporary toggle button**

So this task is verifiable before the PiP tile exists, add the real camera button now. Find the controls grid (around line 259):

```tsx
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={onCancel}
            className="px-6 py-4 border border-gray-100 text-gray-500 rounded-2xl font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
          >
            Cancel
          </button>
```

Change `grid-cols-2` to `grid-cols-3`:

```tsx
        <div className="grid grid-cols-3 gap-4">
```

Then find the closing of the End Interview button and the grid (around line 266-273):

```tsx
          <button 
            onClick={handleFinish}
            className="px-6 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg shadow-gray-200 flex items-center justify-center gap-2"
          >
            End Interview
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </div>
```

Insert a new camera button **between** the End Interview `</button>` and the closing `</div>`:

```tsx
          <button 
            onClick={handleFinish}
            className="px-6 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg shadow-gray-200 flex items-center justify-center gap-2"
          >
            End Interview
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
          <button
            onClick={toggleCamera}
            className="px-6 py-4 border border-gray-100 text-gray-500 rounded-2xl font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
          >
            {cameraOn ? 'Turn off camera' : 'Turn on camera'}
          </button>
        </div>
```

- [ ] **Step 7: Verify the build typechecks**

Run: `npm run build`
Expected: Build completes with no TypeScript errors.

- [ ] **Step 8: Verify existing tests still pass**

Run: `npx vitest run`
Expected: PASS — `constants.test.ts` passes, nothing broken.

- [ ] **Step 9: Manual verification in the browser**

With `npm run dev` running and a Voice Interview open:
1. Click **Turn on camera** → browser shows a camera permission prompt; accept it → the OS camera indicator light turns on, button label changes to **Turn off camera**. (No video tile yet — that's Task 2.)
2. Click **Turn off camera** → indicator light turns off, label returns to **Turn on camera**.
3. Turn camera on again, then click **End Interview** → indicator light turns off (cleanup released the stream).
4. Turn camera on, then click **Turn on camera** flow again but this time **deny** the permission prompt (use a fresh incognito window or reset site permissions) → no crash; label stays **Turn on camera**; check the browser console shows the logged error.

- [ ] **Step 10: Commit**

```bash
git add components/VoiceInterview.tsx
git commit -m "feat(voice): camera stream toggle, attach effect, and cleanup"
```

---

### Task 2: PiP self-view tile and error message

**Files:**
- Modify: `components/VoiceInterview.tsx`

This task adds the visible mirrored self-view in the top-right corner and the inline error message.

- [ ] **Step 1: Add the PiP video tile**

Find the top of the card's inner content — the accent bar div right after the card opening (around line 218-219):

```tsx
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-10 text-center relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-1 transition-all duration-500 ${status === 'speaking' ? 'bg-blue-500' : status === 'listening' ? 'bg-green-500' : 'bg-transparent'}`} />
```

Insert the PiP tile immediately **after** that accent-bar `<div />` line:

```tsx
        {cameraOn && (
          <div className="absolute top-4 right-4 w-32 h-24 rounded-2xl overflow-hidden border border-gray-200 shadow-lg bg-gray-900 z-10">
            <video
              ref={videoElRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
        )}
```

The card is already `position: relative`, so `absolute top-4 right-4` anchors the tile inside it. `scaleX(-1)` mirrors the view; `object-cover` fills the tile.

- [ ] **Step 2: Add the inline error message**

Find the closing of the controls grid (the `</div>` that closes `grid grid-cols-3`, around line 273 after the camera button was added in Task 1). Insert the error message immediately **after** that grid's closing `</div>`:

```tsx
        </div>
        {cameraError && (
          <p className="mt-3 text-xs text-gray-400">{cameraError}</p>
        )}
```

- [ ] **Step 3: Verify the build typechecks**

Run: `npm run build`
Expected: Build completes with no TypeScript errors.

- [ ] **Step 4: Manual verification in the browser**

With `npm run dev` running and a Voice Interview open:
1. Click **Turn on camera** and accept → a rounded self-view tile appears in the top-right of the card, showing your camera **mirrored** (raise your right hand; it appears on the right side of the tile, like a mirror).
2. Confirm the audio interview still works — the interviewer still speaks and the orb still reacts (camera did not disturb the audio pipeline).
3. Click **Turn off camera** → the tile disappears and the indicator light goes off.
4. Deny the permission prompt (fresh incognito / reset permissions) → **Camera unavailable** appears as a small grey line under the buttons; no tile; interview continues.

- [ ] **Step 5: Commit**

```bash
git add components/VoiceInterview.tsx
git commit -m "feat(voice): mirrored PiP self-view tile and camera error message"
```

---

## Done

The feature is complete: an optional, off-by-default, mirror-only webcam self-view in the voice interview, toggleable mid-session, with the video never transmitted. All changes are in `components/VoiceInterview.tsx`.
