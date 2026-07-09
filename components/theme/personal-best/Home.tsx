import React from 'react';
import type { HistoryEntry } from '../../../types';
import { INTERVIEWER_PERSONAS } from '../../../constants';
import { useTheme } from '../../../contexts/ThemeContext';
import { useCountUp, useReveal, useIsMobile } from '../hooks';
import { toSessionRow } from '../sessionMapping';

interface Props {
  history: HistoryEntry[];
  onStartInterview: () => void;
  onViewSession: (entry: HistoryEntry) => void;
  onViewSessionLog: () => void;
}

const PERSONA_TICKER = INTERVIEWER_PERSONAS.map(p => p.name.toUpperCase()).join(' /// ');
const TICKER_TEXT = `SIX INTERVIEWERS, DRAWN AT RANDOM → ${PERSONA_TICKER} /// REVEALED ONLY IN YOUR DEBRIEF /// `;

const RevealDiv: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ style, children, ...rest }) => {
  const [ref, revealed] = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{
        ...style,
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(18px)',
        transition: 'opacity .7s ease, transform .7s cubic-bezier(.22,1,.36,1)',
      }}
      {...rest}
    >
      {children}
    </div>
  );
};

const PersonalBestHome: React.FC<Props> = ({ history, onStartInterview, onViewSession, onViewSessionLog }) => {
  const { setTheme } = useTheme();
  const isMobile = useIsMobile();
  const lastEntry = history[0] ?? null;
  const sessions = history.slice(0, 3).map(toSessionRow);
  const hasSessions = sessions.length > 0;
  const heroGhostNumber = lastEntry ? lastEntry.feedback.score : 82;
  const score = useCountUp(lastEntry?.feedback.score ?? 0, !!lastEntry);

  return (
    <div style={{ minHeight: '100vh', background: '#101208', color: '#f2f4e4', fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* NAV */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 20px' : '18px 48px', borderBottom: '1px solid #2a2d1a', background: 'rgba(16,18,8,.85)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 26, height: 26, background: '#d4f222', display: 'grid', placeItems: 'center', color: '#101208', fontWeight: 700, fontSize: 15 }}>H</span>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '0.02em' }}>HIREPREP</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 32, fontSize: 13.5, fontWeight: 500, color: '#a9ad91' }}>
          {!isMobile && (
            <>
              <a href="#practice" style={{ color: '#a9ad91' }}>Practice</a>
              <a href="#sessions" style={{ color: '#a9ad91' }}>Sessions</a>
              <a href="#pricing" style={{ color: '#a9ad91' }}>Pricing</a>
            </>
          )}
          <button
            type="button"
            onClick={() => setTheme('transcript')}
            title="Switch to the Transcript theme"
            style={{ background: 'none', border: '1px solid #3a3e24', color: '#a9ad91', padding: isMobile ? '9px 12px' : '9px 16px', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box' }}
          >
            {isMobile ? 'OUTFIT' : 'SWITCH OUTFIT'}
          </button>
          {!isMobile && (
            <button
              type="button"
              style={{ background: '#d4f222', color: '#101208', padding: '10px 24px', fontWeight: 700, border: 'none', fontSize: 13.5, cursor: 'pointer', minHeight: 44, boxSizing: 'border-box' }}
            >
              SIGN IN
            </button>
          )}
        </div>
      </div>

      {/* HERO */}
      <div style={{ position: 'relative', padding: isMobile ? '56px 20px 48px' : '96px 48px 72px', borderBottom: '1px solid #2a2d1a', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: '-10%', top: '-30%', width: '60%', height: '120%', background: 'radial-gradient(ellipse at center, rgba(212,242,34,.09), transparent 65%)', animation: 'hpDrift 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: isMobile ? -10 : -30, top: isMobile ? -10 : -40, fontSize: 'clamp(120px, 40vw, 340px)', fontWeight: 700, color: '#d4f222', opacity: isMobile ? 0.045 : 0.06, letterSpacing: '-0.06em', lineHeight: 1, pointerEvents: 'none' }}>{heroGhostNumber}</div>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #3a3e24', borderRadius: 999, padding: '7px 16px', fontSize: 12, letterSpacing: '0.14em', color: '#d4f222', marginBottom: 32 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: '#d4f222', animation: 'hpBlink 2.2s ease-in-out infinite' }} />
            TRAINING GROUND FOR INTERVIEWS
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(2.25rem, 9vw, 6.5rem)', lineHeight: 0.96, fontWeight: 700, letterSpacing: '-0.035em', maxWidth: 920 }}>
            Interview like you&apos;ve <span style={{ color: '#d4f222', animation: 'hpGlowPulse 4s ease-in-out infinite' }}>done it before.</span>
          </h1>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 40, marginTop: 44, flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: '#a9ad91', maxWidth: 480 }}>
              Because you will have. Reps against a tough, fair interviewer — then splits, scores, and exactly what to fix before the next rep.
            </p>
            <button
              type="button"
              onClick={onStartInterview}
              style={{ flex: isMobile ? '1 1 100%' : 'none', display: 'inline-block', background: '#d4f222', color: '#101208', padding: '18px 40px', fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box' }}
            >
              START A REP →
            </button>
          </div>
        </div>
      </div>

      {/* PERSONA TICKER */}
      <div style={{ borderBottom: '1px solid #2a2d1a', overflow: 'hidden', padding: '16px 0', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', animation: 'hpMarquee 26s linear infinite' }}>
          <span style={{ fontSize: 13, letterSpacing: '0.18em', color: '#a9ad91', paddingRight: 48 }}>{TICKER_TEXT}</span>
          <span style={{ fontSize: 13, letterSpacing: '0.18em', color: '#a9ad91', paddingRight: 48 }}>{TICKER_TEXT}</span>
        </div>
      </div>

      {/* STAT BAND */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', borderBottom: '1px solid #2a2d1a' }}>
        {[
          ['5–7', 'questions per session'],
          ['2', 'modes — voice & text'],
          ['6', 'interviewer personas'],
          ['/100', 'score calibrated to your level'],
        ].map(([big, label], i) => (
          <div
            key={i}
            style={{
              padding: isMobile ? '20px 18px' : '28px 32px',
              borderRight: isMobile ? (i % 2 === 0 ? '1px solid #2a2d1a' : undefined) : (i < 3 ? '1px solid #2a2d1a' : undefined),
              borderBottom: isMobile && i < 2 ? '1px solid #2a2d1a' : undefined,
            }}
          >
            <div style={{ fontSize: isMobile ? 30 : 40, fontWeight: 700, letterSpacing: '-0.03em', color: i === 3 ? '#d4f222' : undefined }}>{big}</div>
            <div style={{ fontSize: 12.5, color: '#a9ad91', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* WORKOUT + LAST DEBRIEF */}
      <div id="practice" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', borderBottom: '1px solid #2a2d1a', scrollMarginTop: 80 }}>
        <RevealDiv style={{ padding: isMobile ? '32px 20px' : 48, borderRight: isMobile ? undefined : '1px solid #2a2d1a', borderBottom: isMobile ? '1px solid #2a2d1a' : undefined }}>
          <div style={{ fontSize: 12, letterSpacing: '0.2em', color: '#d4f222', marginBottom: 22 }}>THE WORKOUT</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              ['01', 'Load your resume', 'PDF or paste. Add the job posting to train for a specific opening.'],
              ['02', 'Run the rep', 'Live voice or written chat. Follow-ups probe what you actually said.'],
              ['03', 'Read your splits', 'Score, strengths, weak moments — and rewritten answers to study.'],
            ].map(([n, title, body], i) => (
              <div key={n} style={{ display: 'flex', gap: 20, padding: '18px 0', borderBottom: i < 2 ? '1px solid #2a2d1a' : undefined, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, color: '#d4f222', fontSize: 14, flex: 'none', width: 34 }}>{n}</span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 13.5, color: '#a9ad91', lineHeight: 1.55 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 32, flexWrap: 'wrap' }}>
            <span style={{ border: '1px solid #3a3e24', padding: '12px 22px', fontSize: 13, fontWeight: 600 }}>🎙 VOICE MODE</span>
            <span style={{ border: '1px solid #3a3e24', padding: '12px 22px', fontSize: 13, fontWeight: 600 }}>⌨ TEXT MODE</span>
          </div>
        </RevealDiv>
        <RevealDiv style={{ padding: isMobile ? '32px 20px' : 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32, background: 'linear-gradient(160deg, rgba(212,242,34,.06), transparent 55%)' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.2em', color: '#d4f222' }}>LAST DEBRIEF</div>
          {lastEntry ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: isMobile ? 72 : 120, fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1, color: '#d4f222', textShadow: '0 0 40px rgba(212,242,34,.4)' }}>{score}</span>
                <div style={{ fontSize: 13, color: '#a9ad91', lineHeight: 1.6 }}>
                  {lastEntry.resume.role}<br />
                  vs. {lastEntry.personaName} · {new Date(lastEntry.date).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: '#a9ad91' }}>No reps yet. Your first debrief shows up here.</div>
          )}
          <button
            type="button"
            onClick={lastEntry ? () => onViewSession(lastEntry) : undefined}
            disabled={!lastEntry}
            style={{ alignSelf: 'flex-start', fontSize: 13.5, fontWeight: 700, color: lastEntry ? '#d4f222' : '#3a3e24', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: `2px solid ${lastEntry ? '#d4f222' : '#3a3e24'}`, paddingBottom: 3, background: 'none', cursor: lastEntry ? 'pointer' : 'default', minHeight: 44, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center' }}
          >
            FULL DEBRIEF →
          </button>
        </RevealDiv>
      </div>

      {/* SESSION LOG */}
      <div id="sessions" style={{ borderBottom: '1px solid #2a2d1a', scrollMarginTop: 80 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: isMobile ? '28px 20px 0' : '36px 48px 0', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em' }}>SESSION LOG</h2>
          <button
            type="button"
            onClick={onViewSessionLog}
            style={{ fontSize: 12.5, fontWeight: 700, color: '#d4f222', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
          >
            VIEW ALL {history.length} →
          </button>
        </div>
        {hasSessions ? (
          <div style={{ marginTop: 22 }}>
            {sessions.map(s => (
              isMobile ? (
                <RevealDiv
                  key={s.entry.id}
                  onClick={() => onViewSession(s.entry)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 20px', borderTop: '1px solid #2a2d1a', fontSize: 14, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ fontWeight: 600 }}>{s.role}</span>
                    <span style={{ fontWeight: 700, fontSize: 22, color: '#d4f222' }}>{s.score}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11.5, letterSpacing: '0.08em', color: '#a9ad91', flexWrap: 'wrap' }}>
                    <span>{s.dateDot}</span>
                    <span>·</span>
                    <span>{s.level}</span>
                    <span>·</span>
                    <span>{s.persona}</span>
                  </div>
                </RevealDiv>
              ) : (
                <RevealDiv
                  key={s.entry.id}
                  onClick={() => onViewSession(s.entry)}
                  style={{ display: 'grid', gridTemplateColumns: '90px 1fr 120px 170px 80px', gap: 14, alignItems: 'center', padding: '18px 48px', borderTop: '1px solid #2a2d1a', fontSize: 14, cursor: 'pointer' }}
                >
                  <span style={{ color: '#a9ad91' }}>{s.dateDot}</span>
                  <span style={{ fontWeight: 600 }}>{s.role}</span>
                  <span style={{ fontSize: 11.5, letterSpacing: '0.12em', color: '#a9ad91' }}>{s.level}</span>
                  <span style={{ color: '#a9ad91' }}>{s.persona}</span>
                  <span style={{ fontWeight: 700, fontSize: 22, color: '#d4f222', justifySelf: 'end' }}>{s.score}</span>
                </RevealDiv>
              )
            ))}
            <div style={{ height: 26 }} />
          </div>
        ) : (
          <div style={{ margin: isMobile ? '22px 20px 40px' : '22px 48px 40px', border: '1px dashed #3a3e24', padding: isMobile ? 28 : 44, textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>No reps yet.</div>
            <div style={{ fontSize: 13.5, color: '#a9ad91' }}>Your first session log entry is one interview away.</div>
          </div>
        )}
      </div>

      {/* PRICING */}
      <RevealDiv id="pricing" style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: isMobile ? 20 : 40, padding: isMobile ? '36px 20px' : '52px 48px', borderBottom: '1px solid #2a2d1a', scrollMarginTop: 80 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
          <span style={{ fontSize: isMobile ? 48 : 72, fontWeight: 700, letterSpacing: '-0.04em', color: '#d4f222', textShadow: '0 0 32px rgba(212,242,34,.35)' }}>$0</span>
          <span style={{ fontSize: 14, color: '#a9ad91', maxWidth: 320, lineHeight: 1.5 }}>Unlimited reps while HirePrep is in preview. Sign in to keep your log across devices.</span>
        </div>
        <span style={{ flex: 'none', border: '2px solid #d4f222', color: '#d4f222', padding: '16px 36px', fontSize: 15, fontWeight: 700, boxSizing: 'border-box', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>SIGN IN — FREE</span>
      </RevealDiv>

      {/* FOOTER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: isMobile ? '20px 20px' : '20px 48px', fontSize: 12.5, color: '#a9ad91' }}>
        <span style={{ fontWeight: 700, color: '#f2f4e4' }}>HIREPREP</span>
        <span>© 2026 · built with Gemini</span>
      </div>
    </div>
  );
};

export default PersonalBestHome;
