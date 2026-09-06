import React from 'react';
import type { HistoryEntry } from '../../../types';
import { INTERVIEWER_PERSONAS } from '../../../constants';
import { useTheme } from '../../../contexts/ThemeContext';
import { toSessionRow } from '../sessionMapping';
import { useIsMobile } from '../hooks';

interface Props {
  history: HistoryEntry[];
  onStartInterview: () => void;
  onBrowseRehearsals: () => void;
  onViewSession: (entry: HistoryEntry) => void;
  onViewSessionLog: () => void;
}

const revealedPersonas = INTERVIEWER_PERSONAS.slice(0, 3).map(p => p.name).join(', ');
const sealedCount = INTERVIEWER_PERSONAS.length - 3;

const TranscriptHome: React.FC<Props> = ({ history, onStartInterview, onBrowseRehearsals, onViewSession, onViewSessionLog }) => {
  const { setTheme } = useTheme();
  const isMobile = useIsMobile();
  const sessions = history.slice(0, 3).map(toSessionRow);
  const hasSessions = sessions.length > 0;

  return (
    <div style={{ minHeight: '100vh', background: '#e9e6dc', padding: '0 0 48px', color: '#1c1b18', fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', background: '#fbfaf6', boxShadow: '0 2px 24px rgba(28,27,24,.12)' }}>

        {/* NAV */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '16px 20px' : '18px 64px', borderBottom: '1px dashed #b9b4a5' }}>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.06em' }}>REHEARSE_ALL_</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 30, fontSize: 12.5, color: '#6d685c' }}>
            {!isMobile && (
              <>
                <a href="#practice" style={{ color: '#6d685c' }}>[practice]</a>
                <a href="#sessions" style={{ color: '#6d685c' }}>[sessions]</a>
                <a href="#pricing" style={{ color: '#6d685c' }}>[pricing]</a>
              </>
            )}
            <button
              type="button"
              onClick={() => setTheme('personal-best')}
              title="Switch to the Personal Best theme"
              style={{ background: 'none', border: 'none', color: '#6d685c', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }}
            >
              {isMobile ? '[outfit]' : '[switch outfit]'}
            </button>
            <button
              type="button"
              style={{ color: '#1c1b18', border: '1px solid #1c1b18', padding: isMobile ? '10px 14px' : '8px 18px', background: 'none', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            >
              sign in
            </button>
          </div>
        </div>

        {/* HERO */}
        <div style={{ padding: isMobile ? '48px 20px 40px' : '80px 64px 64px', borderBottom: '1px dashed #b9b4a5', position: 'relative' }}>
          {isMobile && (
            <div style={{ marginBottom: 20, transform: 'rotate(3deg)', border: '2px solid #b3402a', color: '#b3402a', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', padding: '6px 12px', opacity: 0.85, display: 'inline-block' }}>
              OFF THE RECORD
            </div>
          )}
          <div style={{ fontSize: 12, color: '#6d685c', marginBottom: isMobile ? 24 : 36 }}>
            TRANSCRIPT OF PROCEEDINGS — PRIVATE REHEARSAL<br />
            IN RE: THE CONVERSATION AHEAD
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(2.25rem, 8vw, 4rem)', lineHeight: 1.12, fontWeight: 400, letterSpacing: '-0.02em', maxWidth: 940 }}>
            The conversation happened.<br />
            <span style={{ background: '#1c1b18', color: '#fbfaf6', padding: '0 12px' }}>
              Nobody was <span style={{ whiteSpace: 'nowrap' }}>
                watching.
                <span style={{ display: 'inline-block', width: '0.55em', height: '1em', verticalAlign: '-0.12em', marginLeft: 10 }}>
                  <span style={{ display: 'block', width: '100%', height: '100%', background: '#b3402a', animation: 'hpCaret 1.1s step-end infinite' }} />
                </span>
              </span>
            </span>
          </h1>
          <p style={{ margin: isMobile ? '24px 0 0' : '38px 0 0', fontSize: 15, lineHeight: 1.8, color: '#54503f', maxWidth: 600 }}>
            Rehearse the whole thing — the hard questions, the follow-ups, the awkward pause — with a responsive counterpart who keeps the record. Then read the debrief.
          </p>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 16 : 22, marginTop: isMobile ? 28 : 40 }}>
            <button
              type="button"
              onClick={onStartInterview}
              style={{ display: 'inline-block', background: '#1c1b18', color: '#fbfaf6', padding: '16px 32px', fontSize: 14, fontWeight: 600, border: 'none', fontFamily: 'inherit', cursor: 'pointer', minHeight: 44, textAlign: 'center' }}
            >
              BEGIN SESSION →
            </button>
            <button
              type="button"
              onClick={onBrowseRehearsals}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: '#b3402a', padding: '15px 24px', fontSize: 13, fontWeight: 600, border: '1px solid #b3402a', fontFamily: 'inherit', cursor: 'pointer', minHeight: 44 }}
            >
              BROWSE REHEARSALS
            </button>
            <span style={{ fontSize: 12.5, color: '#6d685c' }}>voice or text · 5–7 questions · full debrief on record</span>
          </div>
          {!isMobile && (
            <div style={{ position: 'absolute', top: 70, right: 64, transform: 'rotate(6deg)', border: '2.5px solid #b3402a', color: '#b3402a', fontSize: 13, fontWeight: 700, letterSpacing: '0.24em', padding: '8px 16px', opacity: 0.85 }}>
              OFF THE RECORD
            </div>
          )}
        </div>

        {/* EXHIBIT A */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr', borderBottom: '1px dashed #b9b4a5' }}>
          <div style={{ padding: isMobile ? '28px 20px 12px' : '44px 24px 44px 64px', borderRight: isMobile ? 'none' : '1px dashed #b9b4a5', borderBottom: isMobile ? '1px dashed #d8d3c3' : 'none', fontSize: 12, color: '#6d685c', lineHeight: isMobile ? 1.6 : 2 }}>EXHIBIT A<br />— the format</div>
          <div style={{ padding: isMobile ? '24px 20px 32px' : '44px 64px 52px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 26, maxWidth: 760 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '110px 1fr', gap: isMobile ? 4 : 18 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>COUNTERPART:</span>
                <span style={{ fontSize: 14.5, lineHeight: 1.7, color: '#33301f' }}>What makes you think this issue looks different for teenagers?</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '110px 1fr', gap: isMobile ? 4 : 18 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#b3402a' }}>YOU:</span>
                <span style={{ fontSize: 14.5, lineHeight: 1.7, color: '#33301f' }}>
                  The evidence we have suggests that— <span style={{ background: '#efe9d5' }}>[responds out loud or in writing]</span>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '110px 1fr', gap: isMobile ? 4 : 18 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>COUNTERPART:</span>
                <span style={{ fontSize: 14.5, lineHeight: 1.7, color: '#33301f' }}>Which part is evidence, and which part is your working hypothesis?</span>
              </div>
              <div style={{ fontSize: 12, color: '#6d685c', paddingLeft: isMobile ? 0 : 128 }}>— real follow-ups, generated from what you actually said</div>
            </div>
          </div>
        </div>

        {/* EXHIBIT B */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr', borderBottom: '1px dashed #b9b4a5' }}>
          <div style={{ padding: isMobile ? '28px 20px 12px' : '44px 24px 44px 64px', borderRight: isMobile ? 'none' : '1px dashed #b9b4a5', borderBottom: isMobile ? '1px dashed #d8d3c3' : 'none', fontSize: 12, color: '#6d685c', lineHeight: isMobile ? 1.6 : 2 }}>EXHIBIT B<br />— the debrief</div>
          <div style={{ padding: isMobile ? '24px 20px 32px' : '44px 64px 52px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr', gap: isMobile ? 20 : 48, alignItems: 'start' }}>
            <div style={{ textAlign: isMobile ? 'left' : 'center' }}>
              <div style={{ fontSize: 'clamp(3.5rem, 14vw, 6rem)', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1 }}>82<span style={{ fontSize: 28, color: '#6d685c' }}>/100</span></div>
              <div style={{ fontSize: 11.5, color: '#6d685c', marginTop: 8 }}>calibrated to your desired outcome</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5, lineHeight: 1.7, color: '#33301f', maxWidth: 560 }}>
              <div>✓&nbsp; STRENGTHS — where your answers landed, quoted back to you</div>
              <div>✗&nbsp; GAPS — the moments that cost you, and why</div>
              <div>→&nbsp; REWRITES — stronger versions of your weakest answers</div>
              <div style={{ color: '#6d685c', fontSize: 12.5, marginTop: 6 }}>
                Plus the reveal: which of six conversation styles you drew. {revealedPersonas}, and {sealedCount} others remain sealed until the debrief.
              </div>
            </div>
          </div>
        </div>

        {/* PRIOR PROCEEDINGS */}
        <div style={{ borderBottom: '1px dashed #b9b4a5' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr' }}>
            <div style={{ padding: isMobile ? '28px 20px 12px' : '40px 24px 40px 64px', borderRight: isMobile ? 'none' : '1px dashed #b9b4a5', borderBottom: isMobile ? '1px dashed #d8d3c3' : 'none', fontSize: 12, color: '#6d685c', lineHeight: isMobile ? 1.6 : 2 }}>
              PRIOR<br />PROCEEDINGS<br />
              <button
                type="button"
                onClick={onViewSessionLog}
                style={{ color: '#b3402a', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 'inherit' }}
              >
                full docket →
              </button>
            </div>
            <div style={{ padding: isMobile ? '20px 20px 28px' : '32px 64px 40px' }}>
              {hasSessions ? sessions.map((s, i) => (
                isMobile ? (
                  <div
                    key={s.entry.id}
                    onClick={() => onViewSession(s.entry)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '13px 0', borderBottom: i < sessions.length - 1 ? '1px dashed #d8d3c3' : undefined, fontSize: 13.5, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600 }}>{s.role}</span>
                      <span style={{ fontWeight: 700 }}>{s.score}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6d685c', fontSize: 12 }}>
                      <span>{s.dateSlash}</span>
                      <span>{s.persona}</span>
                    </div>
                  </div>
                ) : (
                  <div
                    key={s.entry.id}
                    onClick={() => onViewSession(s.entry)}
                    style={{ display: 'grid', gridTemplateColumns: '80px 1fr 150px 60px', gap: 14, alignItems: 'baseline', padding: '13px 0', borderBottom: i < sessions.length - 1 ? '1px dashed #d8d3c3' : undefined, fontSize: 13.5, cursor: 'pointer' }}
                  >
                    <span style={{ color: '#6d685c' }}>{s.dateSlash}</span>
                    <span style={{ fontWeight: 600 }}>{s.role}</span>
                    <span style={{ color: '#6d685c' }}>{s.persona}</span>
                    <span style={{ fontWeight: 700, justifySelf: 'end' }}>{s.score}</span>
                  </div>
                )
              )) : (
                <div style={{ fontSize: 13.5, color: '#6d685c' }}>No proceedings on record yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* PRICING */}
        <div id="pricing" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 20 : 40, padding: isMobile ? '32px 20px' : '44px 64px', borderBottom: '1px dashed #b9b4a5' }}>
          <div style={{ fontSize: 14.5, lineHeight: 1.7, color: '#33301f', maxWidth: 620 }}>
            COST OF PROCEEDINGS: <span style={{ fontSize: 26, fontWeight: 700 }}>$0.00</span> — free while in preview. Sign in to keep your record.
          </div>
          <button
            type="button"
            style={{ flex: 'none', background: '#b3402a', color: '#fbfaf6', padding: '15px 30px', fontSize: 13.5, fontWeight: 700, border: 'none', fontFamily: 'inherit', cursor: 'pointer', minHeight: 44 }}
          >
            SIGN IN
          </button>
        </div>

        {/* FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: isMobile ? '18px 20px' : '18px 64px', fontSize: 12, color: '#6d685c' }}>
          <span>REHEARSE_ALL_</span>
          <span>certified true copy · © 2026</span>
        </div>
      </div>
    </div>
  );
};

export default TranscriptHome;
