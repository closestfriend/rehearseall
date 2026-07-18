
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { mintLiveToken } from '../services/apiClient';
import { ResumeData } from '../types';
import { audioWorkletCode, base64Encode } from '../lib/audioWorklet';
import { parseLiveSessionSignal } from '../lib/liveSessionSignals';
import ThemedVoiceInterviewChrome from './theme/ThemedVoiceInterviewChrome';

// Rough proxy for "questions asked" (one interviewer turn ≈ one question) — the
// client has no other way to know where Gemini is in its own 5-7 question plan.
const TOTAL_QUESTIONS_ESTIMATE = 6;

interface VoiceInterviewProps {
  resume: ResumeData;
  lastPersonaId?: string;
  onPersonaPicked: (persona: { id: string; name: string }) => void;
  onFinish: (transcript: string[]) => void;
  onCancel: () => void;
}

const VoiceInterview: React.FC<VoiceInterviewProps> = ({ resume, lastPersonaId, onPersonaPicked, onFinish, onCancel }) => {
  const [isConnecting, setIsConnecting] = useState(true);
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'idle'>('connecting');
  const [volume, setVolume] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Presentational-only state for the themed chrome — purely additive, does not
  // touch the audio pipeline or session lifecycle below.
  const [questionCount, setQuestionCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [muted, setMuted] = useState(false);

  // High-level logs for the evaluation
  const transcriptionRef = useRef<string[]>([]);
  
  // Temporary buffers to collect fragmented text chunks
  // These do NOT block audio processing
  const currentInputBuffer = useRef<string>('');
  const currentOutputBuffer = useRef<string>('');
  
  const audioCtxRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isInitializedRef = useRef(false);
  // Gemini Live sessions have a max duration; the server sends a `goAway`
  // warning before force-closing (code 1008). These track the reconnect
  // dance: latest resumable handle, the in-flight session promise (so the
  // mic-audio sender always targets the current socket, not a stale one),
  // whether a deliberate reconnect is underway (to ignore the expected
  // onclose it triggers), and whether we've unmounted (to abort mid-flight).
  const resumeHandleRef = useRef<string | undefined>(undefined);
  // Server-issued ids from the initial token mint; reconnect mints echo them
  // so the locked system instruction/voice stay identical across sockets.
  const sessionIdRef = useRef<string | null>(null);
  const personaIdRef = useRef<string | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const isReconnectingRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const gestureResolveRef = useRef<(() => void) | null>(null);

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext) => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  // Flushes the accumulated text into the final transcript history
  const flushBuffers = useCallback(() => {
    const input = currentInputBuffer.current.trim();
    const output = currentOutputBuffer.current.trim();
    
    if (input) {
      transcriptionRef.current.push(`Candidate: ${input}`);
      currentInputBuffer.current = '';
    }
    if (output) {
      transcriptionRef.current.push(`Interviewer: ${output}`);
      currentOutputBuffer.current = '';
      setQuestionCount(c => c + 1);
    }
    setLiveTranscript('');
  }, []);

  const startSession = useCallback(async () => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      streamRef.current = stream;

      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioCtxRef.current = { input: inCtx, output: outCtx };

      // iOS autoplay policy: contexts may start suspended. Block here until the
      // user taps the overlay, whose handler resumes them inside the gesture.
      if (inCtx.state === 'suspended' || outCtx.state === 'suspended') {
        setNeedsGesture(true);
        await new Promise<void>((resolve) => { gestureResolveRef.current = resolve; });
      }

      const blob = new Blob([audioWorkletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await inCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const source = inCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(inCtx, 'recorder-worklet');
      source.connect(workletNode);
      workletNode.connect(inCtx.destination);

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
            onopen: () => {
              setIsConnecting(false);
              setStatus('listening');
            },
            onmessage: async (message) => {
              // 1. PROCESS AUDIO (PRIORITY - ZERO LAG)
              if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
                setStatus('speaking');
                const base64 = message.serverContent.modelTurn.parts[0].inlineData.data;
                const bytes = decode(base64);
                const buffer = await decodeAudioData(bytes, outCtx);
                const source = outCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(outCtx.destination);

                const startAt = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                source.start(startAt);
                nextStartTimeRef.current = startAt + buffer.duration;
                sourcesRef.current.add(source);

                source.onended = () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) {
                    setStatus('listening');
                  }
                };
              }

              // Handle interruption (e.g. user starts talking over the AI)
              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setStatus('listening');
              }

              // 2. PROCESS TEXT (BACKGROUND - NO LAG IMPACT)
              if (message.serverContent?.inputTranscription?.text) {
                 currentInputBuffer.current += message.serverContent.inputTranscription.text;
                 setLiveTranscript(currentInputBuffer.current);
              }
              if (message.serverContent?.outputTranscription?.text) {
                 currentOutputBuffer.current += message.serverContent.outputTranscription.text;
                 setLiveTranscript(currentOutputBuffer.current);
              }

              // Box up the text segments when the turn is complete
              if (message.serverContent?.turnComplete) {
                flushBuffers();
              }

              // 3. SESSION LIFECYCLE — capture resumption handles, and
              // proactively reconnect on `goAway` instead of letting the
              // server hard-abort the socket (code 1008) once its
              // session-duration limit is reached.
              const signal = parseLiveSessionSignal(message);
              if (signal.resumableHandle) {
                resumeHandleRef.current = signal.resumableHandle;
              }
              if (signal.goAway && !isReconnectingRef.current && !isUnmountedRef.current) {
                isReconnectingRef.current = true;
                setStatus('connecting');
                const staleSession = await sessionPromiseRef.current;
                staleSession?.close();
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
              }
            },
            onerror: (e) => {
              console.error("Voice Socket Error:", e);
              if (!isReconnectingRef.current) setStatus('idle');
            },
            onclose: (e) => {
              // A close we triggered ourselves mid-reconnect is expected —
              // the real (or lack of a) closure is whatever connectLive()
              // does next, not this one.
              if (isReconnectingRef.current) return;
              console.error("Voice Socket Closed:", { code: e?.code, reason: e?.reason, wasClean: e?.wasClean, raw: e });
              setStatus('idle');
            }
          }
        });
      };

      sessionPromiseRef.current = connectLive();

      workletNode.port.onmessage = (e) => {
        const pcm16 = e.data as Int16Array;
        let sum = 0;
        for (let i = 0; i < pcm16.length; i++) sum += pcm16[i] * pcm16[i];
        setVolume(Math.sqrt(sum / pcm16.length) / 32768);
        const data = base64Encode(pcm16);
        sessionPromiseRef.current?.then(s => s.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } }));
      };

      sessionRef.current = await sessionPromiseRef.current;
    } catch (err) {
      console.error("Failed to start voice session:", err);
      setIsConnecting(false);
      setStatus('idle');
    }
  }, [resume, lastPersonaId, onPersonaPicked, flushBuffers]);

  useEffect(() => {
    startSession();
    return () => {
      isUnmountedRef.current = true;
      sessionRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
      videoStreamRef.current?.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) {
        audioCtxRef.current.input.close();
        audioCtxRef.current.output.close();
        audioCtxRef.current = null;
      }
      // Intentionally NOT resetting isInitializedRef — the guard exists to
      // suppress StrictMode's double-mount, which reuses the same refs.
    };
  }, [startSession]);

  // Keep the screen on during the interview; re-acquire when the tab
  // regains visibility (the lock is auto-released on backgrounding).
  useEffect(() => {
    let lock: any = null;
    let done = false;
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) {
          const l = await (navigator as any).wakeLock.request('screen');
          if (done) { l.release().catch(() => {}); return; }
          lock = l;
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

  useEffect(() => {
    if (cameraOn && videoElRef.current && videoStreamRef.current) {
      videoElRef.current.srcObject = videoStreamRef.current;
    }
  }, [cameraOn]);

  // Presentational-only elapsed timer for the themed chrome — isolated from
  // the audio/session effects above.
  useEffect(() => {
    const id = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  }, []);

  const handleBeginTap = useCallback(async () => {
    const ctxs = audioCtxRef.current;
    try {
      if (ctxs && ctxs.input.state !== 'closed' && ctxs.output.state !== 'closed') {
        await Promise.all([ctxs.input.resume(), ctxs.output.resume()]);
      }
    } catch (err) {
      console.error('Failed to resume audio contexts:', err);
    } finally {
      setNeedsGesture(false);
      gestureResolveRef.current?.();
      gestureResolveRef.current = null;
    }
  }, []);

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

  const handleFinish = () => {
    flushBuffers(); // Final check
    onFinish(transcriptionRef.current);
  };

  return (
    <>
      <ThemedVoiceInterviewChrome
        roleLabel={resume.role}
        levelLabel={resume.experienceLevel}
        status={status}
        isConnecting={isConnecting}
        volume={volume}
        questionCount={questionCount}
        totalQuestions={TOTAL_QUESTIONS_ESTIMATE}
        elapsedSeconds={elapsedSeconds}
        liveTranscript={liveTranscript}
        needsGesture={needsGesture}
        onBeginTap={handleBeginTap}
        cameraOn={cameraOn}
        cameraError={cameraError}
        onToggleCamera={toggleCamera}
        muted={muted}
        onMute={toggleMute}
        onFinish={handleFinish}
        onCancel={onCancel}
      />
      {cameraOn && (
        <video
          ref={videoElRef}
          autoPlay
          muted
          playsInline
          style={{
            position: 'fixed',
            top: 84,
            right: 24,
            width: 160,
            height: 120,
            borderRadius: 12,
            objectFit: 'cover',
            transform: 'scaleX(-1)',
            border: '1px solid rgba(255,255,255,.2)',
            boxShadow: '0 8px 24px rgba(0,0,0,.4)',
            zIndex: 10,
          }}
        />
      )}
    </>
  );
};

export default VoiceInterview;
