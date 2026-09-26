import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createLiveSession, describeLiveScreenFrame } from '../services/apiClient';
import { PracticeSetup } from '../types';
import ThemedVoiceInterviewChrome from './theme/ThemedVoiceInterviewChrome';
import { practiceDetail, practiceTitle } from '../lib/practiceSetup';
import { canShareScreen, captureScreenFrame } from '../lib/screenShare';

const TOTAL_QUESTIONS_ESTIMATE = 6;

interface VoiceInterviewProps {
  setup: PracticeSetup;
  lastPersonaId?: string;
  onPersonaPicked: (persona: { id: string; name: string }) => void;
  onFinish: (transcript: string[]) => void;
  onCancel: () => void;
}

type LiveEvent = { type?: string; delta?: string; error?: { message?: string }; [key: string]: unknown };

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    const timeout = window.setTimeout(done, 8000);
    function done() {
      window.clearTimeout(timeout);
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    }
    function onChange() {
      if (pc.iceGatheringState === 'complete') done();
    }
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

const VoiceInterview: React.FC<VoiceInterviewProps> = ({ setup, lastPersonaId, onPersonaPicked, onFinish, onCancel }) => {
  const [isConnecting, setIsConnecting] = useState(true);
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'idle'>('connecting');
  const [volume, setVolume] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [muted, setMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);

  const transcriptionRef = useRef<string[]>([]);
  const currentInputBuffer = useRef('');
  const currentOutputBuffer = useRef('');
  const transcriptTimerRef = useRef<number | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const eventsRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenIntervalRef = useRef<number | null>(null);
  const screenFrameBusyRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const sessionAttemptRef = useRef(0);
  const screenShareActiveRef = useRef(false);
  const sessionStartedRef = useRef<((event: LiveEvent) => void) | null>(null);
  const sessionClosedRef = useRef<(() => void) | null>(null);
  const screenShareAvailable = canShareScreen(
    setup,
    typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined,
  );

  const flushBuffers = useCallback(() => {
    if (transcriptTimerRef.current !== null) {
      window.clearTimeout(transcriptTimerRef.current);
      transcriptTimerRef.current = null;
    }
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

  const scheduleTranscriptFlush = useCallback(() => {
    if (transcriptTimerRef.current !== null) window.clearTimeout(transcriptTimerRef.current);
    transcriptTimerRef.current = window.setTimeout(flushBuffers, 1400);
  }, [flushBuffers]);

  const handleLiveEvent = useCallback((event: LiveEvent) => {
    if (event.type === 'session.started') {
      sessionStartedRef.current?.(event);
      sessionStartedRef.current = null;
      setIsConnecting(false);
      setStatus('listening');
      const channel = eventsRef.current;
      if (channel?.readyState === 'open') {
        channel.send(JSON.stringify({
          type: 'session.instructions.append',
          event_id: `greeting_${crypto.randomUUID()}`,
          delegation_id: null,
          content: `Greet the user now in English. ${setup.kind === 'conversation'
            ? 'Begin the conversation naturally as the stated counterpart.'
            : 'Briefly introduce yourself and ask the first question.'} Then pause and listen.`,
        }));
      }
      void audioElRef.current?.play().catch(() => setNeedsGesture(true));
      return;
    }
    if (event.type === 'session.closed') {
      sessionClosedRef.current?.();
      sessionClosedRef.current = null;
      return;
    }
    if (event.type === 'error' || event.type === 'session.error') {
      console.error('GPT-Live event error:', event.error ?? event);
      setIsConnecting(false);
      setStatus('idle');
      return;
    }
    if (event.type === 'response.created' || event.type === 'response.output_audio.started') {
      setStatus('speaking');
      return;
    }
    if (event.type === 'session.input_transcript.delta' && typeof event.delta === 'string') {
      currentInputBuffer.current += event.delta;
      setLiveTranscript(currentInputBuffer.current);
      scheduleTranscriptFlush();
      return;
    }
    if (event.type === 'session.output_transcript.delta' && typeof event.delta === 'string') {
      currentOutputBuffer.current += event.delta;
      setLiveTranscript(currentOutputBuffer.current);
      setStatus('speaking');
      scheduleTranscriptFlush();
      return;
    }
    if (event.type === 'response.done') {
      flushBuffers();
      setStatus('listening');
    }
  }, [flushBuffers, scheduleTranscriptFlush, setup]);

  const startSession = useCallback(async () => {
    const attempt = ++sessionAttemptRef.current;
    isUnmountedRef.current = false;
    const isCurrentAttempt = () => attempt === sessionAttemptRef.current && !isUnmountedRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
      if (!isCurrentAttempt()) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      peer.addTrack(stream.getAudioTracks()[0], stream);
      peer.ontrack = event => {
        if (audioElRef.current) {
          audioElRef.current.srcObject = event.streams[0];
          void audioElRef.current.play().catch(() => setNeedsGesture(true));
        }
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
          setIsConnecting(false);
          setStatus('idle');
        }
      };

      const events = peer.createDataChannel('oai-events');
      eventsRef.current = events;
      events.onmessage = message => {
        try { handleLiveEvent(JSON.parse(message.data) as LiveEvent); }
        catch (error) { console.error('Could not parse GPT-Live event:', error); }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIceGathering(peer);
      const sdp = peer.localDescription?.sdp;
      if (!sdp) throw new Error('The browser did not create a WebRTC offer.');

      const session = await createLiveSession({ setup, lastPersonaId, sdp });
      if (!isCurrentAttempt()) { peer.close(); return; }
      onPersonaPicked({ id: session.personaId, name: session.personaName });
      const started = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          sessionStartedRef.current = null;
          reject(new Error('GPT-Live did not finish starting the voice session.'));
        }, 20_000);
        sessionStartedRef.current = () => { window.clearTimeout(timeout); resolve(); };
      });
      await peer.setRemoteDescription({ type: 'answer', sdp: session.sdp });
      await started;
    } catch (err) {
      console.error('Failed to start GPT-Live voice session:', err);
      setIsConnecting(false);
      setStatus('idle');
    }
  }, [handleLiveEvent, lastPersonaId, onPersonaPicked, setup]);

  const stopScreenShare = useCallback(() => {
    screenShareActiveRef.current = false;
    if (screenIntervalRef.current !== null) {
      window.clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = null;
    }
    displayStreamRef.current?.getTracks().forEach(track => track.stop());
    displayStreamRef.current = null;
    if (screenVideoRef.current) {
      screenVideoRef.current.pause();
      screenVideoRef.current.srcObject = null;
    }
    screenVideoRef.current = null;
    screenCanvasRef.current = null;
    setScreenSharing(false);
  }, []);

  useEffect(() => {
    startSession();
    return () => {
      isUnmountedRef.current = true;
      sessionAttemptRef.current += 1;
      if (transcriptTimerRef.current !== null) window.clearTimeout(transcriptTimerRef.current);
      eventsRef.current?.close();
      peerRef.current?.close();
      streamRef.current?.getTracks().forEach(track => track.stop());
      videoStreamRef.current?.getTracks().forEach(track => track.stop());
      stopScreenShare();
    };
  }, [startSession, stopScreenShare]);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let done = false;
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) {
          const next = await (navigator as Navigator & { wakeLock: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
          if (done) { await next.release().catch(() => {}); return; }
          lock = next;
        }
      } catch { /* Unsupported or denied — rehearsal proceeds. */ }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible' && !done) void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (cameraOn && videoElRef.current && videoStreamRef.current) videoElRef.current.srcObject = videoStreamRef.current;
  }, [cameraOn]);

  useEffect(() => {
    const id = window.setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(previous => {
      const next = !previous;
      streamRef.current?.getAudioTracks().forEach(track => { track.enabled = !next; });
      return next;
    });
  }, []);

  const handleBeginTap = useCallback(async () => {
    try { await audioElRef.current?.play(); }
    catch (err) { console.error('Failed to enable voice playback:', err); }
    setNeedsGesture(false);
  }, []);

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      videoStreamRef.current?.getTracks().forEach(track => track.stop());
      videoStreamRef.current = null;
      if (videoElRef.current) videoElRef.current.srcObject = null;
      setCameraOn(false);
      return;
    }
    try {
      videoStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCameraError(null);
      setCameraOn(true);
    } catch (err) {
      console.error('Failed to start camera:', err);
      setCameraError('Camera unavailable');
      setCameraOn(false);
    }
  }, [cameraOn]);

  const sendScreenFrame = useCallback(async () => {
    if (!screenShareActiveRef.current || screenFrameBusyRef.current || !screenVideoRef.current || !screenCanvasRef.current) return;
    const data = captureScreenFrame(screenVideoRef.current, screenCanvasRef.current);
    if (!data) return;
    screenFrameBusyRef.current = true;
    try {
      const result = await describeLiveScreenFrame({ image: `data:image/jpeg;base64,${data}` });
      const channel = eventsRef.current;
      if (screenShareActiveRef.current && !isUnmountedRef.current && channel?.readyState === 'open') {
        channel.send(JSON.stringify({
          type: 'session.thinking.append',
          event_id: `screen_${crypto.randomUUID()}`,
          delegation_id: null,
          content: `Current shared-screen observation (visual evidence): ${result.description}`,
        }));
      }
    } catch (error) {
      console.error('Failed to describe shared screen:', error);
      setScreenShareError('Could not interpret the shared screen. Voice practice can continue.');
    } finally {
      screenFrameBusyRef.current = false;
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) { stopScreenShare(); return; }
    if (!screenShareAvailable) return;
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = displayStream;
      await video.play();
      displayStreamRef.current = displayStream;
      screenVideoRef.current = video;
      screenCanvasRef.current = document.createElement('canvas');
      screenShareActiveRef.current = true;
      displayStream.getVideoTracks()[0]?.addEventListener('ended', stopScreenShare, { once: true });
      setScreenShareError(null);
      setScreenSharing(true);
      void sendScreenFrame();
      screenIntervalRef.current = window.setInterval(() => { void sendScreenFrame(); }, 5000);
    } catch (err) {
      console.error('Failed to share screen:', err);
      stopScreenShare();
      setScreenShareError('Screen sharing was not started. Choose a window or screen and try again.');
    }
  }, [screenShareAvailable, screenSharing, sendScreenFrame, stopScreenShare]);

  const handleFinish = async () => {
    stopScreenShare();
    flushBuffers();
    const channel = eventsRef.current;
    if (channel?.readyState === 'open') {
      await new Promise<void>(resolve => {
        const timeout = window.setTimeout(resolve, 1500);
        sessionClosedRef.current = () => { window.clearTimeout(timeout); resolve(); };
        channel.send(JSON.stringify({ type: 'session.close' }));
      });
    }
    onFinish(transcriptionRef.current);
  };

  const handleCancel = () => { stopScreenShare(); onCancel(); };

  return (
    <>
      <audio ref={audioElRef} autoPlay style={{ display: 'none' }} />
      <ThemedVoiceInterviewChrome
        roleLabel={practiceTitle(setup)}
        levelLabel={practiceDetail(setup)}
        status={status}
        isConnecting={isConnecting}
        volume={volume}
        questionCount={questionCount}
        totalQuestions={setup.kind === 'rehearsal' ? setup.targetQuestionCount : TOTAL_QUESTIONS_ESTIMATE}
        elapsedSeconds={elapsedSeconds}
        liveTranscript={liveTranscript}
        needsGesture={needsGesture}
        onBeginTap={handleBeginTap}
        cameraOn={cameraOn}
        cameraError={cameraError}
        onToggleCamera={toggleCamera}
        screenShareAvailable={screenShareAvailable}
        screenSharing={screenSharing}
        screenShareError={screenShareError}
        onToggleScreenShare={toggleScreenShare}
        muted={muted}
        onMute={toggleMute}
        onFinish={handleFinish}
        onCancel={handleCancel}
      />
      {cameraOn && (
        <video ref={videoElRef} autoPlay muted playsInline style={{
          position: 'fixed', top: 84, right: 24, width: 160, height: 120, borderRadius: 12,
          objectFit: 'cover', transform: 'scaleX(-1)', border: '1px solid rgba(255,255,255,.2)',
          boxShadow: '0 8px 24px rgba(0,0,0,.4)', zIndex: 10,
        }} />
      )}
    </>
  );
};

export default VoiceInterview;
