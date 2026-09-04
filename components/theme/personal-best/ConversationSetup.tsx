import React from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import type { ConversationSetupProps } from '../ThemedConversationSetup';
import { useIsMobile } from '../hooks';

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#15170d',
  border: '1px solid #3a3e24',
  color: '#f2f4e4',
  font: 'inherit',
  fontSize: 15,
  lineHeight: 1.55,
  padding: '14px 16px',
  outline: 'none',
};

const Label: React.FC<{ htmlFor: string; children: React.ReactNode; optional?: boolean }> = ({ htmlFor, children, optional }) => (
  <label htmlFor={htmlFor} style={{ fontSize: 12, letterSpacing: '0.12em', color: '#d4f222', fontWeight: 650 }}>
    {children}{optional && <span style={{ color: '#777b5e', letterSpacing: 0, fontWeight: 400 }}> · optional</span>}
  </label>
);

const PersonalBestConversationSetup: React.FC<ConversationSetupProps> = ({
  title, onTitleChange, counterpart, onCounterpartChange, goal, onGoalChange,
  context, onContextChange, concern, onConcernChange, onLoadExample,
  onUseInterviewPreset, onContinue, onBackToHome,
}) => {
  const { setTheme } = useTheme();
  const isMobile = useIsMobile();
  const canContinue = Boolean(title.trim() && counterpart.trim() && goal.trim());

  return (
    <main style={{ minHeight: '100vh', background: '#101208', color: '#f2f4e4', fontFamily: "'Space Grotesk', sans-serif" }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: isMobile ? '14px 20px' : '16px 40px', borderBottom: '1px solid #2a2d1a', flexWrap: 'wrap' }}>
        <button onClick={onBackToHome} type="button" style={{ display: 'flex', alignItems: 'center', gap: 12, border: 0, background: 'none', color: '#f2f4e4', cursor: 'pointer', padding: 0, font: 'inherit' }}>
          <span style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', background: '#d4f222', color: '#101208', fontWeight: 800 }}>R</span>
          <span style={{ fontSize: 15, fontWeight: 750 }}>REHEARSE_ALL</span>
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => setTheme('transcript')} style={{ minHeight: 40, padding: '8px 13px', border: '1px solid #3a3e24', background: 'none', color: '#a9ad91', cursor: 'pointer', font: 'inherit', fontSize: 11 }}>SWITCH OUTFIT</button>
          <button type="button" onClick={onBackToHome} style={{ minHeight: 40, padding: '8px 13px', border: '1px solid #3a3e24', background: 'none', color: '#a9ad91', cursor: 'pointer', font: 'inherit', fontSize: 11 }}>HOME</button>
        </div>
      </header>

      <section style={{ maxWidth: 1120, margin: '0 auto', padding: isMobile ? '38px 20px 56px' : '64px 40px 72px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(270px, .8fr) minmax(420px, 1.2fr)', gap: isMobile ? 36 : 72, alignItems: 'start' }}>
          <div style={{ position: isMobile ? 'static' : 'sticky', top: 32 }}>
            <div style={{ color: '#d4f222', fontSize: 12, letterSpacing: '.16em', marginBottom: 20 }}>REHEARSAL BRIEF · 01</div>
            <h1 style={{ margin: 0, fontSize: 'clamp(2.6rem, 7vw, 5.4rem)', lineHeight: .93, letterSpacing: '-.06em', maxWidth: 520 }}>What are you walking into?</h1>
            <p style={{ margin: '24px 0 0', maxWidth: 440, color: '#a9ad91', fontSize: 16, lineHeight: 1.65 }}>
              Give your rehearsal partner the room, the person, and what a good conversation would make possible.
            </p>
            <button type="button" onClick={onLoadExample} style={{ marginTop: 28, padding: '12px 0', color: '#d4f222', background: 'none', border: 0, borderBottom: '1px solid #d4f222', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
              Load example: AI research call with a clinician →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'grid', gap: 9 }}>
              <Label htmlFor="ra-title">Name this rehearsal</Label>
              <input id="ra-title" value={title} onChange={e => onTitleChange(e.target.value)} placeholder="AI and teenagers research call" style={fieldStyle} />
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              <Label htmlFor="ra-counterpart">Who are you speaking with?</Label>
              <input id="ra-counterpart" value={counterpart} onChange={e => onCounterpartChange(e.target.value)} placeholder="A pediatric clinician and researcher" style={fieldStyle} />
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              <Label htmlFor="ra-goal">What would a good outcome look like?</Label>
              <textarea id="ra-goal" value={goal} onChange={e => onGoalChange(e.target.value)} placeholder="Leave with shared language, sharper questions, and a clear next step." rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              <Label htmlFor="ra-context">What should they know?</Label>
              <textarea id="ra-context" value={context} onChange={e => onContextChange(e.target.value)} placeholder="Your background, the invitation, relevant history, what is at stake—anything that changes the room." rows={6} style={{ ...fieldStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              <Label htmlFor="ra-concern" optional>What are you worried you might mishandle?</Label>
              <textarea id="ra-concern" value={concern} onChange={e => onConcernChange(e.target.value)} placeholder="A knowledge gap, a sensitive point, a question you keep avoiding…" rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: 18, marginTop: 10, paddingTop: 28, borderTop: '1px solid #2a2d1a' }}>
              <button type="button" onClick={onUseInterviewPreset} style={{ color: '#a9ad91', background: 'none', border: 0, cursor: 'pointer', font: 'inherit', fontSize: 13 }}>Use the interview preset</button>
              <button type="button" disabled={!canContinue} onClick={onContinue} style={{ width: isMobile ? '100%' : 'auto', minHeight: 52, padding: '14px 28px', border: 0, background: canContinue ? '#d4f222' : '#2a2d1a', color: canContinue ? '#101208' : '#6d7157', cursor: canContinue ? 'pointer' : 'default', font: 'inherit', fontWeight: 750 }}>
                CHOOSE HOW TO REHEARSE →
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default PersonalBestConversationSetup;
