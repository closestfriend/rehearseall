import React, { useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useIsMobile } from '../hooks';

interface ModePickerProps {
  roleLabel: string;
  levelLabel: string;
  lengthLabel: string;
  mode: 'voice' | 'text';
  onModeChange: (m: 'voice' | 'text') => void;
  onStart: () => void;
  onBack: () => void; // back to Resume Upload
}

const ElectedStamp: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: -14,
      right: 16,
      transform: 'rotate(-6deg)',
      border: '2.5px solid #b3402a',
      color: '#b3402a',
      background: '#fbfaf6',
      fontSize: 11.5,
      fontWeight: 700,
      letterSpacing: '0.22em',
      padding: '4px 11px',
      animation: 'hpStamp .5s cubic-bezier(.22,1,.36,1)',
    }}
  >
    ELECTED
  </div>
);

const TranscriptModePicker: React.FC<ModePickerProps> = ({
  roleLabel,
  levelLabel,
  lengthLabel,
  mode,
  onModeChange,
  onStart,
  onBack,
}) => {
  const { setTheme } = useTheme();
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState<string | null>(null);

  const cardStyle = (key: 'voice' | 'text'): React.CSSProperties => ({
    position: 'relative',
    border: '1px dashed #b9b4a5',
    padding: isMobile ? '28px 22px 24px' : '34px 30px 28px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    background: hovered === key && mode !== key ? '#f4f0e4' : 'transparent',
    transition: 'border-color .2s, background .2s',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#e9e6dc', padding: '0 0 48px', color: '#1c1b18', fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', minHeight: '100vh', background: '#fbfaf6', boxShadow: '0 2px 24px rgba(28,27,24,.12)', display: 'flex', flexDirection: 'column' }}>

        {/* TOP BAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 20px' : '16px 64px', borderBottom: '1px dashed #b9b4a5', flex: 'none', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 10 : 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.06em' }}>REHEARSE_ALL_</span>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, letterSpacing: '0.18em', color: '#6d685c', fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: '#6d685c', animation: 'hpPulseFade 1.4s ease-in-out infinite' }} />
              PRE-TRIAL FILING
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16 }}>
            <button
              type="button"
              onClick={() => setTheme('personal-best')}
              title="Switch to the Personal Best theme"
              style={{ background: 'none', border: 'none', color: '#6d685c', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: 0, minHeight: isMobile ? 44 : undefined }}
            >
              {isMobile ? '[outfit]' : '[switch outfit]'}
            </button>
            <button
              type="button"
              onClick={onBack}
              onMouseEnter={() => setHovered('back')}
              onMouseLeave={() => setHovered(null)}
              style={{ fontSize: 12, color: hovered === 'back' ? '#b3402a' : '#6d685c', border: `1px solid ${hovered === 'back' ? '#b3402a' : '#b9b4a5'}`, padding: isMobile ? '10px 16px' : '7px 16px', background: 'none', cursor: 'pointer', fontFamily: 'inherit', minHeight: isMobile ? 44 : undefined, transition: 'border-color .2s, color .2s' }}
            >
              ← amend exhibits
            </button>
          </div>
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, letterSpacing: '0.14em', color: '#6d685c', fontWeight: 700, width: '100%' }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: '#6d685c', animation: 'hpPulseFade 1.4s ease-in-out infinite' }} />
              PRE-TRIAL FILING
            </div>
          )}
        </div>

        {/* CASE HEADER */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'baseline', gap: isMobile ? 4 : 0, padding: isMobile ? '16px 20px 12px' : '20px 64px 14px', flex: 'none', fontSize: 12, color: '#6d685c' }}>
          <span>IN RE: {roleLabel.toUpperCase()} ({levelLabel.toUpperCase()}) — ELECTION OF PROCEEDINGS</span>
          <span>STEP 2 OF 2</span>
        </div>

        {/* PROGRESS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, padding: isMobile ? '0 20px 16px' : '0 64px 18px', borderBottom: '1px dashed #b9b4a5', flex: 'none' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.12em', color: '#6d685c', flex: 'none' }}>FILING</span>
          <div style={{ flex: 1, height: 8, border: '1px solid #1c1b18' }}>
            <div style={{ width: '100%', height: '100%', background: 'repeating-linear-gradient(45deg, #b3402a 0 3px, transparent 3px 6px)' }} />
          </div>
          {!isMobile && <span style={{ fontSize: 11, color: '#8a8471', flex: 'none' }}>next: question 1</span>}
        </div>

        {/* BODY */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr' }}>
          <div style={{ padding: isMobile ? '28px 20px 12px' : '48px 24px 48px 64px', borderRight: isMobile ? 'none' : '1px dashed #b9b4a5', borderBottom: isMobile ? '1px dashed #d8d3c3' : 'none', fontSize: 12, color: '#6d685c', lineHeight: isMobile ? 1.6 : 2 }}>
            ELECTION<br />— form of{isMobile ? ' ' : <br />}proceedings{!isMobile && <><br /><br />one must be<br />elected</>}
          </div>

          <div style={{ padding: isMobile ? '28px 20px 40px' : '48px 64px 56px', display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(1.6rem, 5.5vw, 2.125rem)', lineHeight: 1.2, fontWeight: 400, letterSpacing: '-0.02em' }}>
              Elect the form <span style={{ background: '#1c1b18', color: '#fbfaf6', padding: '0 10px' }}>of proceedings.</span>
            </h1>
            <p style={{ margin: isMobile ? '0 0 28px' : '0 0 40px', fontSize: 13.5, lineHeight: 1.8, color: '#54503f', maxWidth: 560 }}>
              Same situation, same record, same findings. Only the manner of rehearsal differs.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 28, alignItems: 'stretch' }}>

              {/* VOICE CARD */}
              <div
                onClick={() => onModeChange('voice')}
                onMouseEnter={() => setHovered('voice')}
                onMouseLeave={() => setHovered(null)}
                role="radio"
                aria-checked={mode === 'voice'}
                style={cardStyle('voice')}
              >
                {mode === 'voice' && (
                  <>
                    <div style={{ position: 'absolute', inset: -1, border: '2px solid #1c1b18', pointerEvents: 'none' }} />
                    <ElectedStamp />
                  </>
                )}
                <div style={{ width: 52, height: 52, borderRadius: 999, background: 'radial-gradient(circle at 38% 32%, #d4694c, #b3402a 55%, #5e2115)', boxShadow: '0 0 26px rgba(179,64,42,.3)', animation: 'hpOrbBreathe 3.4s ease-in-out infinite' }} />
                <div>
                  <div style={{ fontSize: 11, letterSpacing: '0.18em', color: '#b3402a', fontWeight: 700, marginBottom: 8 }}>ORAL ARGUMENT — voice</div>
                  <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em' }}>Testify out loud.</div>
                </div>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.8, color: '#54503f', textWrap: 'pretty' }}>
                  You speak; the reporter transcribes. Follow-ups arrive in real time — nearest thing to the actual hearing.
                </p>
                <div style={{ marginTop: 'auto', fontSize: 11.5, color: '#8a8471' }}>{lengthLabel} · timed pacing · microphone required</div>
              </div>

              {/* TEXT CARD */}
              <div
                onClick={() => onModeChange('text')}
                onMouseEnter={() => setHovered('text')}
                onMouseLeave={() => setHovered(null)}
                role="radio"
                aria-checked={mode === 'text'}
                style={cardStyle('text')}
              >
                {mode === 'text' && (
                  <>
                    <div style={{ position: 'absolute', inset: -1, border: '2px solid #1c1b18', pointerEvents: 'none' }} />
                    <ElectedStamp />
                  </>
                )}
                <div style={{ width: 52, height: 52, border: '1px solid #1c1b18', display: 'flex', alignItems: 'center', padding: '0 11px', boxSizing: 'border-box' }}>
                  <span style={{ display: 'inline-block', width: 9, height: 20, background: '#b3402a', animation: 'hpCaret 1.1s step-end infinite' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: '0.18em', color: '#b3402a', fontWeight: 700, marginBottom: 8 }}>WRITTEN DEPOSITION — text</div>
                  <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em' }}>Answer for the record.</div>
                </div>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.8, color: '#54503f', textWrap: 'pretty' }}>
                  Typed testimony, untimed. Same follow-ups, same findings — with room to compose before you submit.
                </p>
                <div style={{ marginTop: 'auto', fontSize: 11.5, color: '#8a8471' }}>{lengthLabel} · untimed · no microphone needed</div>
              </div>
            </div>

            {/* ACTIONS */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 16 : 0, marginTop: 44, paddingTop: 26, borderTop: '1px dashed #b9b4a5' }}>
              <span style={{ fontSize: 12, color: '#8a8471', textAlign: isMobile ? 'center' : 'left' }}>
                [the examiner&apos;s persona is drawn at random — unsealed in the debrief]
              </span>
              <button
                type="button"
                onClick={onStart}
                onMouseEnter={() => setHovered('start')}
                onMouseLeave={() => setHovered(null)}
                style={{ display: 'inline-block', background: hovered === 'start' ? '#b3402a' : '#1c1b18', color: '#fbfaf6', padding: '15px 30px', fontSize: 13.5, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'background .2s', fontFamily: 'inherit', minHeight: 44 }}
              >
                BEGIN EXAMINATION →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptModePicker;
