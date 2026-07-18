
import React, { useState, useEffect, useRef } from 'react';
import { InterviewMessage, ResumeData } from '../types';
import { sendChatTurn, GatewayRequestError } from '../services/apiClient';
import ThemedTextInterviewChrome from './theme/ThemedTextInterviewChrome';

interface InterviewChatProps {
  resume: ResumeData;
  lastPersonaId?: string;
  onPersonaPicked: (persona: { id: string; name: string }) => void;
  onFinish: (transcript: InterviewMessage[]) => void;
  onCancel: () => void;
}

const InterviewChat: React.FC<InterviewChatProps> = ({
  resume, lastPersonaId, onPersonaPicked, onFinish, onCancel,
}) => {
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [initFailed, setInitFailed] = useState(false);
  // Server-issued ids, echoed on every turn so the persona stays stable.
  const sessionRef = useRef<{ sessionId?: string; personaId?: string }>({});
  // Same StrictMode double-mount guard as VoiceInterview.
  const isInitializedRef = useRef(false);

  // Extracted so the retry button can re-run init directly without going
  // through the StrictMode double-mount guard below (that guard is only
  // meant to suppress the effect firing twice on mount, not to block a
  // deliberate user-triggered retry).
  const runInit = async () => {
    setErrorNotice(null);
    setInitFailed(false);
    setIsTyping(true);
    try {
      const res = await sendChatTurn({ setup: resume, messages: [], lastPersonaId });
      sessionRef.current = { sessionId: res.sessionId, personaId: res.personaId };
      onPersonaPicked({ id: res.personaId, name: res.personaName });
      setMessages([{ role: 'assistant', content: res.reply, timestamp: Date.now() }]);
    } catch (err) {
      console.error('Chat init error:', err);
      setInitFailed(true);
      setErrorNotice(err instanceof GatewayRequestError ? err.message : 'Could not reach the interviewer. Check your connection and try again.');
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    runInit();
  }, [resume, lastPersonaId, onPersonaPicked]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping || messages.length === 0) return;

    const userMessage: InterviewMessage = { role: 'user', content: input, timestamp: Date.now() };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setIsTyping(true);

    try {
      const res = await sendChatTurn({ setup: resume, messages: history, ...sessionRef.current });
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply, timestamp: Date.now() }]);
      setErrorNotice(null);
    } catch (err) {
      console.error('Chat error:', err);
      setErrorNotice(err instanceof GatewayRequestError ? err.message : 'Could not reach the interviewer. Check your connection and try again.');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <ThemedTextInterviewChrome
      roleLabel={resume.role}
      levelLabel={resume.experienceLevel}
      messages={messages}
      isTyping={isTyping}
      input={input}
      onInputChange={setInput}
      onSend={handleSend}
      onFinish={() => onFinish(messages)}
      onCancel={onCancel}
      errorNotice={errorNotice}
      onRetryInit={initFailed ? runInit : undefined}
    />
  );
};

export default InterviewChat;
