import React from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import type { DebriefProps } from '../personal-best/Debrief';
import { useIsMobile } from '../hooks';

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setTheme } = useTheme();
  const isMobile = useIsMobile();
  return (
    <div style={{ minHeight: '100vh', background: '#e9e6dc', padding: '0 0 48px', color: '#1c1b18', fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', background: '#fbfaf6', boxShadow: '0 2px 24px rgba(28,27,24,.12)' }}>
        {/* TOP BAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 20px' : '16px 64px', borderBottom: '1px dashed #b9b4a5', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 8 : 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.06em' }}>REHEARSE_ALL_</span>
          {!isMobile && <span style={{ fontSize: 11.5, letterSpacing: '0.18em', color: '#6d685c' }}>FINDINGS OF THE EXAMINER</span>}
          <button
            type="button"
            onClick={() => setTheme('personal-best')}
            title="Switch to the Personal Best theme"
            style={{ background: 'none', border: 'none', color: '#6d685c', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}
          >
            [switch outfit]
          </button>
          {isMobile && <span style={{ fontSize: 10.5, letterSpacing: '0.14em', color: '#6d685c', width: '100%' }}>FINDINGS OF THE EXAMINER</span>}
        </div>
        {children}
      </div>
    </div>
  );
};

const TranscriptDebrief: React.FC<DebriefProps> = (props) => {
  const {
    state, errorMessage, onRetry,
    score = 0, roleLabel, levelLabel, questionCount, modeLabel,
    personaName, strengths = [], improvements = [], detailedAnalysis,
    rewriteExample, onPracticeAgain, onExportMarkdown, onViewSessionLog, onBackToDashboard,
  } = props;
  const isMobile = useIsMobile();

  if (state === 'loading') {
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: isMobile ? '96px 24px' : '160px 64px' }}>
          <div style={{ fontSize: 14, letterSpacing: '0.14em', color: '#33301f' }}>
            PROCESSING TRANSCRIPT
            <span style={{ display: 'inline-block', width: '0.6em', height: '1em', verticalAlign: '-0.16em', marginLeft: 6 }}>
              <span style={{ display: 'block', width: '100%', height: '100%', background: '#b3402a', animation: 'hpCaret 1.1s step-end infinite' }} />
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: '#6d685c' }}>the examiner is reviewing the record</div>
        </div>
      </Shell>
    );
  }

  if (state === 'error') {
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: isMobile ? '80px 24px' : '140px 64px', textAlign: 'center' }}>
          <div style={{ transform: 'rotate(-8deg)', border: '3px solid #b3402a', color: '#b3402a', fontSize: 22, fontWeight: 700, letterSpacing: '0.2em', padding: '12px 24px' }}>
            OBJECTION
          </div>
          <div style={{ fontSize: 13.5, color: '#54503f', maxWidth: 460, lineHeight: 1.7 }}>{errorMessage ?? 'The record could not be entered. The court requests a re-submission.'}</div>
          <button
            type="button"
            onClick={onRetry}
            style={{ background: '#b3402a', color: '#fbfaf6', padding: '13px 28px', fontSize: 12.5, fontWeight: 700, border: 'none', fontFamily: 'inherit', cursor: 'pointer', minHeight: 44 }}
          >
            RETRY SUBMISSION
          </button>
        </div>
      </Shell>
    );
  }

  const metaLine = ['IN RE:', roleLabel, questionCount != null ? `${questionCount} QUESTIONS` : null, modeLabel ? `${modeLabel.toUpperCase()} PROCEEDING` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Shell>
      {/* SCORE */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr', gap: isMobile ? 24 : 64, alignItems: 'center', padding: isMobile ? '64px 20px 32px' : '64px', borderBottom: '1px dashed #b9b4a5', position: 'relative' }}>
        <div style={{ textAlign: isMobile ? 'left' : 'center' }}>
          <div style={{ fontSize: 'clamp(4rem, 22vw, 10rem)', fontWeight: 700, letterSpacing: '-0.06em', lineHeight: 1 }}>
            {score}<span style={{ fontSize: 34, color: '#6d685c' }}>/100</span>
          </div>
          {levelLabel && (
            <div style={{ fontSize: 11.5, color: '#6d685c', marginTop: 10, letterSpacing: '0.1em' }}>CALIBRATED — {levelLabel.toUpperCase()}</div>
          )}
        </div>
        <div>
          {metaLine && (
            <div style={{ fontSize: 12, color: '#6d685c', marginBottom: 16 }}>{metaLine}</div>
          )}
          <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 5vw, 2.125rem)', lineHeight: 1.35, fontWeight: 400, maxWidth: 640 }}>
            {detailedAnalysis ?? 'The record is complete.'}
          </h1>
        </div>
        <div
          style={{
            position: isMobile ? 'static' : 'absolute',
            top: isMobile ? undefined : 48,
            right: isMobile ? undefined : 64,
            marginTop: isMobile ? 20 : undefined,
            alignSelf: isMobile ? 'flex-start' : undefined,
            border: '3px solid #b3402a', color: '#b3402a',
            fontSize: 15, fontWeight: 700, letterSpacing: '0.22em', padding: '10px 20px',
            animation: 'hpStamp .5s cubic-bezier(.22,1,.36,1) .4s both',
            display: 'inline-block',
          }}
        >
          EXAMINED
        </div>
      </div>

      {/* PERSONA REVEAL */}
      {personaName && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr', borderBottom: '1px dashed #b9b4a5' }}>
          <div style={{ padding: isMobile ? '28px 20px 12px' : '40px 24px 40px 64px', borderRight: isMobile ? 'none' : '1px dashed #b9b4a5', borderBottom: isMobile ? '1px dashed #d8d3c3' : 'none', fontSize: 12, color: '#6d685c', lineHeight: isMobile ? 1.6 : 2 }}>
            THE SEAL,<br />BROKEN
          </div>
          <div style={{ padding: isMobile ? '20px 20px 28px' : '40px 64px', display: 'flex', alignItems: 'center', gap: 40 }}>
            <div style={{ fontSize: 'clamp(1.25rem, 5vw, 1.5rem)', fontWeight: 700 }}>
              Your examiner was <span style={{ color: '#b3402a' }}>{personaName}.</span>
            </div>
          </div>
        </div>
      )}

      {/* FINDINGS */}
      {(strengths.length > 0 || improvements.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', borderBottom: '1px dashed #b9b4a5' }}>
          <div style={{ padding: isMobile ? '28px 20px' : '44px 48px 48px 64px', borderRight: isMobile ? 'none' : '1px dashed #b9b4a5', borderBottom: isMobile ? '1px dashed #d8d3c3' : 'none' }}>
            <div style={{ fontSize: 12, letterSpacing: '0.14em', color: '#6d685c', marginBottom: 24 }}>FINDINGS FOR THE CANDIDATE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 13.5, lineHeight: 1.7, color: '#33301f' }}>
              {strengths.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 14 }}>
                  <span style={{ fontWeight: 700, flex: 'none' }}>✓</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: isMobile ? '28px 20px' : '44px 64px 48px 48px' }}>
            <div style={{ fontSize: 12, letterSpacing: '0.14em', color: '#b3402a', marginBottom: 24 }}>FINDINGS AGAINST</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 13.5, lineHeight: 1.7, color: '#54503f' }}>
              {improvements.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 14 }}>
                  <span style={{ fontWeight: 700, color: '#b3402a', flex: 'none' }}>✗</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REWRITE */}
      {rewriteExample && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr', borderBottom: '1px dashed #b9b4a5' }}>
          <div style={{ padding: isMobile ? '28px 20px 12px' : '44px 24px 44px 64px', borderRight: isMobile ? 'none' : '1px dashed #b9b4a5', borderBottom: isMobile ? '1px dashed #d8d3c3' : 'none', fontSize: 12, color: '#6d685c', lineHeight: isMobile ? 1.6 : 2 }}>
            AMENDED<br />TESTIMONY
          </div>
          <div style={{ padding: isMobile ? '20px 20px 32px' : '44px 64px 52px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 18 : 28 }}>
              <div style={{ border: '1px dashed #b9b4a5', padding: '24px 26px' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#6d685c', marginBottom: 12 }}>AS ENTERED</div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75, color: '#6d685c' }}>
                  <span style={{ textDecoration: 'line-through', textDecorationColor: '#b3402a' }}>{rewriteExample.before}</span>
                </p>
              </div>
              <div style={{ border: '1.5px solid #1c1b18', padding: '24px 26px', background: '#fffef9' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#b3402a', fontWeight: 700, marginBottom: 12 }}>AS AMENDED</div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75, color: '#1c1b18' }}>{rewriteExample.after}</p>
              </div>
            </div>
            {rewriteExample.critique && (
              <p style={{ margin: '20px 0 0', fontSize: 12.5, lineHeight: 1.7, color: '#6d685c', maxWidth: 760 }}>{rewriteExample.critique}</p>
            )}
          </div>
        </div>
      )}

      {/* NEXT */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 24 : 40, padding: isMobile ? '32px 20px' : '44px 64px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14.5, lineHeight: 1.7, color: '#33301f' }}>
          RECOMMENDATION OF THE COURT: <span style={{ fontWeight: 700 }}>reconvene with fresh questions.</span>
        </div>
        <div style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: isMobile ? '1fr 1fr' : undefined, gap: 12, flex: 'none', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onBackToDashboard}
            style={{ border: '1px solid #1c1b18', padding: '14px 22px', fontSize: 12.5, fontWeight: 600, background: 'none', fontFamily: 'inherit', cursor: 'pointer', minHeight: 44 }}
          >
            DASHBOARD
          </button>
          <button
            type="button"
            onClick={onExportMarkdown}
            style={{ border: '1px solid #1c1b18', padding: '14px 22px', fontSize: 12.5, fontWeight: 600, background: 'none', fontFamily: 'inherit', cursor: 'pointer', minHeight: 44 }}
          >
            EXPORT MARKDOWN
          </button>
          <button
            type="button"
            onClick={onViewSessionLog}
            style={{ border: '1px solid #1c1b18', padding: '14px 22px', fontSize: 12.5, fontWeight: 600, background: 'none', fontFamily: 'inherit', cursor: 'pointer', minHeight: 44 }}
          >
            FULL DOCKET
          </button>
          <button
            type="button"
            onClick={onPracticeAgain}
            style={{ background: '#b3402a', color: '#fbfaf6', padding: '14px 28px', fontSize: 12.5, fontWeight: 700, border: 'none', fontFamily: 'inherit', cursor: 'pointer', minHeight: 44, gridColumn: isMobile ? '1 / -1' : undefined }}
          >
            RECONVENE →
          </button>
        </div>
      </div>
    </Shell>
  );
};

export default TranscriptDebrief;
