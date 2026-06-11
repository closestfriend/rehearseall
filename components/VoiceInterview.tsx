
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { MODELS, buildInterviewerSystemInstruction, InterviewerPersona } from '../constants';
import { ResumeData } from '../types';
import { audioWorkletCode, base64Encode } from '../lib/audioWorklet';

interface VoiceInterviewProps {
  resume: ResumeData;
  persona: InterviewerPersona;
  onFinish: (transcript: string[]) => void;
  onCancel: () => void;
}

const VoiceInterview: React.FC<VoiceInterviewProps> = ({ resume, persona, onFinish, onCancel }) => {
  const [isConnecting, setIsConnecting] = useState(true);
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'idle'>('connecting');
  const [volume, setVolume] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
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
    }
  }, []);

  const startSession = useCallback(async () => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
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

      const sessionPromise = ai.live.connect({
        model: MODELS.VOICE_INTERVIEWER,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.voiceId } }
          },
          systemInstruction: buildInterviewerSystemInstruction(resume, persona),
          inputAudioTranscription: {},
          outputAudioTranscription: {}
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
            }
            if (message.serverContent?.outputTranscription?.text) {
               currentOutputBuffer.current += message.serverContent.outputTranscription.text;
            }

            // Box up the text segments when the turn is complete
            if (message.serverContent?.turnComplete) {
              flushBuffers();
            }
          },
          onerror: (e) => {
            console.error("Voice Socket Error:", e);
            setStatus('idle');
          },
          onclose: (e) => {
            console.error("Voice Socket Closed:", { code: e?.code, reason: e?.reason, wasClean: e?.wasClean, raw: e });
            setStatus('idle');
          }
        }
      });

      workletNode.port.onmessage = (e) => {
        const pcm16 = e.data as Int16Array;
        let sum = 0;
        for (let i = 0; i < pcm16.length; i++) sum += pcm16[i] * pcm16[i];
        setVolume(Math.sqrt(sum / pcm16.length) / 32768);
        const data = base64Encode(pcm16);
        sessionPromise.then(s => s.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } }));
      };

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to start voice session:", err);
      setIsConnecting(false);
      setStatus('idle');
    }
  }, [resume, persona, flushBuffers]);

  useEffect(() => {
    startSession();
    return () => {
      sessionRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
      videoStreamRef.current?.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) {
        audioCtxRef.current.input.close();
        audioCtxRef.current.output.close();
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
          lock = await (navigator as any).wakeLock.request('screen');
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

  const handleBeginTap = useCallback(async () => {
    const ctxs = audioCtxRef.current;
    if (ctxs) {
      await Promise.all([ctxs.input.resume(), ctxs.output.resume()]);
    }
    setNeedsGesture(false);
    gestureResolveRef.current?.();
    gestureResolveRef.current = null;
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

  const getStatusColor = () => {
    switch(status) {
      case 'listening': return 'text-green-500 bg-green-50';
      case 'speaking': return 'text-blue-500 bg-blue-50';
      case 'connecting': return 'text-amber-500 bg-amber-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-10 text-center relative overflow-hidden">
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
        <div className={`absolute top-0 left-0 w-full h-1 transition-all duration-500 ${status === 'speaking' ? 'bg-blue-500' : status === 'listening' ? 'bg-green-500' : 'bg-transparent'}`} />

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
        
        <div className="mb-10">
          <div className="relative inline-block">
            <div className={`absolute inset-0 rounded-full transition-all duration-300 border-2 ${status === 'listening' ? 'border-green-200 scale-150 opacity-20' : status === 'speaking' ? 'border-blue-200 scale-125 opacity-20' : 'opacity-0'}`} />
            
            <div 
              className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-150 ${status === 'speaking' ? 'bg-blue-50' : 'bg-gray-50'}`}
              style={{ transform: `scale(${1 + volume * 0.4})` }}
            >
              <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${status === 'speaking' ? 'bg-blue-600 shadow-xl shadow-blue-200' : 'bg-white shadow-lg border border-gray-100'}`}>
                {status === 'speaking' ? (
                  <div className="flex items-end gap-1.5 h-8">
                    <div className="w-1.5 bg-white rounded-full animate-[bounce_0.6s_infinite] h-4" />
                    <div className="w-1.5 bg-white rounded-full animate-[bounce_0.6s_infinite_0.1s] h-8" />
                    <div className="w-1.5 bg-white rounded-full animate-[bounce_0.6s_infinite_0.2s] h-6" />
                  </div>
                ) : (
                  <svg className={`w-12 h-12 transition-colors duration-300 ${status === 'listening' ? 'text-green-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-10-4V5a2 2 0 012-2h4a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2z" />
                  </svg>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-10 space-y-3">
            <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${getStatusColor()}`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${status === 'listening' ? 'bg-green-500 animate-pulse' : status === 'speaking' ? 'bg-blue-500' : 'bg-gray-400'}`} />
              {status}
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {isConnecting ? "Initializing AI..." : status === 'speaking' ? "Interviewer is Speaking" : "Listening to You..."}
            </h2>
            <p className="text-gray-500 max-w-sm mx-auto">
              Speak naturally as you would in a real interview. Use the button below when you're done.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <button 
            onClick={onCancel}
            className="px-6 py-4 border border-gray-100 text-gray-500 rounded-2xl font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
          >
            Cancel
          </button>
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
        {cameraError && (
          <p className="mt-3 text-xs text-gray-400">{cameraError}</p>
        )}
      </div>
    </div>
  );
};

export default VoiceInterview;
