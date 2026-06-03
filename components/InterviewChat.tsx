
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { MODELS, buildInterviewerSystemInstruction, InterviewerPersona } from '../constants';
import { InterviewMessage, ResumeData } from '../types';

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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initChat = async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

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
    <div className="max-w-4xl mx-auto py-8 px-4 h-[calc(100vh-12rem)] flex flex-col">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex-grow overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">AI</div>
            <div>
              <h3 className="font-semibold text-gray-900">Senior Interviewer</h3>
              <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Online
              </p>
            </div>
          </div>
          <button 
            onClick={() => onFinish(messages)}
            className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
          >
            End & Analyze
          </button>
        </div>

        <div ref={scrollRef} className="flex-grow overflow-y-auto p-6 space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl p-4 ${
                m.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                <p className={`text-[10px] mt-2 opacity-50 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl p-4 flex gap-1">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="p-4 border-t border-gray-100 bg-white">
          <div className="flex gap-2">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your response..."
              className="flex-grow px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />
            <button 
              type="submit"
              disabled={isTyping}
              className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InterviewChat;
