import React, { useMemo, useState } from 'react';
import type { HistoryEntry } from '../../../types';
import { useTheme } from '../../../contexts/ThemeContext';
import { toSessionRow } from '../sessionMapping';
import { useIsMobile } from '../hooks';
import { practiceTitle } from '../../../lib/practiceSetup';

interface Props {
  history: HistoryEntry[];
  onViewSession: (entry: HistoryEntry) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onStartInterview: () => void;
  onBackToHome: () => void;
}

type FilterId = 'all' | 'voice' | 'text' | 'role';

const chipStyle = (active: boolean, isMobile = false): React.CSSProperties =>
  active
    ? { background: '#1c1b18', color: '#fbfaf6', padding: isMobile ? '12px 18px' : '8px 18px', fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit', fontSize: 12, display: 'inline-flex', alignItems: 'center', minHeight: isMobile ? 44 : undefined, boxSizing: 'border-box' }
    : { border: '1px solid #b9b4a5', color: '#6d685c', padding: isMobile ? '12px 18px' : '8px 18px', cursor: 'pointer', background: 'none', fontFamily: 'inherit', fontSize: 12, transition: 'border-color .2s, color .2s', display: 'inline-flex', alignItems: 'center', minHeight: isMobile ? 44 : undefined, boxSizing: 'border-box' };

const TranscriptSessionLog: React.FC<Props> = ({ history, onViewSession, onDeleteSession, onStartInterview, onBackToHome }) => {
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
    <div style={{ minHeight: '100vh', background: '#e9e6dc', padding: '0 0 48px', color: '#1c1b18', fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', minHeight: '100vh', background: '#fbfaf6', boxShadow: '0 2px 24px rgba(28,27,24,.12)' }}>

        {/* TOP BAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 20px' : '16px 64px', borderBottom: '1px dashed #b9b4a5', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 10 : 0 }}>
          <button type="button" onClick={onBackToHome} style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.06em', background: 'none', border: 'none', color: '#1c1b18', fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}>
            REHEARSE_ALL_
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 26, fontSize: 12.5, color: '#6d685c', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            {!isMobile && (
              <button type="button" onClick={onBackToHome} style={{ background: 'none', border: 'none', color: '#6d685c', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>
                [home]
              </button>
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
              onClick={onStartInterview}
              style={{ color: '#1c1b18', border: '1px solid #1c1b18', padding: isMobile ? '10px 14px' : '8px 18px', background: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            >
              begin session
            </button>
          </div>
        </div>

        {/* HEADER */}
        <div style={{ padding: isMobile ? '36px 20px 0' : '56px 64px 0' }}>
          <div style={{ fontSize: 12, color: '#6d685c', marginBottom: 20 }}>RECORDS OF THE PROCEEDINGS — COMPLETE</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 8vw, 3.25rem)', fontWeight: 400, letterSpacing: '-0.02em' }}>
            THE DOCKET<span style={{ color: '#b3402a' }}>.</span>
          </h1>
          <p style={{ margin: '14px 0 0', fontSize: 13.5, color: '#54503f', lineHeight: 1.7 }}>Every rep on record. Read the trend, not the single score.</p>
        </div>

        {hasHistory ? (
          <>
            {/* STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', margin: isMobile ? '28px 20px 0' : '36px 64px 0', border: '1px solid #1c1b18' }}>
              <div style={{ padding: isMobile ? '18px 20px' : '22px 26px', borderRight: '1px solid #1c1b18', borderBottom: isMobile ? '1px solid #1c1b18' : 'none' }}>
                <div style={{ fontSize: isMobile ? 26 : 34, fontWeight: 700, letterSpacing: '-0.03em' }}>{stats.repCount}</div>
                <div style={{ fontSize: 11, color: '#6d685c', marginTop: 4, letterSpacing: '0.08em' }}>MATTERS HEARD</div>
              </div>
              <div style={{ padding: isMobile ? '18px 20px' : '22px 26px', borderRight: isMobile ? 'none' : '1px solid #1c1b18', borderBottom: isMobile ? '1px solid #1c1b18' : 'none' }}>
                <div style={{ fontSize: isMobile ? 26 : 34, fontWeight: 700, letterSpacing: '-0.03em', color: '#b3402a' }}>{stats.best}</div>
                <div style={{ fontSize: 11, color: '#6d685c', marginTop: 4, letterSpacing: '0.08em' }}>HIGH-WATER MARK</div>
              </div>
              <div style={{ padding: isMobile ? '18px 20px' : '22px 26px', borderRight: '1px solid #1c1b18' }}>
                <div style={{ fontSize: isMobile ? 26 : 34, fontWeight: 700, letterSpacing: '-0.03em' }}>{stats.avg}</div>
                <div style={{ fontSize: 11, color: '#6d685c', marginTop: 4, letterSpacing: '0.08em' }}>AVERAGE FINDING</div>
              </div>
              <div style={{ padding: isMobile ? '18px 20px' : '22px 26px' }}>
                <div style={{ fontSize: isMobile ? 26 : 34, fontWeight: 700, letterSpacing: '-0.03em', color: '#b3402a' }}>{stats.trend ?? 'N/A'}</div>
                <div style={{ fontSize: 11, color: '#6d685c', marginTop: 4, letterSpacing: '0.08em' }}>LAST 3, TRENDING</div>
              </div>
            </div>

            {/* FILTERS */}
            <div style={{ display: 'flex', gap: 12, padding: isMobile ? '24px 20px 0' : '32px 64px 0', fontSize: 12, flexWrap: 'wrap' }}>
              <span style={chipStyle(filter === 'all', isMobile)} onClick={() => { setFilter('all'); setRoleFilter(null); }}>ALL MATTERS</span>
              <span style={chipStyle(filter === 'voice', isMobile)} onClick={() => { setFilter('voice'); setRoleFilter(null); }}>AUDIO</span>
              <span style={chipStyle(filter === 'text', isMobile)} onClick={() => { setFilter('text'); setRoleFilter(null); }}>WRITTEN</span>
              <span style={chipStyle(filter === 'role' && !roleFilter, isMobile)} onClick={() => setFilter('role')}>BY ROLE</span>
              {filter === 'role' && roles.map(r => (
                <span
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  style={{
                    border: '1px solid #b9b4a5',
                    borderColor: roleFilter === r ? '#b3402a' : '#b9b4a5',
                    color: roleFilter === r ? '#b3402a' : '#6d685c',
                    padding: isMobile ? '12px 18px' : '8px 18px',
                    cursor: 'pointer',
                    background: 'none',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: isMobile ? 44 : undefined,
                    boxSizing: 'border-box',
                  }}
                >
                  {r}
                </span>
              ))}
            </div>

            {/* DOCKET */}
            <div style={{ padding: isMobile ? '24px 20px 48px' : '28px 64px 64px' }}>
              {hasFilteredRows ? (
                <>
                  {!isMobile && (
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 90px 170px 70px 30px', gap: 14, padding: '0 18px 12px', fontSize: 10.5, letterSpacing: '0.14em', color: '#8a8471' }}>
                      <span>DATE</span><span>MATTER</span><span>LEVEL</span><span>MODE</span><span>EXAMINER</span><span style={{ justifySelf: 'end' }}>FINDING</span><span />
                    </div>
                  )}
                  {filtered.map((s, i) => (
                    isMobile ? (
                      <div
                        key={s.entry.id}
                        onClick={() => onViewSession(s.entry)}
                        style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 6px', borderTop: '1px dashed #d8d3c3', fontSize: 13, cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontWeight: 600 }}>{s.role}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontWeight: 700, fontSize: 18 }}>{s.score}</span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onDeleteSession(s.entry.id, e); }}
                              title="Strike from the record"
                              style={{ background: 'none', border: 'none', color: '#8a8471', fontFamily: 'inherit', fontSize: 18, cursor: 'pointer', padding: 6, lineHeight: 1, minWidth: 44, minHeight: 44 }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: '#6d685c', letterSpacing: '0.04em' }}>
                          <span>{s.dateSlash}</span>
                          <span>·</span>
                          <span>{s.level}</span>
                          <span>·</span>
                          <span>{s.entry.mode ? (s.entry.mode === 'voice' ? 'AUDIO' : 'WRITTEN') : '—'}</span>
                          <span>·</span>
                          <span>{s.persona}</span>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={s.entry.id}
                        onClick={() => onViewSession(s.entry)}
                        style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 90px 170px 70px 30px', gap: 14, alignItems: 'baseline', padding: '16px 18px', borderTop: '1px dashed #d8d3c3', fontSize: 13, cursor: 'pointer' }}
                      >
                        <span style={{ color: '#6d685c' }}>{s.dateSlash}</span>
                        <span style={{ fontWeight: 600 }}>{s.role}</span>
                        <span style={{ fontSize: 11, color: '#6d685c', letterSpacing: '0.08em' }}>{s.level}</span>
                        <span style={{ fontSize: 11, color: '#6d685c' }}>{s.entry.mode ? (s.entry.mode === 'voice' ? 'AUDIO' : 'WRITTEN') : '—'}</span>
                        <span style={{ color: '#6d685c' }}>{s.persona}</span>
                        <span style={{ fontWeight: 700, fontSize: 20, justifySelf: 'end' }}>{s.score}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onDeleteSession(s.entry.id, e); }}
                          title="Strike from the record"
                          style={{ justifySelf: 'end', background: 'none', border: 'none', color: '#8a8471', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', padding: 2, lineHeight: 1 }}
                        >
                          ×
                        </button>
                      </div>
                    )
                  ))}
                  <div style={{ borderTop: '1px dashed #d8d3c3', padding: isMobile ? '16px 6px 0' : '16px 18px 0', fontSize: 11, color: '#8a8471' }}>
                    END OF RECORD — certified true copy
                  </div>
                </>
              ) : (
                <div style={{ padding: '44px 18px', textAlign: 'center', border: '1px dashed #b9b4a5' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No matters found under this filter.</div>
                  <div style={{ fontSize: 12.5, color: '#6d685c' }}>Select a different mode or clear the filter.</div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ margin: isMobile ? '32px 20px' : '48px 64px', border: '1px dashed #b9b4a5', padding: isMobile ? '40px 24px' : 64, textAlign: 'center' }}>
            <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 10 }}>No proceedings on record yet.</div>
            <div style={{ fontSize: 13, color: '#6d685c', marginBottom: 28 }}>Your first matter is one session away.</div>
            <button
              type="button"
              onClick={onStartInterview}
              style={{ background: '#1c1b18', color: '#fbfaf6', padding: '15px 32px', fontSize: 13.5, fontWeight: 600, border: 'none', fontFamily: 'inherit', cursor: 'pointer', minHeight: 44 }}
            >
              BEGIN SESSION →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptSessionLog;
