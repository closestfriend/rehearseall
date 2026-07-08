import React from 'react';

interface VoiceInterviewChromeProps {
  roleLabel: string;
  levelLabel: string;
  status: 'connecting' | 'listening' | 'speaking' | 'idle';
  isConnecting: boolean;
  volume: number; // roughly 0-1, mic RMS, drives orb intensity/scale
  questionCount: number; // interviewer turns completed so far
  totalQuestions: number; // fixed target, shown as e.g. 'OF 6'
  elapsedSeconds: number;
  liveTranscript: string; // latest partial/flushed transcription text, may be ''
  needsGesture: boolean;
  onBeginTap: () => void;
  cameraOn: boolean;
  cameraError: string | null;
  onToggleCamera: () => void;
  muted: boolean;
  onMute: () => void;
  onFinish: () => void;
  onCancel: () => void;
}

const STATUS_LABEL: Record<VoiceInterviewChromeProps['status'], string> = {
  connecting: 'CONNECTING',
  listening: 'YOUR MIC IS LIVE',
  speaking: 'INTERVIEWER SPEAKING',
  idle: 'STANDING BY',
};

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const WaveformBars: React.FC<{ active: boolean }> = ({ active }) => {
  const delays = [0, 0.12, 0.24, 0.36, 0.48, 0.6];
  const colors = ['#3a3e24', '#8a8f5e', '#d4f222', '#d4f222', '#8a8f5e', '#3a3e24'];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 36, marginTop: 44 }}>
      {delays.map((delay, i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: '100%',
            background: colors[i],
            transformOrigin: 'bottom',
            animation: active ? `hpBar 1s ease-in-out ${delay}s infinite` : 'none',
            transform: active ? undefined : 'scaleY(.3)',
          }}
        />
      ))}
    </div>
  );
};

