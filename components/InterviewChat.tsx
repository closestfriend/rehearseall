
import React, { useState, useEffect, useRef } from 'react';
import { InterviewMessage, ResumeData } from '../types';
import { sendChatTurn } from '../services/apiClient';
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
  // Server-issued ids, echoed on every turn so the persona stays stable.
  const sessionRef = useRef<{ sessionId?: string; personaId?: string }>({});
  // Same StrictMode double-mount guard as VoiceInterview.
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    const initChat = async () => {
      setIsTyping(true);
      try {
        const res = await sendChatTurn({ setup: resume, messages: [], lastPersonaId });
        sessionRef.current = { sessionId: res.sessionId, personaId: res.personaId };
        onPersonaPicked({ id: res.personaId, name: res.personaName });
        setMessages([{ role: 'assistant', content: res.reply, timestamp: Date.now() }]);
      } catch (err) {
        console.error('Chat init error:', err);
      } finally {
        setIsTyping(false);
      }
    };
    initChat();
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
    } catch (err) {
      console.error('Chat error:', err);
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
    />
  );
};

export default InterviewChat;
