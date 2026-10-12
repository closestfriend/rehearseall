import React, { useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useIsMobile } from './theme/hooks';
import {
  REHEARSAL_DOMAINS,
  REHEARSAL_PRESETS,
  createRehearsalSetup,
  findRehearsalPresets,
  formatRehearsalListedSize,
  resolveRehearsalSelection,
} from '../lib/rehearsalCatalog';
import type { ConversationSetup, RehearsalFormat, RehearsalSetup } from '../types';

interface Props {
  onBack: () => void;
  onStart: (setup: ConversationSetup | RehearsalSetup) => void;
}

const RehearsalLibrary: React.FC<Props> = ({ onBack, onStart }) => {
  const { theme } = useTheme();
  const mobile = useIsMobile();
  const transcript = theme === 'transcript';
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<RehearsalFormat | 'all'>('all');
  const [domain, setDomain] = useState('all');
  const [selectedId, setSelectedId] = useState(REHEARSAL_PRESETS[0].id);
  const [participantContext, setParticipantContext] = useState('');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const palette = transcript
    ? { canvas: '#e9e6dc', surface: '#fbfaf6', ink: '#1c1b18', muted: '#6d685c', signal: '#b3402a', rule: '#b9b4a5', soft: '#efe9d5' }
    : { canvas: '#101208', surface: '#171a0d', ink: '#f2f4e4', muted: '#a9ad91', signal: '#d4f222', rule: '#3a3e24', soft: '#252a12' };
  const font = transcript ? "'IBM Plex Mono', ui-monospace, monospace" : "'Space Grotesk', sans-serif";
  const borderStyle = transcript ? 'dashed' : 'solid';

  const results = useMemo(
    () => findRehearsalPresets(query, format, domain),
    [query, format, domain],
  );
  const selected = resolveRehearsalSelection(results, selectedId) ?? REHEARSAL_PRESETS[0];

  const controlStyle: React.CSSProperties = {
    minHeight: 44,
    border: `1px ${borderStyle} ${palette.rule}`,
    background: palette.surface,
    color: palette.ink,
    font: 'inherit',
    padding: '10px 12px',
  };

  return (
    <div style={{ minHeight: '100vh', background: palette.canvas, color: palette.ink, fontFamily: font }}>
      <style>{`
        .rehearsal-focus:focus-visible { outline: 3px solid ${palette.signal}; outline-offset: -3px; }
        .rehearsal-row:hover { background: ${palette.soft}; }
      `}</style>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, padding: mobile ? '14px 18px' : '16px 32px', background: palette.surface, borderBottom: `1px ${borderStyle} ${palette.rule}` }}>
        <button type="button" onClick={onBack} className="rehearsal-focus" style={{ border: 0, background: 'none', color: palette.ink, font: 'inherit', fontWeight: 700, cursor: 'pointer', padding: '10px 0' }}>
          RehearseAll
        </button>
        <div style={{ color: palette.muted, fontSize: 13 }}>{REHEARSAL_PRESETS.length} formats</div>
      </header>

      <div style={{ maxWidth: 1500, margin: '0 auto', background: palette.surface, minHeight: 'calc(100vh - 77px)' }}>
        <section style={{ padding: mobile ? '28px 18px 22px' : '38px 32px 28px', borderBottom: `1px ${borderStyle} ${palette.rule}` }}>
          <h1 style={{ margin: 0, fontSize: mobile ? 36 : 56, lineHeight: 1.02, letterSpacing: '-0.035em', maxWidth: 760 }}>Choose the room before you enter it.</h1>
          <p style={{ margin: '16px 0 0', maxWidth: 760, color: palette.muted, lineHeight: 1.6, fontSize: 14 }}>
            Practice formats are an independent collection built from public format descriptions. These are approximations—not official questions, scoring, or endorsement.
          </p>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : '210px minmax(360px, 1fr) minmax(360px, 0.9fr)', minHeight: 720 }}>
          <aside style={{ minWidth: 0, padding: mobile ? '18px' : '24px 20px', borderRight: mobile ? undefined : `1px ${borderStyle} ${palette.rule}`, borderBottom: mobile ? `1px ${borderStyle} ${palette.rule}` : undefined }}>
            <label style={{ display: 'block', color: palette.muted, fontSize: 12, marginBottom: 8 }} htmlFor="rehearsal-search">Search</label>
            <input id="rehearsal-search" className="rehearsal-focus" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title or skill" style={{ ...controlStyle, width: '100%', boxSizing: 'border-box' }} />

            <fieldset style={{ minWidth: 0, maxWidth: '100%', border: 0, padding: 0, margin: '24px 0 0' }}>
              <legend style={{ color: palette.muted, fontSize: 12, marginBottom: 8 }}>Format</legend>
              <div style={{ display: 'grid', width: '100%', maxWidth: '100%', gap: 6 }}>
                {(['all', 'interview', 'assessment'] as const).map(value => (
                  <button key={value} type="button" onClick={() => setFormat(value)} className="rehearsal-focus" style={{ minHeight: 40, padding: '8px 10px', textAlign: 'left', border: `1px ${borderStyle} ${format === value ? palette.signal : palette.rule}`, background: format === value ? palette.soft : 'transparent', color: format === value ? palette.signal : palette.muted, font: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {value === 'all' ? 'All formats' : value === 'interview' ? 'Adaptive interviews' : 'Assessment decks'}
                  </button>
                ))}
              </div>
            </fieldset>

            <label style={{ display: 'block', color: palette.muted, fontSize: 12, margin: '24px 0 8px' }} htmlFor="rehearsal-domain">Domain</label>
            <select id="rehearsal-domain" className="rehearsal-focus" value={domain} onChange={event => setDomain(event.target.value)} style={{ ...controlStyle, width: '100%' }}>
              <option value="all">All domains</option>
              {REHEARSAL_DOMAINS.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </aside>

          <main style={{ minWidth: 0, borderRight: mobile ? undefined : `1px ${borderStyle} ${palette.rule}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', color: palette.muted, fontSize: 12, borderBottom: `1px ${borderStyle} ${palette.rule}` }}>
              <span>{results.length} rehearsals</span><span>{format === 'all' ? 'All formats' : format}</span>
            </div>
            {results.length === 0 ? (
              <div style={{ padding: 28, color: palette.muted }}>No rehearsals match those filters. Clear the search or choose another domain.</div>
            ) : results.map(preset => {
              const active = preset.id === selected.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className="rehearsal-row rehearsal-focus"
                  onClick={() => {
                    setSelectedId(preset.id);
                    if (mobile) setMobileDetailOpen(true);
                  }}
                  style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center', padding: '16px 18px', textAlign: 'left', border: 0, borderBottom: `1px ${borderStyle} ${palette.rule}`, borderLeft: `4px solid ${active ? palette.signal : 'transparent'}`, background: active ? palette.soft : 'transparent', color: palette.ink, font: 'inherit', cursor: 'pointer' }}
                >
                  <span>
                    <strong style={{ display: 'block', fontSize: 15 }}>{preset.title}</strong>
                    <span style={{ display: 'block', marginTop: 5, fontSize: 12, color: palette.muted }}>{preset.domain}</span>
                  </span>
                  <span style={{ textAlign: 'right', color: active ? palette.signal : palette.muted, fontSize: 11.5 }}>
                    {preset.format}<br />{formatRehearsalListedSize(preset)}
                  </span>
                </button>
              );
            })}
          </main>

          <aside style={{ minWidth: 0, display: mobile && !mobileDetailOpen ? 'none' : 'block', height: mobile ? '100vh' : undefined, boxSizing: mobile ? 'border-box' : undefined, padding: mobile ? '18px 18px 40px' : '30px 28px', position: mobile ? 'fixed' : 'sticky', inset: mobile ? 0 : undefined, top: mobile ? 0 : 77, zIndex: mobile ? 50 : undefined, alignSelf: 'start', overflowY: mobile ? 'auto' : undefined, background: palette.surface }}>
            {results.length === 0 ? (
              <p style={{ margin: 0, color: palette.muted, lineHeight: 1.6 }}>Adjust the filters to select a rehearsal brief.</p>
            ) : <>
            {mobile && (
              <button type="button" onClick={() => setMobileDetailOpen(false)} style={{ minHeight: 44, marginBottom: 18, border: `1px ${borderStyle} ${palette.rule}`, background: 'transparent', color: palette.muted, font: 'inherit', padding: '0 14px', cursor: 'pointer' }}>Back to list</button>
            )}
            <div style={{ color: palette.signal, fontSize: 12, marginBottom: 14 }}>{selected.format === 'interview' ? 'Adaptive interview' : 'Fresh question deck'}</div>
            <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.08, letterSpacing: '-0.025em' }}>{selected.title}</h2>
            <div style={{ marginTop: 10, color: palette.muted, fontSize: 12 }}>{formatRehearsalListedSize(selected)} · {selected.practiceQuestionCount}-question practice run</div>
            <p style={{ margin: '22px 0', lineHeight: 1.65, color: palette.muted, fontSize: 14 }}>{selected.description}</p>

            <div style={{ borderTop: `1px ${borderStyle} ${palette.rule}`, paddingTop: 18 }}>
              <div style={{ fontSize: 12, color: palette.muted, marginBottom: 10 }}>What this rep tests</div>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.75, fontSize: 13.5 }}>
                {selected.competencies.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>

            {selected.supportsScreenShare && (
              <div style={{ marginTop: 18, padding: '12px 14px', border: `1px ${borderStyle} ${palette.signal}`, color: palette.signal, fontSize: 12.5, lineHeight: 1.5 }}>
                Screen sharing is available in voice mode for work samples, diagrams, or code.
              </div>
            )}

            <label htmlFor="participant-context" style={{ display: 'block', marginTop: 24, color: palette.muted, fontSize: 12 }}>What should this evaluator know about you?</label>
            <textarea
              id="participant-context"
              className="rehearsal-focus"
              value={participantContext}
              onChange={event => setParticipantContext(event.target.value)}
              placeholder="Optional: your background, target role, project, tools, or specific area you want tested."
              rows={5}
              style={{ ...controlStyle, width: '100%', resize: 'vertical', marginTop: 8, boxSizing: 'border-box', lineHeight: 1.5 }}
            />
            <button
              type="button"
              className="rehearsal-focus"
              onClick={() => onStart(createRehearsalSetup(selected, participantContext))}
              style={{ width: '100%', minHeight: 52, marginTop: 16, border: 0, background: palette.signal, color: transcript ? '#fbfaf6' : '#101208', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}
            >
              {selected.format === 'interview' ? 'Choose voice or text' : 'Generate practice deck'}
            </button>
            </>}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default RehearsalLibrary;
