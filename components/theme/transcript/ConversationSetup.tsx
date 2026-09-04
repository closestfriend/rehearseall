import React from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import type { ConversationSetupProps } from '../ThemedConversationSetup';
import { useIsMobile } from '../hooks';

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#fffef9', border: '1px solid #8a8471', color: '#1c1b18', font: 'inherit', fontSize: 14, lineHeight: 1.65, padding: '12px 14px', outline: 'none' };

const TranscriptConversationSetup: React.FC<ConversationSetupProps> = ({
  title, onTitleChange, counterpart, onCounterpartChange, goal, onGoalChange,
  context, onContextChange, concern, onConcernChange, onLoadExample,
  onUseInterviewPreset, onContinue, onBackToHome,
}) => {
  const { setTheme } = useTheme();
  const isMobile = useIsMobile();
  const canContinue = Boolean(title.trim() && counterpart.trim() && goal.trim());
  const Field = ({ number, label, id, children, optional = false }: { number: string; label: string; id: string; children: React.ReactNode; optional?: boolean }) => (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '32px 1fr' : '48px 1fr', borderTop: '1px dashed #b9b4a5', paddingTop: 18, gap: 10 }}>
      <span style={{ color: '#b3402a', fontSize: 12 }}>{number}</span>
      <div style={{ display: 'grid', gap: 8 }}><label htmlFor={id} style={{ fontSize: 12, letterSpacing: '.08em', fontWeight: 700 }}>{label}{optional && <span style={{ color: '#8a8471', fontWeight: 400 }}> — optional</span>}</label>{children}</div>
    </div>
  );

  return (
    <main style={{ minHeight: '100vh', background: '#eeece3', color: '#1c1b18', fontFamily: "'IBM Plex Mono', monospace" }}>
      <header style={{ padding: isMobile ? '16px 20px' : '18px 48px', borderBottom: '2px solid #1c1b18', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button type="button" onClick={onBackToHome} style={{ border: 0, background: 'none', font: 'inherit', cursor: 'pointer', fontWeight: 700 }}>REHEARSE_ALL / BRIEF</button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => setTheme('personal-best')} style={{ border: '1px solid #1c1b18', background: 'none', padding: '8px 12px', font: 'inherit', cursor: 'pointer' }}>SWITCH OUTFIT</button>
          <button type="button" onClick={onBackToHome} style={{ border: '1px solid #1c1b18', background: 'none', padding: '8px 12px', font: 'inherit', cursor: 'pointer' }}>HOME</button>
        </div>
      </header>
      <section style={{ maxWidth: 980, margin: '0 auto', padding: isMobile ? '36px 20px 60px' : '62px 48px 80px' }}>
        <div style={{ borderBottom: '4px double #1c1b18', paddingBottom: 28, marginBottom: 34 }}>
          <div style={{ color: '#b3402a', fontSize: 11, letterSpacing: '.14em', marginBottom: 14 }}>REHEARSAL BRIEF / FORM 01</div>
          <h1 style={{ margin: 0, fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 'clamp(2.5rem, 7vw, 4.8rem)', lineHeight: 1 }}>State the situation.</h1>
          <p style={{ maxWidth: 670, color: '#54503f', lineHeight: 1.75 }}>Give the rehearsal partner enough of the record to respond like someone in the room—not like a generic interviewer.</p>
          <button type="button" onClick={onLoadExample} style={{ marginTop: 8, border: 0, borderBottom: '1px solid #b3402a', background: 'none', color: '#b3402a', padding: '6px 0', cursor: 'pointer', font: 'inherit' }}>Load clinician-call example →</button>
        </div>
        <div style={{ display: 'grid', gap: 24 }}>
          <Field number="01" label="NAME THIS REHEARSAL" id="rt-title"><input id="rt-title" value={title} onChange={e => onTitleChange(e.target.value)} placeholder="AI and teenagers research call" style={inputStyle} /></Field>
          <Field number="02" label="COUNTERPART" id="rt-counterpart"><input id="rt-counterpart" value={counterpart} onChange={e => onCounterpartChange(e.target.value)} placeholder="A pediatric clinician and researcher" style={inputStyle} /></Field>
          <Field number="03" label="DESIRED OUTCOME" id="rt-goal"><textarea id="rt-goal" value={goal} onChange={e => onGoalChange(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
          <Field number="04" label="CONTEXT FOR THE ROOM" id="rt-context"><textarea id="rt-context" value={context} onChange={e => onContextChange(e.target.value)} rows={6} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
          <Field number="05" label="POINT OF CONCERN" id="rt-concern" optional><textarea id="rt-concern" value={concern} onChange={e => onConcernChange(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: 18, borderTop: '2px solid #1c1b18', marginTop: 36, paddingTop: 22 }}>
          <button type="button" onClick={onUseInterviewPreset} style={{ border: 0, borderBottom: '1px solid #6d685c', background: 'none', color: '#54503f', font: 'inherit', cursor: 'pointer', padding: '6px 0' }}>Use interview preset</button>
          <button type="button" disabled={!canContinue} onClick={onContinue} style={{ width: isMobile ? '100%' : 'auto', border: 0, background: canContinue ? '#1c1b18' : '#b9b4a5', color: '#fbfaf6', padding: '15px 24px', minHeight: 48, font: 'inherit', fontWeight: 700, cursor: canContinue ? 'pointer' : 'default' }}>FILE BRIEF →</button>
        </div>
      </section>
    </main>
  );
};

export default TranscriptConversationSetup;
