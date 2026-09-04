import React, { useEffect, useRef } from 'react';
import { useIsMobile } from '../hooks';

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
  errorNotice?: string | null;
  onRetryInit?: () => void;
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
  errorNotice,
  onRetryInit,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isTyping]);

  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === 'user';

  return (
    <div style={{ minHeight: '100vh', background: '#e9e6dc', padding: '0 0 48px', fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: '#1c1b18' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', minHeight: '100vh', background: '#fbfaf6', boxShadow: '0 2px 24px rgba(28,27,24,.12)', display: 'flex', flexDirection: 'column' }}>

        {/* TOP BAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 20px' : '16px 64px', borderBottom: '1px dashed #b9b4a5', flex: 'none', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 10 : 0 }}>
          <button type="button" onClick={onCancel} style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', color: '#1c1b18', padding: 0, fontFamily: 'inherit' }}>
            REHEARSE_ALL_
          </button>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, letterSpacing: '0.18em', color: '#b3402a', fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: '#b3402a', animation: 'hpPulseFade 1.4s ease-in-out infinite' }} />
              PROCEEDINGS IN SESSION
            </div>
          )}
          <button type="button" onClick={onFinish} style={{ fontSize: 12, color: '#6d685c', border: '1px solid #b9b4a5', padding: isMobile ? '10px 16px' : '7px 16px', background: 'none', cursor: 'pointer', fontFamily: 'inherit', minHeight: isMobile ? 44 : undefined }}>
            adjourn
          </button>
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, letterSpacing: '0.14em', color: '#b3402a', fontWeight: 700, width: '100%' }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: '#b3402a', animation: 'hpPulseFade 1.4s ease-in-out infinite' }} />
              PROCEEDINGS IN SESSION
            </div>
          )}
        </div>

        {/* CASE HEADER (untimed — no progress tracker per README) */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'baseline', gap: isMobile ? 4 : 0, padding: isMobile ? '16px 20px' : '20px 64px 18px', borderBottom: '1px dashed #b9b4a5', flex: 'none', fontSize: 12, color: '#6d685c' }}>
          <span>IN RE: {roleLabel.toUpperCase()} ({levelLabel.toUpperCase()}) — EXAMINATION UNDERWAY</span>
          <span style={{ letterSpacing: '0.1em' }}>UNTIMED</span>
        </div>

        {/* THREAD */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '28px 20px' : '48px 64px', display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 30, maxWidth: 920, boxSizing: 'border-box' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '120px 1fr', gap: isMobile ? 4 : 18 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: m.role === 'user' ? '#b3402a' : '#1c1b18' }}>
                {m.role === 'assistant' ? 'COUNTERPART:' : 'YOU:'}
              </span>
              <span style={{ fontSize: 15, lineHeight: 1.75, color: m.role === 'assistant' ? '#1c1b18' : '#54503f' }}>
                {m.content}
              </span>
            </div>
          ))}
          {isTyping && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '120px 1fr', gap: isMobile ? 4 : 18 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>COUNTERPART:</span>
              <span style={{ fontSize: 15, color: '#6d685c' }}>[preparing next question…]</span>
            </div>
          )}
          {!isTyping && lastIsUser && (
            <div style={{ fontSize: 12, color: '#6d685c', paddingLeft: isMobile ? 0 : 138 }}>
              [follow-up — entered into the record based on your prior answer]
            </div>
          )}
        </div>

        {/* ERROR NOTICE */}
        {errorNotice && (
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: isMobile ? '14px 20px 0' : '14px 64px 0' }}>
            <span style={{ fontSize: 12, color: '#b3402a' }}>{errorNotice}</span>
            {onRetryInit && (
              <button
                type="button"
                onClick={onRetryInit}
                style={{ background: 'none', border: 'none', padding: 0, color: '#1c1b18', textDecoration: 'underline', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                RETRY
              </button>
            )}
          </div>
        )}

        {/* INPUT */}
        <form onSubmit={onSend} style={{ flex: 'none', borderTop: '1px dashed #b9b4a5', padding: isMobile ? '20px 20px 24px' : '24px 64px 30px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '120px 1fr', gap: isMobile ? 8 : 18, maxWidth: 920 }}>
            {!isMobile && <span style={{ fontSize: 13, fontWeight: 700, color: '#b3402a', paddingTop: 14 }}>YOU:</span>}
            {isMobile && <span style={{ fontSize: 13, fontWeight: 700, color: '#b3402a' }}>YOU:</span>}
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
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginTop: 12, gap: 16, flexWrap: 'wrap' }}>
                {!isMobile && <span style={{ fontSize: 11.5, color: '#6d685c' }}>⏎ submits to the record · untimed</span>}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
                  <button
                    type="button"
                    onClick={onFinish}
                    style={{ background: 'none', color: '#1c1b18', border: '1px solid #b9b4a5', padding: '11px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}
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
                      minHeight: 44,
                    }}
                  >
                    SUBMIT
                  </button>
                </div>
                {isMobile && <span style={{ fontSize: 11, color: '#6d685c' }}>⏎ submits to the record · untimed</span>}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TranscriptTextInterviewChrome;