const PersonalBestVoiceInterviewChrome: React.FC<VoiceInterviewChromeProps> = ({
  roleLabel,
  levelLabel,
  status,
  isConnecting,
  volume,
  questionCount,
  totalQuestions,
  elapsedSeconds,
  liveTranscript,
  needsGesture,
  onBeginTap,
  cameraOn,
  cameraError,
  onToggleCamera,
  muted,
  onMute,
  onFinish,
  onCancel,
}) => {
  const pct = totalQuestions > 0 ? Math.min(100, Math.round((questionCount / totalQuestions) * 100)) : 0;
  const speaking = status === 'speaking';
  const orbScale = 1 + Math.min(0.18, volume * 0.4);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#101208', color: '#f2f4e4', fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 40px', borderBottom: '1px solid #2a2d1a', flex: 'none' }}>
        <button type="button" onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <span style={{ width: 26, height: 26, background: '#d4f222', display: 'grid', placeItems: 'center', color: '#101208', fontWeight: 700, fontSize: 15 }}>H</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#f2f4e4' }}>HIREPREP</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, letterSpacing: '0.16em', color: '#d4f222' }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: '#d4f222', animation: 'hpBlink 1.6s ease-in-out infinite' }} />
          REP IN PROGRESS
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 12.5, color: '#a9ad91' }}>
          <span>{roleLabel} · {levelLabel.toUpperCase()}</span>
          <button
            type="button"
            onClick={onToggleCamera}
            title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
            style={{ background: 'none', border: '1px solid #2a2d1a', padding: '6px 12px', fontSize: 11, fontWeight: 600, color: cameraOn ? '#d4f222' : '#6d7157', cursor: 'pointer' }}
          >
            {cameraOn ? '● CAM' : '○ CAM'}
          </button>
          <button type="button" onClick={onFinish} style={{ border: '1px solid #3a3e24', padding: '8px 18px', fontWeight: 600, color: '#a9ad91', background: 'none', fontSize: 12.5, cursor: 'pointer' }}>
            END REP
          </button>
        </div>
      </div>

      {/* PROGRESS */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 16, padding: '14px 40px', borderBottom: '1px solid #2a2d1a' }}>
        <span style={{ fontSize: 12, letterSpacing: '0.14em', color: '#a9ad91', flex: 'none' }}>
          QUESTION <span style={{ color: '#f2f4e4', fontWeight: 700 }}>{questionCount}</span> / {totalQuestions}
        </span>
        <div style={{ flex: 1, height: 4, background: '#2a2d1a' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#d4f222', boxShadow: '0 0 12px rgba(212,242,34,.5)', transition: 'width .4s ease' }} />
        </div>
        <span style={{ fontSize: 12, color: '#a9ad91', flex: 'none' }}>{formatElapsed(elapsedSeconds)} elapsed</span>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', position: 'relative', overflow: 'hidden', minHeight: 560 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 40% at 50% 45%, rgba(212,242,34,.07), transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', width: 220, height: 220, display: 'grid', placeItems: 'center', marginBottom: 48 }}>
          <div
            style={{
              position: 'absolute',
              inset: -30,
              borderRadius: 999,
              background: 'radial-gradient(circle, rgba(212,242,34,.25), transparent 70%)',
              animation: 'hpOrbBreathe 3.2s ease-in-out infinite',
            }}
          />
          <div
            style={{
              width: 170,
              height: 170,
              borderRadius: 999,
              background: 'radial-gradient(circle at 38% 32%, #e9fa6e, #d4f222 55%, #5c6a10)',
              boxShadow: `0 0 ${60 + volume * 60}px rgba(212,242,34,${0.35 + Math.min(0.35, volume * 0.5)})`,
              animation: 'hpOrbBreathe 3.2s ease-in-out infinite',
              transform: `scale(${orbScale})`,
              transition: 'transform .12s ease-out, box-shadow .12s ease-out',
            }}
          />
        </div>

        <div style={{ fontSize: 12, letterSpacing: '0.2em', color: '#d4f222', marginBottom: 18 }}>
          {isConnecting ? 'CONNECTING…' : STATUS_LABEL[status]}
        </div>

        <p style={{ margin: 0, fontSize: 28, lineHeight: 1.4, fontWeight: 500, maxWidth: 720, textAlign: 'center' }}>
          {liveTranscript ? `"${liveTranscript}"` : isConnecting ? 'Getting the interviewer on the line…' : ' '}
        </p>

        <WaveformBars active={speaking} />
        {!speaking && <div style={{ height: 36, marginTop: 44 }} />}

        <div style={{ fontSize: 12, color: '#a9ad91', marginTop: 12 }}>
          {status === 'listening' ? 'your mic is live — answer when ready' : status === 'speaking' ? 'listen closely' : ''}
        </div>

        <div style={{ display: 'flex', gap: 14, marginTop: 44 }}>
          <button
            type="button"
            onClick={onMute}
            style={{ border: `1px solid ${muted ? '#d4f222' : '#3a3e24'}`, padding: '14px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', color: muted ? '#d4f222' : '#f2f4e4' }}
          >
            {muted ? 'UNMUTE' : 'MUTE'}
          </button>
          <button type="button" disabled title="Coming soon" style={{ border: '1px solid #2a2d1a', padding: '14px 28px', fontSize: 13, fontWeight: 600, cursor: 'default', background: 'none', color: '#6d7157' }}>
            REPEAT QUESTION
          </button>
          <button
            type="button"
            onClick={onFinish}
            style={{ background: '#d4f222', color: '#101208', padding: '14px 28px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            FINISH &amp; DEBRIEF →
          </button>
        </div>

        {cameraError && (
          <div style={{ marginTop: 16, fontSize: 11.5, color: '#a9ad91' }}>{cameraError}</div>
        )}
      </div>

      {needsGesture && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(16,18,8,.92)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 28,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div style={{ width: 90, height: 90, borderRadius: 999, background: 'radial-gradient(circle at 38% 32%, #e9fa6e, #d4f222 55%, #5c6a10)', boxShadow: '0 0 60px rgba(212,242,34,.4)', animation: 'hpOrbBreathe 3.2s ease-in-out infinite' }} />
          <div style={{ fontSize: 14, letterSpacing: '0.1em', color: '#a9ad91', textAlign: 'center', maxWidth: 320 }}>
            YOUR BROWSER NEEDS A TAP TO START AUDIO
          </div>
          <button
            type="button"
            onClick={onBeginTap}
            style={{ background: '#d4f222', color: '#101208', padding: '18px 40px', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            TAP TO BEGIN →
          </button>
        </div>
      )}
    </div>
  );
};

export default PersonalBestVoiceInterviewChrome;
