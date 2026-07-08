import React, { useEffect, useRef } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface TextInterviewChromeProps {
  roleLabel: string;
  levelLabel: string;
  messages: Message[];
  isTyping: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: (e: React.FormEvent) => void;
  onFinish: () => void;
  onCancel: () => void;
}

const TranscriptTextInterviewChrome: React.FC<TextInterviewChromeProps> = ({
  roleLabel,
  levelLabel,
  messages,
  isTyping,
  input,
  onInputChange,
  onSend,
  onFinish,
  onCancel,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isTyping]);

  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === 'user';

  return (
    <div style={{ minHeight: '100vh', background: '#e9e6dc', padding: '0 0 48px', fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: '#1c1b18' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', minHeight: '100vh', background: '#fbfaf6', boxShadow: '0 2px 24px rgba(28,27,24,.12)', display: 'flex', flexDirection: 'column' }}>

        {/* TOP BAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 64px', borderBottom: '1px dashed #b9b4a5', flex: 'none' }}>
          <button type="button" onClick={onCancel} style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', color: '#1c1b18', padding: 0, fontFamily: 'inherit' }}>
            HIREPREP_
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, letterSpacing: '0.18em', color: '#b3402a', fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: '#b3402a', animation: 'hpPulseFade 1.4s ease-in-out infinite' }} />
            PROCEEDINGS IN SESSION
          </div>
          <button type="button" onClick={onFinish} style={{ fontSize: 12, color: '#6d685c', border: '1px solid #b9b4a5', padding: '7px 16px', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            adjourn
          </button>
        </div>

        {/* CASE HEADER (untimed — no progress tracker per README) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '20px 64px 18px', borderBottom: '1px dashed #b9b4a5', flex: 'none', fontSize: 12, color: '#6d685c' }}>
          <span>IN RE: {roleLabel.toUpperCase()} ({levelLabel.toUpperCase()}) — EXAMINATION UNDERWAY</span>
          <span style={{ letterSpacing: '0.1em' }}>UNTIMED</span>
        </div>

        {/* THREAD */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '48px 64px', display: 'flex', flexDirection: 'column', gap: 30, maxWidth: 920, boxSizing: 'border-box' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: m.role === 'user' ? '#b3402a' : '#1c1b18' }}>
                {m.role === 'assistant' ? 'INTERVIEWER:' : 'YOU:'}
              </span>
              <span style={{ fontSize: 15, lineHeight: 1.75, color: m.role === 'assistant' ? '#1c1b18' : '#54503f' }}>
                {m.content}
              </span>
            </div>
          ))}
          {isTyping && (
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>INTERVIEWER:</span>
              <span style={{ fontSize: 15, color: '#6d685c' }}>[preparing next question…]</span>
            </div>
          )}
          {!isTyping && lastIsUser && (
            <div style={{ fontSize: 12, color: '#6d685c', paddingLeft: 138 }}>
              [follow-up — entered into the record based on your prior answer]
            </div>
          )}
        </div>

        {/* INPUT */}
        <form onSubmit={onSend} style={{ flex: 'none', borderTop: '1px dashed #b9b4a5', padding: '24px 64px 30px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 18, maxWidth: 920 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#b3402a', paddingTop: 14 }}>YOU:</span>
            <div>
              <textarea
                value={input}
                onChange={e => onInputChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSend(e as unknown as React.FormEvent);
                  }
                }}
                placeholder="Type your answer for the record…"
                rows={2}
                style={{
                  width: '100%',
                  resize: 'none',
                  border: '1px solid #b9b4a5',
                  padding: '16px 18px',
                  fontSize: 14.5,
                  color: '#1c1b18',
                  background: 'transparent',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11.5, color: '#6d685c' }}>⏎ submits to the record · untimed</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={onFinish}
                    style={{ background: 'none', color: '#1c1b18', border: '1px solid #b9b4a5', padding: '11px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    REST YOUR CASE →
                  </button>
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    style={{
                      background: input.trim() ? '#1c1b18' : '#e9e6dc',
                      color: input.trim() ? '#fbfaf6' : '#8a8471',
                      padding: '11px 24px',
                      fontSize: 12.5,
                      fontWeight: 700,
                      border: 'none',
                      cursor: input.trim() ? 'pointer' : 'default',
                      fontFamily: 'inherit',
                    }}
                  >
                    SUBMIT
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TranscriptTextInterviewChrome;
