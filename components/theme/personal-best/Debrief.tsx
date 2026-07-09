import React from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useCountUp, useIsMobile } from '../hooks';

export interface DebriefProps {
  state: 'loading' | 'error' | 'success';
  errorMessage?: string;
  onRetry: () => void;
  score?: number;
  roleLabel?: string;
  levelLabel?: string;
  questionCount?: number;
  modeLabel?: 'voice' | 'text';
  personaName?: string | null;
  strengths?: string[];
  improvements?: string[];
  detailedAnalysis?: string;
  rewriteExample?: { before: string; after: string; critique: string } | null;
  onPracticeAgain: () => void;
  onExportMarkdown: () => void;
  onViewSessionLog: () => void;
  onBackToDashboard: () => void;
}

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setTheme } = useTheme();
  const isMobile = useIsMobile();
  return (
    <div style={{ minHeight: '100vh', background: '#101208', color: '#f2f4e4', fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 20px' : '16px 40px', borderBottom: '1px solid #2a2d1a', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 26, height: 26, background: '#d4f222', display: 'grid', placeItems: 'center', color: '#101208', fontWeight: 700, fontSize: 15 }}>H</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>HIREPREP</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 20 }}>
          {!isMobile && <span style={{ fontSize: 12, letterSpacing: '0.16em', color: '#a9ad91' }}>DEBRIEF</span>}
          <button
            type="button"
            onClick={() => setTheme('transcript')}
            title="Switch to the Transcript theme"
            style={{ background: 'none', border: '1px solid #3a3e24', color: '#a9ad91', padding: '7px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box' }}
          >
            SWITCH OUTFIT
          </button>
        </div>
      </div>
      {children}
    </div>
  );
};

const PersonalBestDebrief: React.FC<DebriefProps> = (props) => {
  const {
    state, errorMessage, onRetry,
    score = 0, roleLabel, levelLabel, questionCount, modeLabel,
    personaName, strengths = [], improvements = [], detailedAnalysis,
    rewriteExample, onPracticeAgain, onExportMarkdown, onViewSessionLog, onBackToDashboard,
  } = props;

  const animatedScore = useCountUp(score, state === 'success');
  const isMobile = useIsMobile();

  if (state === 'loading') {
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: isMobile ? '96px 20px' : '160px 48px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,242,34,.35), transparent 70%)', animation: 'hpPulseFade 1.6s ease-in-out infinite' }} />
          <div style={{ fontSize: 13, letterSpacing: '0.2em', color: '#a9ad91' }}>SCORING YOUR REP…</div>
        </div>
      </Shell>
    );
  }

  if (state === 'error') {
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: isMobile ? '96px 20px' : '160px 48px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, letterSpacing: '0.2em', color: '#8a8f5e' }}>DEBRIEF FAILED TO LOAD</div>
          <div style={{ fontSize: 15, color: '#a9ad91', maxWidth: 460, lineHeight: 1.6 }}>{errorMessage ?? 'Something went wrong while scoring this rep.'}</div>
          <button
            type="button"
            onClick={onRetry}
            style={{ background: '#d4f222', color: '#101208', padding: '14px 32px', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box' }}
          >
            RETRY
          </button>
        </div>
      </Shell>
    );
  }

  const metaLine = [roleLabel, questionCount != null ? `${questionCount} QUESTIONS` : null, modeLabel ? modeLabel.toUpperCase() : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Shell>
      {/* SCORE HERO */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr', gap: isMobile ? 28 : 64, alignItems: 'center', padding: isMobile ? '40px 20px' : '64px 48px', borderBottom: '1px solid #2a2d1a', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: '-5%', top: '-40%', width: '45%', height: '180%', background: 'radial-gradient(ellipse at center, rgba(212,242,34,.08), transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{ fontSize: 'clamp(5rem, 22vw, 12.5rem)', fontWeight: 700, letterSpacing: '-0.06em', lineHeight: 1, color: '#d4f222', textShadow: '0 0 60px rgba(212,242,34,.45)' }}>{animatedScore}</div>
          <div style={{ fontSize: 13, letterSpacing: '0.18em', color: '#a9ad91', marginTop: 10 }}>
            OUT OF 100{levelLabel ? ` · ${levelLabel.toUpperCase()} CALIBRATION` : ''}
          </div>
        </div>
        <div style={{ position: 'relative', textAlign: isMobile ? 'center' : 'left' }}>
          {metaLine && (
            <div style={{ fontSize: 12, letterSpacing: '0.2em', color: '#d4f222', marginBottom: 14 }}>{metaLine}</div>
          )}
          <h1 style={{ margin: '0 auto', fontSize: 'clamp(1.75rem, 5.5vw, 2.75rem)', lineHeight: 1.1, fontWeight: 700, letterSpacing: '-0.02em', maxWidth: 640 }}>
            {detailedAnalysis ?? 'Debrief complete.'}
          </h1>
        </div>
      </div>

      {/* PERSONA REVEAL */}
      {personaName && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, padding: isMobile ? '28px 20px' : '36px 48px', borderBottom: '1px solid #2a2d1a', background: 'linear-gradient(90deg, rgba(212,242,34,.05), transparent 60%)' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.2em', color: '#d4f222', marginBottom: 10 }}>THE REVEAL</div>
            <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, letterSpacing: '-0.01em' }}>
              You drew <span style={{ color: '#d4f222' }}>{personaName}.</span>
            </div>
          </div>
        </div>
      )}

      {/* FINDINGS */}
      {(strengths.length > 0 || improvements.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', borderBottom: '1px solid #2a2d1a' }}>
          <div style={{ padding: isMobile ? '28px 20px' : '44px 48px', borderRight: isMobile ? undefined : '1px solid #2a2d1a', borderBottom: isMobile ? '1px solid #2a2d1a' : undefined }}>
            <div style={{ fontSize: 12, letterSpacing: '0.2em', color: '#d4f222', marginBottom: 24 }}>WHAT LANDED</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {strengths.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 16 }}>
                  <span style={{ color: '#d4f222', fontWeight: 700, flex: 'none' }}>✓</span>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: '#f2f4e4' }}>{s}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: isMobile ? '28px 20px' : '44px 48px' }}>
            <div style={{ fontSize: 12, letterSpacing: '0.2em', color: '#a9ad91', marginBottom: 24 }}>WHAT COST YOU</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {improvements.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 16 }}>
                  <span style={{ color: '#8a8f5e', fontWeight: 700, flex: 'none' }}>✗</span>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: '#a9ad91' }}>{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REWRITE */}
      {rewriteExample && (
        <div style={{ padding: isMobile ? '28px 20px' : '44px 48px', borderBottom: '1px solid #2a2d1a' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.2em', color: '#d4f222', marginBottom: 24 }}>STUDY THIS — ANSWER REWRITE</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 20 : 32 }}>
            <div style={{ border: '1px solid #2a2d1a', padding: '26px 28px' }}>
              <div style={{ fontSize: 11.5, letterSpacing: '0.14em', color: '#a9ad91', marginBottom: 14 }}>WHAT YOU SAID</div>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: '#a9ad91' }}>{rewriteExample.before}</p>
            </div>
            <div style={{ border: '1px solid #d4f222', padding: '26px 28px', boxShadow: '0 0 40px rgba(212,242,34,.12)' }}>
              <div style={{ fontSize: 11.5, letterSpacing: '0.14em', color: '#d4f222', marginBottom: 14 }}>STRONGER VERSION</div>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: '#f2f4e4' }}>{rewriteExample.after}</p>
            </div>
          </div>
          {rewriteExample.critique && (
            <p style={{ margin: '20px 0 0', fontSize: 13, lineHeight: 1.6, color: '#a9ad91', maxWidth: 760 }}>{rewriteExample.critique}</p>
          )}
        </div>
      )}

      {/* NEXT REP */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 24 : 40, padding: isMobile ? '32px 20px' : 48, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, letterSpacing: '-0.01em' }}>Run it again.</div>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#a9ad91' }}>Same role, fresh questions, new persona from the deck.</p>
        </div>
        <div style={{ display: 'flex', gap: 14, flex: 'none', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onBackToDashboard}
            style={{ border: '1px solid #3a3e24', padding: '16px 28px', fontSize: 14, fontWeight: 600, color: '#f2f4e4', background: 'none', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box', flex: isMobile ? '1 1 calc(50% - 7px)' : 'none' }}
          >
            DASHBOARD
          </button>
          <button
            type="button"
            onClick={onExportMarkdown}
            style={{ border: '1px solid #3a3e24', padding: '16px 28px', fontSize: 14, fontWeight: 600, color: '#f2f4e4', background: 'none', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box', flex: isMobile ? '1 1 calc(50% - 7px)' : 'none' }}
          >
            EXPORT MARKDOWN
          </button>
          <button
            type="button"
            onClick={onViewSessionLog}
            style={{ border: '1px solid #3a3e24', padding: '16px 28px', fontSize: 14, fontWeight: 600, color: '#f2f4e4', background: 'none', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box', flex: isMobile ? '1 1 calc(50% - 7px)' : 'none' }}
          >
            SESSION LOG
          </button>
          <button
            type="button"
            onClick={onPracticeAgain}
            style={{ background: '#d4f222', color: '#101208', padding: '16px 32px', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box', flex: isMobile ? '1 1 100%' : 'none' }}
          >
            START NEXT REP →
          </button>
        </div>
      </div>
    </Shell>
  );
};

export default PersonalBestDebrief;
