
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { MODELS, buildInterviewerSystemInstruction, InterviewerPersona } from '../constants';
import { InterviewMessage, ResumeData } from '../types';
import ThemedTextInterviewChrome from './theme/ThemedTextInterviewChrome';

interface InterviewChatProps {
  resume: ResumeData;
  persona: InterviewerPersona;
  onFinish: (transcript: InterviewMessage[]) => void;
  onCancel: () => void;
}

const InterviewChat: React.FC<InterviewChatProps> = ({ resume, persona, onFinish, onCancel }) => {
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<Chat | null>(null);

  useEffect(() => {
    const initChat = async () => {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
      const chat = ai.chats.create({
        model: MODELS.TEXT_CHEF,
        config: {
          systemInstruction: buildInterviewerSystemInstruction(resume, persona),
        }
      });
      chatRef.current = chat;
      
      // Start the conversation
      setIsTyping(true);
      const result = await chat.sendMessage({ message: "Hello. Please introduce yourself and start the interview." });
      setIsTyping(false);
      
      setMessages([{
        role: 'assistant',
        content: result.text || "I'm ready. Let's begin. Tell me about yourself.",
        timestamp: Date.now()
      }]);
    };
    initChat();
  }, [resume]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatRef.current || isTyping) return;

    const userMessage: InterviewMessage = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const result = await chatRef.current.sendMessage({ message: input });
      const assistantMessage: InterviewMessage = {
        role: 'assistant',
        content: result.text || "",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (result.text?.toLowerCase().includes("concludes our interview")) {
        // Maybe wait a bit?
      }
    } catch (err) {
      console.error("Chat error:", err);
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
