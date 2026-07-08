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
  listening: 'MIC LIVE',
  speaking: 'EXAMINER SPEAKING',
  idle: 'STANDING BY',
};

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const TranscriptVoiceInterviewChrome: React.FC<VoiceInterviewChromeProps> = ({
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
  const remaining = Math.max(0, totalQuestions - questionCount);
  const orbScale = 1 + Math.min(0.16, volume * 0.35);

  return (
    <div style={{ minHeight: '100vh', background: '#e9e6dc', padding: '0 0 48px', fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: '#1c1b18' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', minHeight: '100vh', background: '#fbfaf6', boxShadow: '0 2px 24px rgba(28,27,24,.12)', display: 'flex', flexDirection: 'column' }}>

        {/* TOP BAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 64px', borderBottom: '1px dashed #b9b4a5', flex: 'none' }}>
          <button type="button" onClick={onCancel} style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', color: '#1c1b18', padding: 0, fontFamily: 'inherit' }}>
            HIREPREP_
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, letterSpacing: '0.18em', color: '#b3402a', fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: '#b3402a', animation: 'hpPulseFade 1.4s ease-in-out infinite' }} />
            PROCEEDINGS IN SESSION
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              type="button"
              onClick={onToggleCamera}
              title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
              style={{ fontSize: 11, color: cameraOn ? '#b3402a' : '#8a8471', border: '1px solid #b9b4a5', padding: '6px 12px', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {cameraOn ? '[cam: on]' : '[cam: off]'}
            </button>
            <button type="button" onClick={onFinish} style={{ fontSize: 12, color: '#6d685c', border: '1px solid #b9b4a5', padding: '7px 16px', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              adjourn
            </button>
          </div>
        </div>

        {/* CASE HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '20px 64px 14px', flex: 'none', fontSize: 12, color: '#6d685c' }}>
          <span>IN RE: {roleLabel.toUpperCase()} ({levelLabel.toUpperCase()}) — EXAMINATION UNDERWAY</span>
          <span>{formatElapsed(elapsedSeconds)} elapsed</span>
        </div>

        {/* PROGRESS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 64px 18px', borderBottom: '1px dashed #b9b4a5', flex: 'none' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.12em', color: '#6d685c', flex: 'none' }}>
            Q. <span style={{ color: '#1c1b18', fontWeight: 700, fontSize: 14 }}>{questionCount}</span> OF {totalQuestions}
          </span>
          <div style={{ flex: 1, height: 8, border: '1px solid #1c1b18' }}>
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: 'repeating-linear-gradient(45deg, #b3402a 0 3px, transparent 3px 6px)',
                transition: 'width .4s ease',
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: '#8a8471', flex: 'none' }}>{remaining} remain</span>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '48px 64px', minHeight: 480 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 44 }}>
            <div style={{ position: 'relative', width: 150, height: 150, display: 'grid', placeItems: 'center', marginBottom: 22 }}>
              <div
                style={{
                  position: 'absolute',
                  inset: -24,
                  borderRadius: 999,
                  background: 'radial-gradient(circle, rgba(179,64,42,.22), transparent 70%)',
                  animation: 'hpOrbBreathe 3.4s ease-in-out infinite',
                }}
              />
              <div
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 999,
                  background: 'radial-gradient(circle at 38% 32%, #d4694c, #b3402a 55%, #5e2115)',
                  boxShadow: `0 0 ${40 + volume * 40}px rgba(179,64,42,${0.28 + Math.min(0.3, volume * 0.4)})`,
                  animation: 'hpOrbBreathe 3.4s ease-in-out infinite',
                  transform: `scale(${orbScale})`,
                  transition: 'transform .12s ease-out, box-shadow .12s ease-out',
                }}
              />
            </div>
            <div style={{ fontSize: 11, letterSpacing: '0.22em', color: '#b3402a', fontWeight: 700 }}>
              {isConnecting ? 'CONNECTING…' : STATUS_LABEL[status]}
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#6d685c', marginBottom: 32 }}>AUDIO PROCEEDING — LIVE TRANSCRIPTION FOLLOWS</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 30, maxWidth: 860 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#b3402a' }}>YOU:</span>
              <span style={{ fontSize: 16, lineHeight: 1.75, color: '#54503f' }}>
                {liveTranscript || (isConnecting ? 'Establishing the record…' : '')}
                <span
                  style={{
                    display: 'inline-block',
                    width: '0.55em',
                    height: '1.1em',
                    background: '#b3402a',
                    verticalAlign: '-0.15em',
                    marginLeft: 6,
                    animation: 'hpCaret 1.1s step-end infinite',
                  }}
                />
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6d685c', paddingLeft: 138 }}>
              [reporter&apos;s note: transcribing as you speak — take your time]
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', gap: 14, paddingTop: 48, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onMute}
              style={{ border: `1px solid ${muted ? '#b3402a' : '#b9b4a5'}`, padding: '13px 26px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: 'none', color: muted ? '#b3402a' : '#1c1b18', fontFamily: 'inherit' }}
            >
              {muted ? 'UNMUTE MIC' : 'MUTE MIC'}
            </button>
            <button type="button" disabled title="Coming soon" style={{ border: '1px solid #d8d3c3', padding: '13px 26px', fontSize: 12.5, fontWeight: 600, cursor: 'default', background: 'none', color: '#8a8471', fontFamily: 'inherit' }}>
              READ BACK QUESTION
            </button>
            <button
              type="button"
              onClick={onFinish}
              style={{ background: '#1c1b18', color: '#fbfaf6', padding: '13px 26px', fontSize: 12.5, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              REST YOUR CASE →
            </button>
            {cameraError && (
              <span style={{ fontSize: 11, color: '#8a8471' }}>{cameraError}</span>
            )}
          </div>
        </div>
      </div>

      {needsGesture && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(233,230,220,.96)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 28,
          }}
        >
          <div style={{ width: 90, height: 90, borderRadius: 999, background: 'radial-gradient(circle at 38% 32%, #d4694c, #b3402a 55%, #5e2115)', boxShadow: '0 0 50px rgba(179,64,42,.3)', animation: 'hpOrbBreathe 3.4s ease-in-out infinite' }} />
          <div style={{ fontSize: 13, letterSpacing: '0.08em', color: '#6d685c', textAlign: 'center', maxWidth: 320 }}>
            THE COURT REQUIRES A TAP BEFORE AUDIO MAY BEGIN
          </div>
          <button
            type="button"
            onClick={onBeginTap}
            style={{ background: '#1c1b18', color: '#fbfaf6', padding: '16px 32px', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            TAP TO BEGIN →
          </button>
        </div>
      )}
    </div>
  );
};

export default TranscriptVoiceInterviewChrome;
