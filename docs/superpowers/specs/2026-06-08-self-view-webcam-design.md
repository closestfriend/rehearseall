# Optional self-view webcam (voice interview) — design

**Date:** 2026-06-08
**Status:** Approved, pending implementation plan
**Scope:** `components/VoiceInterview.tsx` only

## Goal

Let candidates optionally see their own webcam during a **voice** interview, to make
practice feel closer to a real video call. The self-view is a mirror for the
candidate's benefit only — the video is never analyzed or transmitted.

## Decisions (locked during brainstorming)

1. **Self-view only.** Video is attached to a local `<video>` element and never sent
   to Gemini's Live API, the evaluator, or any network endpoint.
2. **Optional, off by default.** The current interview flow is unchanged unless the
   candidate explicitly turns the camera on.
3. **Voice mode only.** Text/chat mode stays text-only. All changes live in
   `VoiceInterview.tsx`.
4. **Toggle inside the interview.** No new screens and no pre-start toggle; a camera
   button in the voice interview screen enables/disables the self-view at any time,
   including mid-interview.
5. **PiP thumbnail layout.** The self-view is a small rounded tile in the top-right
   corner of the existing card. The interviewer's pulsing orb remains the centerpiece.

## Non-goals (explicitly out of scope)

- AI analysis of video (body language, eye contact, attire).
- Camera/device selection picker.
- Recording or saving video.
- Webcam in text/chat mode.
- A pre-start (format-selection screen) camera toggle.

These are deliberately deferred. The design keeps video acquisition isolated so any of
them could be added later without a rewrite.

## Architecture

All changes are contained in `components/VoiceInterview.tsx`. No changes to
`constants.ts`, `services/geminiService.ts`, `App.tsx`, `types.ts`, or the Live API
configuration. The audio capture/streaming pipeline is untouched.

### New state

- `cameraOn: boolean` — default `false`. Drives the toggle label and whether the PiP
  tile renders.
- `cameraError: string | null` — set when camera acquisition fails (permission denied
  or no device); surfaced as a small inline message.

### New refs

- `videoStreamRef: MediaStream | null` — the webcam stream, held for teardown.
- `videoElRef` — ref to the `<video>` element for attaching `srcObject`.

### Video acquisition

A **separate** call:

```js
navigator.mediaDevices.getUserMedia({ video: true, audio: false })
```

This is fully independent of the existing audio stream (`streamRef`) and the Live
session (`sessionRef`). `audio: false` is required so we never open a second microphone
capture that could conflict with the voice pipeline.

## Toggle behavior

A third control labeled "Camera" sits alongside the existing Cancel / End buttons.

- **Off → label "Turn on camera"; On → "Turn off camera."**
- **Enable:** request the video stream, attach it to the `<video>` element's
  `srcObject`, set `cameraOn = true`, clear `cameraError`.
- **Failure on enable:** catch the error, set `cameraError` (e.g. "Camera unavailable"),
  leave `cameraOn = false`. The interview continues normally.
- **Disable:** stop all video tracks, clear the element's `srcObject`, set
  `cameraOn = false`.
- Freely toggleable mid-interview.

## Self-view rendering (PiP)

Rendered only when `cameraOn` is true:

- A rounded thumbnail (~128px wide) absolutely positioned in the top-right of the
  existing card.
- `<video autoPlay muted playsInline>` — muted and `playsInline` are required for
  autoplay without sound and for iOS Safari.
- Mirrored with CSS `transform: scaleX(-1)` (standard self-view convention so it reads
  like a mirror).
- `object-cover` to fill the tile; `rounded-2xl` with a subtle border/shadow to match
  the card's visual language.

`cameraError`, when set, renders as a small muted line near the camera control rather
than a blocking alert.

## Lifecycle / cleanup

- The existing unmount `useEffect` cleanup gains video-track teardown
  (`videoStreamRef.current?.getTracks().forEach(t => t.stop())`), so leaving the screen
  via End, Cancel, or any navigation always releases the camera and turns off the OS
  camera indicator light.
- Camera acquisition is user-triggered, so it is independent of the `isInitializedRef`
  StrictMode guard and does not double-open under React 19 StrictMode.

## Error handling summary

| Situation | Behavior |
|---|---|
| User denies camera permission | Catch, show "Camera unavailable", stay off, interview continues |
| No camera device present | Same as denial |
| User toggles off | Stop tracks, clear `srcObject`, indicator light off |
| User leaves screen (End/Cancel) | Cleanup stops video tracks regardless of toggle state |

## Testing notes

- Manual: enable camera → self-view appears mirrored top-right; audio interview
  continues working; toggle off → tile disappears and indicator light goes off; End
  interview with camera on → light goes off.
- Permission-denied path: deny the browser prompt → inline "Camera unavailable", no
  crash, interview proceeds.
- No automated test is planned for the media path (browser-permission/hardware bound);
  the existing `constants.test.ts` is unaffected.
