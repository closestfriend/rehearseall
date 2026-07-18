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

const PersonalBestTextInterviewChrome: React.FC<TextInterviewChromeProps> = ({
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
  const labelColWidth = isMobile ? 0 : 120;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#101208', color: '#f2f4e4', fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* TOP BAR */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 10 : 0, padding: isMobile ? '14px 20px' : '16px 40px', borderBottom: '1px solid #2a2d1a', flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <span style={{ width: 26, height: 26, background: '#d4f222', display: 'grid', placeItems: 'center', color: '#101208', fontWeight: 700, fontSize: 15 }}>H</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#f2f4e4' }}>HIREPREP</span>
          </button>
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, letterSpacing: '0.16em', color: '#d4f222' }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: '#d4f222', animation: 'hpBlink 1.6s ease-in-out infinite' }} />
              REP IN PROGRESS
            </div>
          )}
        </div>
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, letterSpacing: '0.16em', color: '#d4f222' }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: '#d4f222', animation: 'hpBlink 1.6s ease-in-out infinite' }} />
            REP IN PROGRESS
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end', gap: isMobile ? 12 : 24, fontSize: 12.5, color: '#a9ad91' }}>
          <span>{roleLabel} · {levelLabel.toUpperCase()}</span>
          <button type="button" onClick={onFinish} style={{ border: '1px solid #3a3e24', padding: '8px 18px', fontWeight: 600, color: '#a9ad91', background: 'none', fontSize: 12.5, cursor: 'pointer', minHeight: 44, boxSizing: 'border-box' }}>
            END REP
          </button>
        </div>
      </div>

      {/* UNTIMED HINT (replaces progress tracker for text mode) */}
      <div style={{ flex: 'none', padding: isMobile ? '10px 20px' : '10px 40px', borderBottom: '1px solid #2a2d1a', fontSize: 11.5, letterSpacing: '0.12em', color: '#6d7157' }}>
        UNTIMED — take as long as you need
      </div>

      {/* THREAD */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '24px 20px' : 40, display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 860, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {messages.map((m, i) => (
          isMobile ? (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: m.role === 'assistant' ? '#d4f222' : '#a9ad91' }}>
                {m.role === 'assistant' ? 'INTERVIEWER' : 'YOU'}
              </span>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: m.role === 'assistant' ? '#f2f4e4' : '#a9ad91' }}>
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: `${labelColWidth}px 1fr`, gap: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: m.role === 'assistant' ? '#d4f222' : '#a9ad91', paddingTop: 3 }}>
                {m.role === 'assistant' ? 'INTERVIEWER' : 'YOU'}
              </span>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: m.role === 'assistant' ? '#f2f4e4' : '#a9ad91' }}>
                {m.content}
              </p>
            </div>
          )
        ))}
        {isTyping && (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#d4f222' }}>INTERVIEWER</span>
              <span style={{ fontSize: 15.5, color: '#a9ad91' }}>thinking…</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#d4f222', paddingTop: 3 }}>INTERVIEWER</span>
              <span style={{ fontSize: 15.5, color: '#a9ad91' }}>thinking…</span>
            </div>
          )
        )}
        {!isTyping && lastIsUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: isMobile ? 0 : 140 }}>
            <span style={{ fontSize: 12, color: '#a9ad91' }}>follow-up · based on your answer</span>
          </div>
        )}
      </div>

      {/* ERROR NOTICE */}
      {errorNotice && (
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: isMobile ? '12px 20px 0' : '12px 40px 0', maxWidth: 860, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <span style={{ fontSize: 12.5, color: '#d4f222', letterSpacing: '0.02em' }}>{errorNotice}</span>
          {onRetryInit && (
            <button
              type="button"
              onClick={onRetryInit}
              style={{ background: '#d4f222', color: '#101208', padding: '8px 18px', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', border: 'none', cursor: 'pointer', minHeight: 36, boxSizing: 'border-box' }}
            >
              RETRY
            </button>
          )}
        </div>
      )}

      {/* INPUT */}
      <form
        onSubmit={onSend}
        style={{ flex: 'none', borderTop: '1px solid #2a2d1a', padding: isMobile ? '18px 20px 22px' : '22px 40px 26px', maxWidth: 860, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}
      >
        <textarea
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Type your answer…"
          rows={2}
          style={{
            width: '100%',
            resize: 'none',
            border: '1px solid #3a3e24',
            padding: '18px 20px',
            fontSize: 15,
            color: '#f2f4e4',
            background: 'transparent',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#a9ad91' }}>⏎ to send · take your time, this mode isn&apos;t timed</span>
          <div style={{ display: 'flex', gap: 12, width: isMobile ? '100%' : undefined }}>
            <button
              type="button"
              onClick={onFinish}
              style={{ background: 'none', border: '1px solid #3a3e24', color: '#a9ad91', padding: '12px 22px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', minHeight: 44, boxSizing: 'border-box', flex: isMobile ? '1 1 auto' : 'none' }}
            >
              FINISH &amp; DEBRIEF →
            </button>
            <button
              type="submit"
              disabled={!input.trim()}
              style={{ background: input.trim() ? '#d4f222' : '#3a3e24', color: input.trim() ? '#101208' : '#6d7157', padding: '12px 26px', fontSize: 13, fontWeight: 700, border: 'none', cursor: input.trim() ? 'pointer' : 'default', minHeight: 44, boxSizing: 'border-box', flex: isMobile ? '1 1 auto' : 'none' }}
            >
              SEND
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PersonalBestTextInterviewChrome;
