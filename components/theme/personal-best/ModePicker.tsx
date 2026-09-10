import React from 'react';
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

interface ModeCardProps {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
  footnote: string;
  isMobile: boolean;
}

const ModeCard: React.FC<ModeCardProps> = ({ selected, onSelect, icon, label, title, description, footnote, isMobile }) => (
  <div
    role="button"
    tabIndex={0}
    aria-pressed={selected}
    onClick={onSelect}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
    style={{
      position: 'relative',
      border: '1px solid #2a2d1a',
      background: 'linear-gradient(160deg, rgba(212,242,34,.06), transparent 55%)',
      padding: isMobile ? '28px 22px 26px' : '36px 32px 32px',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      transition: 'border-color .2s',
    }}
  >
    {selected && (
      <>
        <div style={{ position: 'absolute', inset: -1, border: '2px solid #d4f222', boxShadow: '0 0 44px rgba(212,242,34,.2)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 16, right: 16, background: '#d4f222', color: '#101208', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', padding: '5px 10px' }}>SELECTED</div>
      </>
    )}
    {icon}
    <div>
      <div style={{ fontSize: 12, letterSpacing: '0.2em', color: '#d4f222', fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
    </div>
    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: '#a9ad91' }}>{description}</p>
    <div style={{ marginTop: 'auto', fontSize: 12, color: '#6d7157', letterSpacing: '0.06em' }}>{footnote}</div>
  </div>
);

const PersonalBestModePicker: React.FC<ModePickerProps> = ({
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#101208', color: '#f2f4e4', fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* TOP BAR — setup state: muted dot, SESSION SETUP */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 10 : 0, padding: isMobile ? '14px 20px' : '16px 40px', borderBottom: '1px solid #2a2d1a', flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 26, height: 26, background: '#d4f222', display: 'grid', placeItems: 'center', color: '#101208', fontWeight: 700, fontSize: 15 }}>H</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#f2f4e4' }}>REHEARSE_ALL</span>
          </div>
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, letterSpacing: '0.16em', color: '#a9ad91' }}>
              <span data-anim="" style={{ width: 7, height: 7, borderRadius: 99, background: '#8a8f5e', animation: 'hpBlink 1.6s ease-in-out infinite' }} />
              SESSION SETUP
            </div>
          )}
        </div>
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, letterSpacing: '0.16em', color: '#a9ad91' }}>
            <span data-anim="" style={{ width: 7, height: 7, borderRadius: 99, background: '#8a8f5e', animation: 'hpBlink 1.6s ease-in-out infinite' }} />
            SESSION SETUP
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end', gap: isMobile ? 12 : 24, fontSize: 12.5, color: '#a9ad91', flexWrap: 'wrap' }}>
          <span>{roleLabel} · {levelLabel.toUpperCase()}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setTheme('transcript')}
              title="Switch to the Transcript theme"
              style={{ background: 'none', border: '1px solid #3a3e24', color: '#a9ad91', padding: isMobile ? '9px 12px' : '9px 16px', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box', fontFamily: 'inherit' }}
            >
              {isMobile ? 'OUTFIT' : 'SWITCH OUTFIT'}
            </button>
            <button
              type="button"
              onClick={onBack}
              style={{ background: 'none', border: '1px solid #3a3e24', padding: '8px 18px', fontSize: 12.5, fontWeight: 600, color: '#a9ad91', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box', fontFamily: 'inherit' }}
            >
              ← BACK
            </button>
          </div>
        </div>
      </div>

      {/* STEP TRACKER — 100% fill */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, padding: isMobile ? '12px 20px' : '14px 40px', borderBottom: '1px solid #2a2d1a', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <span style={{ fontSize: 12, letterSpacing: '0.14em', color: '#a9ad91', flex: 'none' }}>
          STEP <span style={{ color: '#f2f4e4', fontWeight: 700 }}>2</span> / 2 — THE EVENT
        </span>
        <div style={{ flex: 1, height: 4, background: '#2a2d1a', minWidth: isMobile ? '100%' : undefined, order: isMobile ? 3 : 0 }}>
          <div style={{ width: '100%', height: '100%', background: '#d4f222', boxShadow: '0 0 12px rgba(212,242,34,.5)' }} />
        </div>
        <span style={{ fontSize: 12, color: '#a9ad91', flex: 'none' }}>next: question 1</span>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: isMobile ? '36px 20px 40px' : '56px 40px', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(2rem, 6vw, 2.75rem)', lineHeight: 1.02, letterSpacing: '-0.03em', fontWeight: 700 }}>Pick your event.</h1>
        <p style={{ margin: isMobile ? '0 0 32px' : '0 0 44px', fontSize: 15, lineHeight: 1.6, color: '#a9ad91', maxWidth: 560 }}>
          Same situation, same debrief. Voice trains pacing in the moment; text lets you think before you commit.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 20 : 28, alignItems: 'stretch' }}>
          <ModeCard
            selected={mode === 'voice'}
            onSelect={() => onModeChange('voice')}
            isMobile={isMobile}
            icon={
              <div
                data-anim=""
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  background: 'radial-gradient(circle at 38% 32%, #e9fa6e, #d4f222 55%, #5c6a10)',
                  boxShadow: '0 0 30px rgba(212,242,34,.4)',
                  animation: 'hpOrbBreathe 3.2s ease-in-out infinite',
                }}
              />
            }
            label="VOICE REP"
            title="Out loud, in the moment."
            description="You speak, it listens. Real-time follow-ups, real pacing — the closest thing to the actual room."
            footnote={`${lengthLabel} · timed pacing · mic required`}
          />
          <ModeCard
            selected={mode === 'text'}
            onSelect={() => onModeChange('text')}
            isMobile={isMobile}
            icon={
              <div style={{ width: 56, height: 56, border: '1px solid #3a3e24', display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box' }}>
                <span data-anim="" style={{ display: 'inline-block', width: 10, height: 22, background: '#d4f222', animation: 'hpCaret 1.1s step-end infinite' }} />
              </div>
            }
            label="TEXT REP"
            title="Typed, on your clock."
            description="Write your answers, untimed. Same follow-ups, same scoring — with room to structure before you submit."
            footnote={`${lengthLabel} · untimed · no mic needed`}
          />
        </div>

        {/* ACTIONS */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 18 : 0, marginTop: 44, paddingTop: 28, borderTop: '1px solid #2a2d1a' }}>
          <span style={{ fontSize: 12.5, color: '#6d7157', textAlign: isMobile ? 'center' : 'left' }}>persona drawn at random — revealed in the debrief</span>
          <button
            type="button"
            onClick={onStart}
            style={{
              display: 'inline-block',
              background: '#d4f222',
              color: '#101208',
              padding: '16px 36px',
              fontSize: 14,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              minHeight: 44,
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              width: isMobile ? '100%' : undefined,
            }}
          >
            START THE REP →
          </button>
        </div>
      </div>
    </div>
  );
};

export default PersonalBestModePicker;
