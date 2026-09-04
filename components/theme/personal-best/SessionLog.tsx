import React, { useMemo, useState } from 'react';
import type { HistoryEntry } from '../../../types';
import { useTheme } from '../../../contexts/ThemeContext';
import { useReveal, useIsMobile } from '../hooks';
import { toSessionRow } from '../sessionMapping';
import { practiceTitle } from '../../../lib/practiceSetup';

interface Props {
  history: HistoryEntry[];
  onViewSession: (entry: HistoryEntry) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onStartInterview: () => void;
  onBackToHome: () => void;
}

type FilterId = 'all' | 'voice' | 'text' | 'role';

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

const chipStyle = (active: boolean): React.CSSProperties =>
  active
    ? { background: '#d4f222', color: '#101208', padding: '9px 20px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none' }
    : { border: '1px solid #3a3e24', color: '#a9ad91', padding: '9px 20px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: 'none', transition: 'border-color .2s, color .2s' };

const PersonalBestSessionLog: React.FC<Props> = ({ history, onViewSession, onDeleteSession, onStartInterview, onBackToHome }) => {
  const { setTheme } = useTheme();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<FilterId>('all');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  const roles = useMemo(() => Array.from(new Set(history.map(h => practiceTitle(h.resume)))).sort(), [history]);

  const stats = useMemo(() => {
    const scores = history.map(h => h.feedback.score);
    const repCount = history.length;
    const best = scores.length ? Math.max(...scores) : 0;
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    let trend: string | null = null;
    if (scores.length >= 6) {
      const recent3 = scores.slice(0, 3);
      const prior3 = scores.slice(3, 6);
      const recentAvg = recent3.reduce((a, b) => a + b, 0) / 3;
      const priorAvg = prior3.reduce((a, b) => a + b, 0) / 3;
      const delta = Math.round(recentAvg - priorAvg);
      trend = (delta >= 0 ? '+' : '') + delta;
    }
    return { repCount, best, avg, trend };
  }, [history]);

  const filtered = useMemo(() => {
    let list = history;
    if (filter === 'voice') list = list.filter(h => h.mode === 'voice');
    else if (filter === 'text') list = list.filter(h => h.mode === 'text');
    else if (filter === 'role' && roleFilter) list = list.filter(h => practiceTitle(h.resume) === roleFilter);
    return list.map(toSessionRow);
  }, [history, filter, roleFilter]);

  const hasHistory = history.length > 0;
  const hasFilteredRows = filtered.length > 0;

  return (
    <div style={{ minHeight: '100vh', background: '#101208', color: '#f2f4e4', fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 20px' : '16px 40px', borderBottom: '1px solid #2a2d1a', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onBackToHome}
          style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span style={{ width: 26, height: 26, background: '#d4f222', display: 'grid', placeItems: 'center', color: '#101208', fontWeight: 700, fontSize: 15 }}>R</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#f2f4e4' }}>REHEARSE_ALL</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 28, fontSize: 13, fontWeight: 500, color: '#a9ad91' }}>
          {!isMobile && (
            <button type="button" onClick={onBackToHome} style={{ background: 'none', border: 'none', color: '#a9ad91', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}>
              Home
            </button>
          )}
          <button
            type="button"
            onClick={() => setTheme('transcript')}
            title="Switch to the Transcript theme"
            style={{ background: 'none', border: '1px solid #3a3e24', color: '#a9ad91', padding: isMobile ? '9px 12px' : '9px 16px', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box' }}
          >
            {isMobile ? 'OUTFIT' : 'SWITCH OUTFIT'}
          </button>
          <button
            type="button"
            onClick={onStartInterview}
            style={{ background: '#d4f222', color: '#101208', padding: isMobile ? '9px 16px' : '9px 20px', fontWeight: 700, border: 'none', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', minHeight: 44, boxSizing: 'border-box' }}
          >
            START A REP
          </button>
        </div>
      </div>

      {/* HEADER */}
      <div style={{ padding: isMobile ? '32px 20px 0' : '56px 48px 0' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 8vw, 4rem)', fontWeight: 700, letterSpacing: '-0.03em' }}>SESSION LOG</h1>
        <p style={{ margin: '12px 0 0', fontSize: 15, color: '#a9ad91' }}>Every rep on record. Watch the trend, not the single score.</p>
      </div>

      {hasHistory ? (
        <>
          {/* STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', margin: isMobile ? '24px 20px 0' : '36px 48px 0', border: '1px solid #2a2d1a' }}>
            <div style={{ padding: isMobile ? '18px 20px' : '24px 28px', borderRight: '1px solid #2a2d1a', borderBottom: isMobile ? '1px solid #2a2d1a' : undefined }}>
              <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 700, letterSpacing: '-0.03em' }}>{stats.repCount}</div>
              <div style={{ fontSize: 12, color: '#a9ad91', marginTop: 3 }}>total reps</div>
            </div>
            <div style={{ padding: isMobile ? '18px 20px' : '24px 28px', borderRight: isMobile ? undefined : '1px solid #2a2d1a', borderBottom: isMobile ? '1px solid #2a2d1a' : undefined }}>
              <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 700, letterSpacing: '-0.03em', color: '#d4f222' }}>{stats.best}</div>
              <div style={{ fontSize: 12, color: '#a9ad91', marginTop: 3 }}>personal best</div>
            </div>
            <div style={{ padding: isMobile ? '18px 20px' : '24px 28px', borderRight: '1px solid #2a2d1a' }}>
              <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 700, letterSpacing: '-0.03em' }}>{stats.avg}</div>
              <div style={{ fontSize: 12, color: '#a9ad91', marginTop: 3 }}>average score</div>
            </div>
            <div style={{ padding: isMobile ? '18px 20px' : '24px 28px' }}>
              <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 700, letterSpacing: '-0.03em', color: '#d4f222' }}>{stats.trend ?? 'n/a'}</div>
              <div style={{ fontSize: 12, color: '#a9ad91', marginTop: 3 }}>last 3 reps trend</div>
            </div>
          </div>

          {/* FILTERS */}
          <div style={{ display: 'flex', gap: 12, padding: isMobile ? '24px 20px 0' : '32px 48px 0', flexWrap: 'wrap' }}>
            <span style={chipStyle(filter === 'all')} onClick={() => { setFilter('all'); setRoleFilter(null); }}>ALL</span>
            <span style={chipStyle(filter === 'voice')} onClick={() => { setFilter('voice'); setRoleFilter(null); }}>VOICE</span>
            <span style={chipStyle(filter === 'text')} onClick={() => { setFilter('text'); setRoleFilter(null); }}>TEXT</span>
            <span style={chipStyle(filter === 'role' && !roleFilter)} onClick={() => setFilter('role')}>BY ROLE</span>
            {filter === 'role' && roles.map(r => (
              <span
                key={r}
                onClick={() => setRoleFilter(r)}
                style={{
                  border: '1px solid #3a3e24',
                  color: roleFilter === r ? '#d4f222' : '#a9ad91',
                  borderColor: roleFilter === r ? '#d4f222' : '#3a3e24',
                  padding: '9px 20px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'none',
                }}
              >
                {r.toUpperCase()}
              </span>
            ))}
          </div>

          {/* LOG */}
          <div style={{ padding: isMobile ? '20px 20px 48px' : '28px 48px 64px' }}>
            {hasFilteredRows ? (
              <>
                {!isMobile && (
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 90px 170px 90px 40px', gap: 14, padding: '0 20px 12px', fontSize: 11, letterSpacing: '0.16em', color: '#6d7157' }}>
                    <span>DATE</span><span>ROLE</span><span>LEVEL</span><span>MODE</span><span>PERSONA</span><span style={{ justifySelf: 'end' }}>SCORE</span><span />
                  </div>
                )}
                {filtered.map(s => (
                  isMobile ? (
                    <RevealDiv
                      key={s.entry.id}
                      onClick={() => onViewSession(s.entry)}
                      style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 4px', borderTop: '1px solid #2a2d1a', fontSize: 14, color: '#f2f4e4', cursor: 'pointer', position: 'relative' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <span style={{ fontWeight: 600 }}>{s.role}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 700, fontSize: 22, color: '#d4f222' }}>{s.score}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDeleteSession(s.entry.id, e); }}
                            title="Delete this session"
                            style={{ background: 'none', border: 'none', color: '#6d7157', fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11.5, letterSpacing: '0.08em', color: '#a9ad91', flexWrap: 'wrap' }}>
                        <span>{s.dateDot}</span>
                        <span>·</span>
                        <span>{s.level}</span>
                        <span>·</span>
                        <span>{s.entry.mode ? s.entry.mode.toUpperCase() : '—'}</span>
                        <span>·</span>
                        <span>{s.persona}</span>
                      </div>
                    </RevealDiv>
                  ) : (
                    <RevealDiv
                      key={s.entry.id}
                      onClick={() => onViewSession(s.entry)}
                      style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 90px 170px 90px 40px', gap: 14, alignItems: 'center', padding: 20, borderTop: '1px solid #2a2d1a', fontSize: 14, color: '#f2f4e4', cursor: 'pointer' }}
                    >
                      <span style={{ color: '#a9ad91' }}>{s.dateDot}</span>
                      <span style={{ fontWeight: 600 }}>{s.role}</span>
                      <span style={{ fontSize: 11.5, letterSpacing: '0.12em', color: '#a9ad91' }}>{s.level}</span>
                      <span style={{ fontSize: 12, color: '#a9ad91' }}>{s.entry.mode ? s.entry.mode.toUpperCase() : '—'}</span>
                      <span style={{ color: '#a9ad91' }}>{s.persona}</span>
                      <span style={{ fontWeight: 700, fontSize: 24, color: '#d4f222', justifySelf: 'end' }}>{s.score}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(s.entry.id, e); }}
                        title="Delete this session"
                        style={{ justifySelf: 'end', background: 'none', border: 'none', color: '#6d7157', fontSize: 16, cursor: 'pointer', padding: 4, lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </RevealDiv>
                  )
                ))}
                <div style={{ borderTop: '1px solid #2a2d1a' }} />
              </>
            ) : (
              <div style={{ border: '1px dashed #3a3e24', padding: isMobile ? 28 : 44, textAlign: 'center' }}>
                <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>No reps match this filter.</div>
                <div style={{ fontSize: 13.5, color: '#a9ad91' }}>Try a different mode or clear the filter.</div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ margin: isMobile ? '28px 20px' : '48px', border: '1px dashed #3a3e24', padding: isMobile ? 36 : 64, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>No reps yet.</div>
          <div style={{ fontSize: 14, color: '#a9ad91', marginBottom: 28 }}>Your first session log entry is one rehearsal away.</div>
          <button
            type="button"
            onClick={onStartInterview}
            style={{ background: '#d4f222', color: '#101208', padding: '16px 36px', fontSize: 14.5, fontWeight: 700, border: 'none', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box' }}
          >
            START A REP →
          </button>
        </div>
      )}
    </div>
  );
};

export default PersonalBestSessionLog;
